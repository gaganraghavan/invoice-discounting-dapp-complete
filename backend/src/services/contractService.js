/**
 * contractService.js — Smart contract interaction layer
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Implements all functions from the paper:
 *   mintInvoice()        → Algorithm 1 (Section IV-B-1)
 *   signInvoice()        → Algorithm 2 (Section IV-B-2)
 *   approveInvoiceSale() → Algorithm 3 (Section IV-B-3)
 *   revokeInvoiceSale()  → Algorithm 4 (Section IV-B-3)
 *   buyInvoice()         → Algorithm 5 (Section IV-B-4)
 *   settleInvoice()      → Dissertation Algorithm 9
 *   burnInvoiceNFT()     → Dissertation (optional, buyer's choice)
 *   getInvoiceMetadata() → Read from blockchain (no DB — paper design)
 *   calculateProfit()    → Equation 1 from paper Section VII-A
 *
 * Three caller types matching paper Table 1:
 *   "supplier"  → uses SUPPLIER_PRIVATE_KEY from .env
 *   "buyer"     → uses BUYER_PRIVATE_KEY from .env
 *   "financier" → uses FINANCIER_PRIVATE_KEY from .env
 *   "custom"    → caller provides their own private key (MetaMask export)
 */

"use strict";

const { ethers } = require("ethers");
const {
  getContractWithSigner,
  getReadOnlyContract,
} = require("../config/blockchain");
const { getIPFSUrl } = require("./ipfsService");

// ─── Private key resolution ──────────────────────────────────────────────────
/**
 * Resolves which private key to use based on callerType.
 * Paper Table 1 maps each stakeholder to a specific Ethereum address.
 * For Postman testing: use callerType="supplier"/"buyer"/"financier"
 * For MetaMask testing: pass callerPrivateKey directly
 */
function resolvePrivateKey(callerType, providedKey) {
  if (providedKey) return providedKey;

  switch (callerType) {
    case "supplier":
      if (!process.env.SUPPLIER_PRIVATE_KEY)
        throw new Error("SUPPLIER_PRIVATE_KEY not set in .env");
      return process.env.SUPPLIER_PRIVATE_KEY;

    case "buyer":
      if (!process.env.BUYER_PRIVATE_KEY)
        throw new Error("BUYER_PRIVATE_KEY not set in .env");
      return process.env.BUYER_PRIVATE_KEY;

    case "financier":
      if (!process.env.FINANCIER_PRIVATE_KEY)
        throw new Error("FINANCIER_PRIVATE_KEY not set in .env");
      return process.env.FINANCIER_PRIVATE_KEY;

    default:
      throw new Error(
        'Must provide callerType ("supplier"/"buyer"/"financier") or callerPrivateKey'
      );
  }
}

// ─── Helper: parse contract revert reason ────────────────────────────────────
function parseError(err) {
  if (err.reason)  return err.reason;
  if (err.message) return err.message;
  return "Transaction failed";
}

// ─── Algorithm 1: mintInvoice ────────────────────────────────────────────────
/**
 * Called by: Supplier
 * Paper Section IV-B-1, Algorithm 1
 *
 * Flow:
 *   1. PDF already uploaded to IPFS → CID passed in
 *   2. Contract checks CID not already minted (double-spend prevention)
 *   3. Contract checks supplier ≠ buyer (fake invoice prevention)
 *   4. NFT minted, ownership = Supplier
 *   5. isApproved=false, forSale=false
 */
async function mintInvoice({
  buyerAddress,
  invoiceAmountEth,
  dueDate,
  ipfsCID,
  callerType,
  callerPrivateKey,
}) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  const invoiceAmountWei = ethers.parseEther(invoiceAmountEth.toString());

  let tx, receipt;
  try {
    tx      = await contract.mintInvoice(buyerAddress, invoiceAmountWei, dueDate, ipfsCID);
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  // Parse InvoiceMinted event to get tokenId
  const event = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); }
      catch { return null; }
    })
    .find((e) => e && e.name === "InvoiceMinted");

  if (!event) {
    throw new Error("InvoiceMinted event not found in receipt");
  }

  const tokenId = Number(event.args.tokenId);

  return {
    tokenId,
    txHash:        receipt.hash,
    ipfsCID,
    ipfsUrl:       getIPFSUrl(ipfsCID),
    invoiceAmount: invoiceAmountEth,
    gasUsed:       receipt.gasUsed.toString(),
    blockNumber:   receipt.blockNumber,
    // Paper gas reference (Table 2): mintInvoice cost 0.002129 ETH = $4.55
  };
}

// ─── Algorithm 2: signInvoice ────────────────────────────────────────────────
/**
 * Called by: Buyer ONLY
 * Paper Section IV-B-2, Algorithm 2
 *
 * Sets isApproved = true. Ownership unchanged (still Supplier).
 * NFT gains intrinsic value equivalent to invoice amount after this step.
 * Only signed invoices can be listed for sale (Algorithm 3 requirement).
 */
async function signInvoice({ tokenId, callerType, callerPrivateKey }) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  let tx, receipt;
  try {
    tx      = await contract.signInvoice(tokenId);
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  return {
    tokenId,
    txHash:      receipt.hash,
    isApproved:  true,
    gasUsed:     receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    // Paper gas reference (Table 2): signInvoice cost 0.000139 ETH = $0.32
  };
}

// ─── Algorithm 3: approveInvoiceSale ─────────────────────────────────────────
/**
 * Called by: Supplier (NFT owner)
 * Paper Section IV-B-3, Algorithm 3
 *
 * THIS is where invoice discounting actually happens:
 * Supplier sets selling price BELOW invoice amount to attract financiers.
 * forSale = true, currPrice = discounted price.
 * Financiers can now see this in the marketplace.
 */
async function approveInvoiceSale({
  tokenId,
  newSellingPriceEth,
  callerType,
  callerPrivateKey,
}) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  const priceWei = ethers.parseEther(newSellingPriceEth.toString());

  let tx, receipt;
  try {
    tx      = await contract.approveInvoiceSale(tokenId, priceWei);
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  return {
    tokenId,
    txHash:         receipt.hash,
    discountedPrice: newSellingPriceEth,
    forSale:         true,
    gasUsed:         receipt.gasUsed.toString(),
    blockNumber:     receipt.blockNumber,
    // Paper gas reference (Table 2): approveInvoiceSale = 0.000102 ETH = $0.23
  };
}

// ─── Algorithm 4: revokeInvoiceSale ──────────────────────────────────────────
/**
 * Called by: NFT owner (Supplier before sale, Financier after purchase)
 * Paper Section IV-B-3, Algorithm 4
 *
 * Pulls NFT off marketplace. forSale = false, price reset to invoiceAmount.
 * Safety mechanism — owner can always withdraw before it's bought.
 */
async function revokeInvoiceSale({ tokenId, callerType, callerPrivateKey }) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  let tx, receipt;
  try {
    tx      = await contract.revokeInvoiceSale(tokenId);
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  return {
    tokenId,
    txHash:      receipt.hash,
    forSale:     false,
    gasUsed:     receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    // Paper gas reference (Table 2): revokeInvoiceSale = 0.000102 ETH = $0.21
  };
}

// ─── Algorithm 5: buyInvoice ──────────────────────────────────────────────────
/**
 * Called by: Financier (payable — sends ETH = currPrice)
 * Paper Section IV-B-4, Algorithm 5
 *
 * Steps (from paper):
 *   a. ETH transferred from Financier → Supplier
 *   b. NFT ownership transferred Supplier → Financier (1st ownership transfer)
 *   c. forSale = false, currPrice reset to invoiceAmount
 *
 * Paper example (Figure 16): tokenId=28, 0.008 ETH transferred
 * Gas (Table 2): buyInvoice = 0.000161 ETH = $0.37
 */
async function buyInvoice({ tokenId, callerType, callerPrivateKey }) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  // Always read price from blockchain — it is the single source of truth
  // No database to be out of sync with
  const metadata = await contract.getInvoiceMetadata(tokenId);
  if (!metadata.forSale) {
    throw new Error("This NFT is not available to buy");
  }
  const price = metadata.currPrice;

  let tx, receipt;
  try {
    tx      = await contract.buyInvoice(tokenId, { value: price });
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  // Get the buyer's address (now the new owner = Financier)
  const signerWallet = new (require("ethers").Wallet)(privateKey);
  const newOwner     = signerWallet.address;

  return {
    tokenId,
    txHash:      receipt.hash,
    newOwner,                                   // Financier is now owner
    paidEth:     ethers.formatEther(price),
    paidWei:     price.toString(),
    gasUsed:     receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
  };
}

// ─── Algorithm 9: settleInvoice ───────────────────────────────────────────────
/**
 * Called by: Buyer on or after due date
 * Dissertation Section 5.2.1, Algorithm 9
 *
 * Steps:
 *   a. ETH (invoiceAmount) transferred from Buyer → Financier
 *   b. NFT ownership transferred Financier → Buyer (2nd/final transfer)
 *
 * Financier profit = invoiceAmount - discountedPrice - gasFees
 * (Equation 1: Profit = (I × R × T) / (100 × 365) - G)
 */
async function settleInvoice({ tokenId, callerType, callerPrivateKey }) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  // Read invoice amount from blockchain (source of truth)
  const metadata      = await contract.getInvoiceMetadata(tokenId);
  const invoiceAmount = metadata.invoiceAmount;

  let tx, receipt;
  try {
    tx      = await contract.settleInvoice(tokenId, { value: invoiceAmount });
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  const signerWallet = new (require("ethers").Wallet)(privateKey);
  const newOwner     = signerWallet.address;

  return {
    tokenId,
    txHash:          receipt.hash,
    newOwner,                                        // Buyer is now owner
    settledEth:      ethers.formatEther(invoiceAmount),
    settledWei:      invoiceAmount.toString(),
    gasUsed:         receipt.gasUsed.toString(),
    blockNumber:     receipt.blockNumber,
  };
}

// ─── burnInvoiceNFT ───────────────────────────────────────────────────────────
/**
 * Called by: Buyer (after settlement — optional)
 * Dissertation: "Buyer can choose to keep NFT as proof of payment OR burn it"
 *
 * Burning = permanently destroy the NFT.
 * The paper describes this as transferring to a wallet with a lost private key,
 * but our implementation uses OpenZeppelin's _burn() which is cleaner.
 */
async function burnInvoiceNFT({ tokenId, callerType, callerPrivateKey }) {
  const privateKey = resolvePrivateKey(callerType, callerPrivateKey);
  const contract   = getContractWithSigner(privateKey);

  let tx, receipt;
  try {
    tx      = await contract.burnInvoiceNFT(tokenId);
    receipt = await tx.wait();
  } catch (err) {
    throw new Error(parseError(err));
  }

  return {
    tokenId,
    txHash:      receipt.hash,
    burned:      true,
    gasUsed:     receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
  };
}

// ─── getInvoiceMetadata ───────────────────────────────────────────────────────
/**
 * Reads invoice metadata directly from blockchain.
 * NO DATABASE — blockchain is the only storage (paper Section IV-A).
 *
 * Returns all fields from InvoiceMetadata struct (Figure 5) plus current owner.
 */
async function getInvoiceMetadata(tokenId) {
  const contract = getReadOnlyContract();

  let meta, owner;
  try {
    meta  = await contract.getInvoiceMetadata(tokenId);
    owner = await contract.ownerOf(tokenId);
  } catch (err) {
    throw new Error(parseError(err));
  }

  return {
    tokenId,
    // Figure 5 fields:
    creator:       meta.creator,
    buyer:         meta.buyer,
    currPrice:     ethers.formatEther(meta.currPrice),
    invoiceAmount: ethers.formatEther(meta.invoiceAmount),
    dueDate:       meta.dueDate,
    isApproved:    meta.isApproved,
    forSale:       meta.forSale,
    // Additional derived info:
    currentOwner:  owner,
    currPriceWei:  meta.currPrice.toString(),
    invoiceAmountWei: meta.invoiceAmount.toString(),
  };
}

// ─── Profit Calculator — Equation 1 ──────────────────────────────────────────
/**
 * Implements Equation 1 from the paper (Section VII-A):
 *
 *   Profit = (I × R × T) / (100 × 365) − G
 *
 * Where:
 *   I = Invoice Amount (ETH)
 *   R = Discount Rate (percentage, e.g. 5 for 5%)
 *   T = Number of days until due date
 *   G = Gas fees paid by financier (ETH)
 *
 * Graph interpretation (Figure 20):
 *   - y = profit, x = invoice amount
 *   - slope = (R × T) / (100 × 365)  — highest influence: discount rate R
 *   - y-intercept = -G
 *   - Profitable when invoice amount > x-intercept (break-even point)
 *   - Break-even: I = (G × 100 × 365) / (R × T)
 *
 * Paper gas reference: Financier pays approveInvoiceSale ($0.23) + buyInvoice ($0.37)
 * = $0.60 total gas, which at ETH=$2279.23 ≈ 0.000263 ETH
 */
function calculateProfit({
  invoiceAmountEth,
  discountRatePercent,
  daysUntilDue,
  gasFeesEth,
}) {
  const I = parseFloat(invoiceAmountEth);
  const R = parseFloat(discountRatePercent);
  const T = parseFloat(daysUntilDue);
  const G = parseFloat(gasFeesEth);

  if (isNaN(I) || isNaN(R) || isNaN(T) || isNaN(G)) {
    throw new Error("All parameters must be valid numbers");
  }
  if (R <= 0 || T <= 0) {
    throw new Error("Discount rate and days must be greater than 0");
  }

  const profit          = (I * R * T) / (100 * 365) - G;
  const breakEvenAmount = (G * 100 * 365) / (R * T);
  const slope           = (R * T) / (100 * 365);  // Figure 20 slope

  return {
    profit:           parseFloat(profit.toFixed(8)),
    profitEth:        profit.toFixed(8),
    isProfitable:     profit > 0,
    breakEvenAmount:  parseFloat(breakEvenAmount.toFixed(6)),
    breakEvenEth:     breakEvenAmount.toFixed(6),
    slope:            parseFloat(slope.toFixed(8)),
    formula:          `(${I} × ${R} × ${T}) / (100 × 365) - ${G}`,
    inputs: { invoiceAmountEth: I, discountRatePercent: R, daysUntilDue: T, gasFeesEth: G },
    // Paper note: slope depends most on discount rate R (highest influence on profitability)
    paperNote: "Profitable trades have invoice amount > break-even amount. " +
               "Discount rate has highest influence on slope (Figure 20).",
  };
}

module.exports = {
  mintInvoice,
  signInvoice,
  approveInvoiceSale,
  revokeInvoiceSale,
  buyInvoice,
  settleInvoice,
  burnInvoiceNFT,
  getInvoiceMetadata,
  calculateProfit,
};
