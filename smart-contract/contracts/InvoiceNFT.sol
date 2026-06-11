// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title InvoiceNFT
 * @dev NFT-based Invoice Discounting DApp
 *      Based on: "A Non-Fungible Token Based Approach to Invoice Discounting"
 *      by Shruti Jadon, Shashank R, Haria Mehkhad, Vinay Kumar S,
 *      Aishwarya N and Prasad B Honnavalli — PES University (IEEE)
 *
 *      Smart contract deployed on Ethereum Sepolia Testnet.
 *      No database — blockchain + IPFS is the only storage (paper design).
 *
 *      Three parties: Supplier (mints), Buyer (signs), Financier (buys).
 *      All three use same interface — Unified Interface System (Section IV-A).
 *
 *      Ownership journey:
 *        mintInvoice()        → Owner = Supplier
 *        signInvoice()        → Owner = Supplier (unchanged)
 *        approveInvoiceSale() → Owner = Supplier (unchanged)
 *        buyInvoice()         → Owner = Financier  (1st transfer, ETH → Supplier)
 *        settleInvoice()      → Owner = Buyer       (2nd transfer, ETH → Financier)
 *        burnInvoiceNFT()     → Owner = Nobody      (optional, buyer choice)
 */
contract InvoiceNFT is ERC721URIStorage {

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 private _tokenIdCounter;

    // Duplicate CID prevention (Algorithm 1)
    mapping(string  => bool)    private _cidExists;
    mapping(string  => uint256) private _cidToTokenId;

    /**
     * @dev InvoiceMetadata struct — exactly as shown in Figure 5 of the paper.
     *      Maps tokenId → metadata via InvoiceNFT_Map (paper naming).
     */
    struct InvoiceMetadata {
        address creator;        // ethereum address of supplier
        address buyer;          // ethereum address of buyer
        uint256 currPrice;      // price of invoice set by owner
        uint256 invoiceAmount;  // cost of goods or service
        string  dueDate;        // last date for settlement
        bool    isApproved;     // buyer approval status
        bool    forSale;        // marketplace availability
    }

    // Main mapping as named in the paper
    mapping(uint256 => InvoiceMetadata) public InvoiceNFT_Map;

    // ─── Events ──────────────────────────────────────────────────────────────

    event InvoiceMinted(
        uint256 indexed tokenId,
        address indexed supplier,
        address indexed buyer,
        uint256 invoiceAmount,
        string  dueDate,
        string  ipfsCID
    );

    event InvoiceSigned(
        uint256 indexed tokenId,
        address indexed buyer
    );

    event InvoiceListedForSale(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 price
    );

    event InvoiceSaleRevoked(
        uint256 indexed tokenId,
        address indexed owner
    );

    event InvoicePurchased(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 price
    );

    event InvoiceSettled(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed financier,
        uint256 amount
    );

    event InvoiceBurned(
        uint256 indexed tokenId,
        address indexed burner
    );

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() ERC721("InvoiceNFT", "INV") {}

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm 1: mintInvoice  (Section IV-B-1 of IEEE paper)
    // Called by: Supplier (anyone — platform is public per paper Section VI)
    // Input:  Invoice document → uploaded to IPFS → CID passed here
    //         + buyer address, invoice amount, due date
    // Output: Newly minted unsigned NFT; isApproved=false, forSale=false
    //         Duplicate CID check prevents double-spending (key security feature)
    //         Supplier ≠ buyer check prevents fake invoices
    // ─────────────────────────────────────────────────────────────────────────
    function mintInvoice(
        address buyerAddress,
        uint256 invoiceAmount,
        string  calldata dueDate,
        string  calldata ipfsCID
    ) external returns (uint256) {
        // Duplicate CID check — prevents re-minting same invoice (Algorithm 1)
        require(!_cidExists[ipfsCID], "NFT already exists for this invoice");

        // Supplier and buyer cannot be the same (fake invoice prevention)
        require(msg.sender != buyerAddress, "Supplier and buyer cannot be the same");
        require(buyerAddress != address(0), "Invalid buyer address");
        require(invoiceAmount > 0, "Invoice amount must be greater than 0");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(dueDate).length > 0, "Due date cannot be empty");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        // Mint NFT to supplier — supplier is initial owner
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, ipfsCID);

        // Set metadata (Figure 5 structure)
        InvoiceNFT_Map[tokenId] = InvoiceMetadata({
            creator:       msg.sender,
            buyer:         buyerAddress,
            currPrice:     invoiceAmount,   // starts at invoice amount
            invoiceAmount: invoiceAmount,
            dueDate:       dueDate,
            isApproved:    false,
            forSale:       false
        });

        _cidExists[ipfsCID]    = true;
        _cidToTokenId[ipfsCID] = tokenId;

        emit InvoiceMinted(
            tokenId, msg.sender, buyerAddress, invoiceAmount, dueDate, ipfsCID
        );

        return tokenId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm 2: signInvoice  (Section IV-B-2 of IEEE paper)
    // Called by: Buyer ONLY (the address set by supplier at mint time)
    // Input:  tokenId
    // Output: isApproved = true
    //         Ownership unchanged — still with Supplier
    //         NFT gains intrinsic value equivalent to invoice amount
    //         Only signed invoices can be listed for sale (Algorithm 3 gate)
    // ─────────────────────────────────────────────────────────────────────────
    function signInvoice(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            msg.sender == InvoiceNFT_Map[tokenId].buyer,
            "Only the designated buyer can sign this invoice"
        );
        require(
            !InvoiceNFT_Map[tokenId].isApproved,
            "Invoice already signed"
        );

        InvoiceNFT_Map[tokenId].isApproved = true;

        emit InvoiceSigned(tokenId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm 3: approveInvoiceSale  (Section IV-B-3 of IEEE paper)
    // Called by: Supplier (NFT owner)
    // Input:  tokenId, new discounted selling price
    // Output: forSale = true, currPrice = discounted price
    //         Requires isApproved == true first (buyer must have signed)
    //         This is where actual invoice DISCOUNTING happens —
    //         supplier sets price below invoiceAmount to attract financiers
    //         Ownership unchanged — still with Supplier
    // ─────────────────────────────────────────────────────────────────────────
    function approveInvoiceSale(
        uint256 tokenId,
        uint256 newSellingPrice
    ) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            InvoiceNFT_Map[tokenId].isApproved,
            "Invoice must be signed by buyer before selling"
        );
        require(
            ownerOf(tokenId) == msg.sender,
            "Only the NFT owner can put it for sale or modify price"
        );
        require(newSellingPrice > 0, "Selling price must be greater than 0");

        InvoiceNFT_Map[tokenId].currPrice = newSellingPrice;
        InvoiceNFT_Map[tokenId].forSale   = true;

        emit InvoiceListedForSale(tokenId, msg.sender, newSellingPrice);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm 4: revokeInvoiceSale  (Section IV-B-3 of IEEE paper)
    // Called by: NFT owner
    // Input:  tokenId
    // Output: forSale = false, currPrice reset to invoiceAmount
    //         Pulls NFT off marketplace before it is bought
    //         Safety mechanism — owner can withdraw at any time
    // ─────────────────────────────────────────────────────────────────────────
    function revokeInvoiceSale(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            ownerOf(tokenId) == msg.sender,
            "Only the owner of the NFT can remove it from marketplace"
        );
        require(
            InvoiceNFT_Map[tokenId].forSale,
            "Invoice is not currently for sale"
        );

        InvoiceNFT_Map[tokenId].forSale   = false;
        InvoiceNFT_Map[tokenId].currPrice = InvoiceNFT_Map[tokenId].invoiceAmount;

        emit InvoiceSaleRevoked(tokenId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm 5: buyInvoice  (Section IV-B-4 of IEEE paper)
    // Called by: Financier (payable — must send ETH equal to currPrice)
    // Input:  tokenId + ETH = currPrice
    // Output: ETH transferred from Financier → Supplier
    //         NFT ownership transferred Supplier → Financier (1st transfer)
    //         forSale = false, currPrice reset to invoiceAmount
    //         Paper Figure 16 example: tokenId=28, 0.008 ETH transferred
    // ─────────────────────────────────────────────────────────────────────────
    function buyInvoice(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            InvoiceNFT_Map[tokenId].forSale,
            "This NFT is not available to buy"
        );
        require(
            msg.value == InvoiceNFT_Map[tokenId].currPrice,
            "Insufficient balance to buy the NFT"
        );
        require(
            ownerOf(tokenId) != msg.sender,
            "You cannot buy your own NFT"
        );

        address currentOwner = ownerOf(tokenId);
        uint256 salePrice    = InvoiceNFT_Map[tokenId].currPrice;

        // Checks-Effects-Interactions pattern for reentrancy safety
        InvoiceNFT_Map[tokenId].forSale   = false;
        InvoiceNFT_Map[tokenId].currPrice = InvoiceNFT_Map[tokenId].invoiceAmount;

        // Transfer ETH to current owner (Supplier)
        (bool sent, ) = payable(currentOwner).call{value: salePrice}("");
        require(sent, "ETH transfer to seller failed");

        // Transfer NFT ownership to Financier (1st ownership transfer)
        _transfer(currentOwner, msg.sender, tokenId);

        emit InvoicePurchased(tokenId, currentOwner, msg.sender, salePrice);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Algorithm 9: settleInvoice  (Dissertation Section 5.2.1, Algorithm 9)
    // Called by: Buyer on or after due date
    // Input:  tokenId + ETH = invoiceAmount (full amount, not discounted price)
    // Output: ETH transferred from Buyer → Financier
    //         NFT ownership transferred Financier → Buyer (2nd/final transfer)
    //         Financier profit = invoiceAmount - discountedPrice - gasFees
    //         (Equation 1 from paper: Profit = (I×R×T)/(100×365) - G)
    // ─────────────────────────────────────────────────────────────────────────
    function settleInvoice(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            msg.sender == InvoiceNFT_Map[tokenId].buyer,
            "Only the designated buyer can settle this invoice"
        );
        require(
            msg.value == InvoiceNFT_Map[tokenId].invoiceAmount,
            "Must send exact invoice amount to settle"
        );
        require(
            !InvoiceNFT_Map[tokenId].forSale,
            "Invoice is currently for sale, cannot settle"
        );

        address financier    = ownerOf(tokenId);
        uint256 settleAmount = InvoiceNFT_Map[tokenId].invoiceAmount;

        // Transfer ETH from Buyer to Financier
        (bool sent, ) = payable(financier).call{value: settleAmount}("");
        require(sent, "ETH transfer to financier failed");

        // Transfer NFT ownership from Financier to Buyer (2nd/final transfer)
        _transfer(financier, msg.sender, tokenId);

        emit InvoiceSettled(tokenId, msg.sender, financier, settleAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // burnInvoiceNFT  (Dissertation: optional, buyer's own choice)
    // Called by: Buyer (after settlement, once they own the NFT)
    // Paper: "Burn = transfer to lost private key wallet"
    //        Buyer can keep NFT as proof of payment OR burn it — their choice
    // ─────────────────────────────────────────────────────────────────────────
    function burnInvoiceNFT(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(
            ownerOf(tokenId) == msg.sender,
            "Only the NFT owner can burn it"
        );

        _burn(tokenId);

        emit InvoiceBurned(tokenId, msg.sender);
    }

    // ─── View / Helper functions ──────────────────────────────────────────────

    /**
     * @dev Returns full metadata for a token — used by backend getInvoiceMetadata()
     */
    function getInvoiceMetadata(uint256 tokenId)
        external
        view
        returns (InvoiceMetadata memory)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return InvoiceNFT_Map[tokenId];
    }

    /**
     * @dev Total tokens minted so far (includes burned — counter never decrements)
     */
    function getTotalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Check if a CID has already been minted — used by backend for
     *      fast duplicate detection before hitting chain (Enhancement #4)
     */
    function cidExists(string calldata cid) external view returns (bool) {
        return _cidExists[cid];
    }

    /**
     * @dev Get tokenId by CID (reverse lookup)
     */
    function getTokenIdByCID(string calldata cid)
        external
        view
        returns (uint256)
    {
        require(_cidExists[cid], "No token found for this CID");
        return _cidToTokenId[cid];
    }
}
