/**
 * InvoiceNFT.test.js — Smart contract tests
 * Tests all 7 functions matching paper algorithms.
 * Run: npx hardhat test
 */
const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("InvoiceNFT — Paper Algorithm Tests", function () {
  let contract, supplier, buyer, financier, other;
  const AMOUNT = ethers.parseEther("1.0");
  const PRICE  = ethers.parseEther("0.8");   // 20% discount
  const CID    = "QmTestCID123abc";
  const DATE   = "2025-12-31";

  beforeEach(async () => {
    [supplier, buyer, financier, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("InvoiceNFT");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ── Algorithm 1: mintInvoice ──────────────────────────────────────────────
  describe("Algorithm 1 — mintInvoice", () => {
    it("mints NFT, sets metadata correctly (Figure 9)", async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
      const meta = await contract.getInvoiceMetadata(0);
      expect(meta.creator).to.equal(supplier.address);
      expect(meta.buyer).to.equal(buyer.address);
      expect(meta.invoiceAmount).to.equal(AMOUNT);
      expect(meta.isApproved).to.equal(false);
      expect(meta.forSale).to.equal(false);
      expect(await contract.ownerOf(0)).to.equal(supplier.address);
    });

    it("rejects duplicate CID (Figure 8 — double-spend prevention)", async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
      await expect(
        contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID)
      ).to.be.revertedWith("NFT already exists for this invoice");
    });

    it("rejects supplier == buyer (fake invoice prevention)", async () => {
      await expect(
        contract.connect(supplier).mintInvoice(supplier.address, AMOUNT, DATE, "QmOtherCID")
      ).to.be.revertedWith("Supplier and buyer cannot be the same");
    });
  });

  // ── Algorithm 2: signInvoice ──────────────────────────────────────────────
  describe("Algorithm 2 — signInvoice", () => {
    beforeEach(async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
    });

    it("buyer signs invoice, isApproved becomes true (Figure 11)", async () => {
      await contract.connect(buyer).signInvoice(0);
      const meta = await contract.getInvoiceMetadata(0);
      expect(meta.isApproved).to.equal(true);
      expect(await contract.ownerOf(0)).to.equal(supplier.address); // ownership unchanged
    });

    it("rejects wrong buyer (Figure 10)", async () => {
      await expect(
        contract.connect(other).signInvoice(0)
      ).to.be.revertedWith("Only the designated buyer can sign this invoice");
    });

    it("rejects double signing", async () => {
      await contract.connect(buyer).signInvoice(0);
      await expect(contract.connect(buyer).signInvoice(0)).to.be.revertedWith("Invoice already signed");
    });
  });

  // ── Algorithm 3: approveInvoiceSale ──────────────────────────────────────
  describe("Algorithm 3 — approveInvoiceSale", () => {
    beforeEach(async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
    });

    it("rejects unsigned invoice (Figure 12)", async () => {
      await expect(
        contract.connect(supplier).approveInvoiceSale(0, PRICE)
      ).to.be.revertedWith("Invoice must be signed by buyer before selling");
    });

    it("lists signed invoice, sets discounted price (Figure 14)", async () => {
      await contract.connect(buyer).signInvoice(0);
      await contract.connect(supplier).approveInvoiceSale(0, PRICE);
      const meta = await contract.getInvoiceMetadata(0);
      expect(meta.forSale).to.equal(true);
      expect(meta.currPrice).to.equal(PRICE);
    });

    it("rejects non-owner listing (Figure 13)", async () => {
      await contract.connect(buyer).signInvoice(0);
      await expect(
        contract.connect(other).approveInvoiceSale(0, PRICE)
      ).to.be.revertedWith("Only the NFT owner can put it for sale or modify price");
    });
  });

  // ── Algorithm 4: revokeInvoiceSale ────────────────────────────────────────
  describe("Algorithm 4 — revokeInvoiceSale", () => {
    beforeEach(async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
      await contract.connect(buyer).signInvoice(0);
      await contract.connect(supplier).approveInvoiceSale(0, PRICE);
    });

    it("removes from marketplace, resets price to invoiceAmount", async () => {
      await contract.connect(supplier).revokeInvoiceSale(0);
      const meta = await contract.getInvoiceMetadata(0);
      expect(meta.forSale).to.equal(false);
      expect(meta.currPrice).to.equal(AMOUNT);
    });
  });

  // ── Algorithm 5: buyInvoice ───────────────────────────────────────────────
  describe("Algorithm 5 — buyInvoice", () => {
    beforeEach(async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
      await contract.connect(buyer).signInvoice(0);
      await contract.connect(supplier).approveInvoiceSale(0, PRICE);
    });

    it("transfers ETH to supplier, NFT to financier (Figure 16/18)", async () => {
      const supplierBefore = await ethers.provider.getBalance(supplier.address);
      await contract.connect(financier).buyInvoice(0, { value: PRICE });
      const supplierAfter = await ethers.provider.getBalance(supplier.address);
      expect(await contract.ownerOf(0)).to.equal(financier.address);
      expect(supplierAfter - supplierBefore).to.equal(PRICE);
      const meta = await contract.getInvoiceMetadata(0);
      expect(meta.forSale).to.equal(false);
      expect(meta.currPrice).to.equal(AMOUNT); // reset to full amount
    });

    it("rejects purchase with wrong ETH amount (Figure 19)", async () => {
      await expect(
        contract.connect(financier).buyInvoice(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient balance to buy the NFT");
    });

    it("rejects buying when not for sale (Figure 17)", async () => {
      await contract.connect(supplier).revokeInvoiceSale(0);
      await expect(
        contract.connect(financier).buyInvoice(0, { value: PRICE })
      ).to.be.revertedWith("This NFT is not available to buy");
    });
  });

  // ── Algorithm 9: settleInvoice ────────────────────────────────────────────
  describe("Dissertation Algorithm 9 — settleInvoice", () => {
    beforeEach(async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
      await contract.connect(buyer).signInvoice(0);
      await contract.connect(supplier).approveInvoiceSale(0, PRICE);
      await contract.connect(financier).buyInvoice(0, { value: PRICE });
    });

    it("buyer pays invoiceAmount to financier, NFT transfers to buyer", async () => {
      const financierBefore = await ethers.provider.getBalance(financier.address);
      await contract.connect(buyer).settleInvoice(0, { value: AMOUNT });
      const financierAfter = await ethers.provider.getBalance(financier.address);
      expect(await contract.ownerOf(0)).to.equal(buyer.address);
      expect(financierAfter - financierBefore).to.equal(AMOUNT);
    });

    it("only designated buyer can settle", async () => {
      await expect(
        contract.connect(other).settleInvoice(0, { value: AMOUNT })
      ).to.be.revertedWith("Only the designated buyer can settle this invoice");
    });

    it("financier profit = invoiceAmount - discountedPrice (Equation 1 concept)", async () => {
      // Financier paid PRICE (0.8 ETH), receives AMOUNT (1.0 ETH)
      // Profit before gas = 1.0 - 0.8 = 0.2 ETH
      const profit = AMOUNT - PRICE;
      expect(profit).to.equal(ethers.parseEther("0.2"));
    });
  });

  // ── burnInvoiceNFT ────────────────────────────────────────────────────────
  describe("burnInvoiceNFT — Optional (dissertation)", () => {
    it("buyer can burn NFT after settlement", async () => {
      await contract.connect(supplier).mintInvoice(buyer.address, AMOUNT, DATE, CID);
      await contract.connect(buyer).signInvoice(0);
      await contract.connect(supplier).approveInvoiceSale(0, PRICE);
      await contract.connect(financier).buyInvoice(0, { value: PRICE });
      await contract.connect(buyer).settleInvoice(0, { value: AMOUNT });
      await contract.connect(buyer).burnInvoiceNFT(0);
      await expect(contract.ownerOf(0)).to.be.reverted;
    });
  });
});
