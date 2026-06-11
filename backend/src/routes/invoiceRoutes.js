/**
 * invoiceRoutes.js — REST API routes for all invoice operations
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section V: "API Development: Express.js facilitated the creation of API endpoints,
 *             enabling communication between the client-side and server-side components"
 * Section VI: "API Testing: Postman was utilized for testing API calls"
 *
 * Routes:
 *   POST /api/invoices/mint                     → Algorithm 1 (mintInvoice)
 *   POST /api/invoices/:tokenId/sign            → Algorithm 2 (signInvoice)
 *   POST /api/invoices/:tokenId/approve-sale    → Algorithm 3 (approveInvoiceSale)
 *   POST /api/invoices/:tokenId/revoke-sale     → Algorithm 4 (revokeInvoiceSale)
 *   POST /api/invoices/:tokenId/buy             → Algorithm 5 (buyInvoice)
 *   POST /api/invoices/:tokenId/settle          → Dissertation Algorithm 9
 *   POST /api/invoices/:tokenId/burn            → Dissertation (optional)
 *   GET  /api/invoices/:tokenId                 → Read from blockchain (no DB)
 *   POST /api/invoices/profit-calculator        → Equation 1 from paper
 *
 * IMPORTANT: /profit-calculator route is registered BEFORE /:tokenId
 *            to prevent Express matching "profit-calculator" as a tokenId.
 */

"use strict";

const express = require("express");
const multer  = require("multer");
const router  = express.Router();

const {
  mintInvoice,
  signInvoice,
  approveInvoiceSale,
  revokeInvoiceSale,
  buyInvoice,
  settleInvoice,
  burnInvoiceNFT,
  getInvoiceMetadata,
  calculateProfit,
} = require("../services/contractService");

const { uploadToIPFS, getIPFSUrl } = require("../services/ipfsService");

// ─── Multer: PDF upload handler ───────────────────────────────────────────────
// Paper: invoice document stored on IPFS, not in any database
const upload = multer({
  storage: multer.memoryStorage(),    // hold in memory → upload to IPFS
  limits:  { fileSize: 10 * 1024 * 1024 },   // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed for invoice documents"));
    }
    cb(null, true);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static routes MUST come before /:tokenId param route.
// If /profit-calculator is registered after /:tokenId, Express will treat
// "profit-calculator" as a tokenId and parseInt("profit-calculator") = NaN.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Profit Calculator — Equation 1 ──────────────────────────────────────────
/**
 * POST /api/invoices/profit-calculator
 *
 * Implements Equation 1 from paper Section VII-A:
 *   Profit = (I × R × T) / (100 × 365) − G
 *
 * Body:
 *   invoiceAmountEth    — Invoice amount in ETH (I)
 *   discountRatePercent — Discount rate % (R), e.g. 5 for 5%
 *   daysUntilDue        — Days until invoice is due (T)
 *   gasFeesEth          — Estimated gas fees in ETH (G)
 *                         Paper Table 2: Financier pays ~0.000263 ETH total
 *
 * Paper note: discount rate has highest influence on profitability slope (Figure 20)
 */
router.post("/profit-calculator", (req, res, next) => {
  try {
    const { invoiceAmountEth, discountRatePercent, daysUntilDue, gasFeesEth } = req.body;

    if (!invoiceAmountEth || !discountRatePercent || !daysUntilDue || !gasFeesEth) {
      return res.status(400).json({
        error: "All four fields required: invoiceAmountEth, discountRatePercent, daysUntilDue, gasFeesEth",
        example: {
          invoiceAmountEth:    "1.0",
          discountRatePercent: "5",
          daysUntilDue:        "30",
          gasFeesEth:          "0.000263",
        },
      });
    }

    const result = calculateProfit({
      invoiceAmountEth,
      discountRatePercent,
      daysUntilDue,
      gasFeesEth,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Mint Invoice NFT — Algorithm 1 ──────────────────────────────────────────
/**
 * POST /api/invoices/mint
 * Content-Type: multipart/form-data
 *
 * Body (form-data):
 *   invoicePDF       (file)   — PDF invoice document
 *   buyerAddress     (text)   — Ethereum address of buyer
 *   invoiceAmountEth (text)   — Invoice amount in ETH
 *   dueDate          (text)   — Due date (YYYY-MM-DD)
 *   callerType       (text)   — "supplier" | "buyer" | "financier"
 *   callerPrivateKey (text)   — Optional: override with specific private key
 *
 * Postman test: paper Figure 7 (successful mint), Figure 8 (duplicate rejection)
 */
router.post("/mint", upload.single("invoicePDF"), async (req, res, next) => {
  try {
    const {
      buyerAddress,
      invoiceAmountEth,
      dueDate,
      callerType       = "supplier",
      callerPrivateKey,
    } = req.body;

    // Validation
    if (!req.file)          return res.status(400).json({ error: "invoicePDF (PDF file) is required" });
    if (!buyerAddress)      return res.status(400).json({ error: "buyerAddress is required" });
    if (!invoiceAmountEth)  return res.status(400).json({ error: "invoiceAmountEth is required" });
    if (!dueDate)           return res.status(400).json({ error: "dueDate is required (YYYY-MM-DD)" });

    // Step 1: Upload PDF to IPFS — CID is the unique hash of the invoice
    // Paper: "uploading the invoice document to IPFS to obtain its unique hash"
    let ipfsCID;
    try {
      ipfsCID = await uploadToIPFS(req.file.buffer, req.file.originalname);
    } catch (ipfsErr) {
      return res.status(502).json({
        error:  "IPFS upload failed: " + ipfsErr.message,
        hint:   "Check WEB3_STORAGE_TOKEN in .env — get free token at https://web3.storage",
      });
    }

    // Step 2: Mint NFT on blockchain (Algorithm 1)
    // Duplicate CID check happens inside the smart contract — will revert if already minted
    const result = await mintInvoice({
      buyerAddress,
      invoiceAmountEth,
      dueDate,
      ipfsCID,
      callerType,
      callerPrivateKey,
    });

    res.status(201).json({
      message:       "Invoice NFT minted successfully",
      source:        "blockchain",
      algorithm:     "Algorithm 1 — mintInvoice (Section IV-B-1)",
      isApproved:    false,
      forSale:       false,
      ownership:     "Supplier",
      ...result,
    });

  } catch (err) {
    next(err);
  }
});

// ─── Sign Invoice — Algorithm 2 ───────────────────────────────────────────────
/**
 * POST /api/invoices/:tokenId/sign
 *
 * Called by: Buyer ONLY
 * Body: { callerType: "buyer", callerPrivateKey? }
 *
 * Sets isApproved=true. NFT gains intrinsic value = invoice amount.
 * Postman test: paper Figure 10 (wrong buyer rejected), Figure 11 (success)
 */
router.post("/:tokenId/sign", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const { callerType = "buyer", callerPrivateKey } = req.body;

    const result = await signInvoice({ tokenId, callerType, callerPrivateKey });

    res.json({
      message:    "Invoice signed successfully by buyer",
      source:     "blockchain",
      algorithm:  "Algorithm 2 — signInvoice (Section IV-B-2)",
      isApproved: true,
      ownership:  "Supplier (unchanged — buyer only approves)",
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Approve Invoice for Sale — Algorithm 3 ───────────────────────────────────
/**
 * POST /api/invoices/:tokenId/approve-sale
 *
 * Called by: Supplier (NFT owner)
 * Body: { newSellingPriceEth, callerType: "supplier", callerPrivateKey? }
 *
 * THIS is invoice discounting: supplier sets price < invoiceAmount.
 * Postman test: paper Figure 12 (unsigned invoice rejected), Figure 14 (success)
 */
router.post("/:tokenId/approve-sale", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const {
      newSellingPriceEth,
      callerType       = "supplier",
      callerPrivateKey,
    } = req.body;

    if (!newSellingPriceEth) {
      return res.status(400).json({
        error:   "newSellingPriceEth is required",
        hint:    "Set this below invoiceAmount — this is the discount (e.g. 0.8 for an invoice worth 1.0 ETH)",
      });
    }

    const result = await approveInvoiceSale({
      tokenId,
      newSellingPriceEth,
      callerType,
      callerPrivateKey,
    });

    res.json({
      message:   "Invoice listed for sale in marketplace",
      source:    "blockchain",
      algorithm: "Algorithm 3 — approveInvoiceSale (Section IV-B-3)",
      forSale:   true,
      ownership: "Supplier (unchanged — now visible to financiers)",
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Revoke Invoice Sale — Algorithm 4 ────────────────────────────────────────
/**
 * POST /api/invoices/:tokenId/revoke-sale
 *
 * Called by: NFT owner
 * Body: { callerType: "supplier", callerPrivateKey? }
 *
 * Removes NFT from marketplace. forSale=false, price reset to invoiceAmount.
 */
router.post("/:tokenId/revoke-sale", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const { callerType = "supplier", callerPrivateKey } = req.body;

    const result = await revokeInvoiceSale({ tokenId, callerType, callerPrivateKey });

    res.json({
      message:   "Invoice removed from marketplace",
      source:    "blockchain",
      algorithm: "Algorithm 4 — revokeInvoiceSale (Section IV-B-3)",
      forSale:   false,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Buy Invoice — Algorithm 5 ────────────────────────────────────────────────
/**
 * POST /api/invoices/:tokenId/buy
 *
 * Called by: Financier
 * Body: { callerType: "financier", callerPrivateKey? }
 *
 * ETH (= currPrice) sent automatically from backend wallet.
 * Paper example (Figure 16): tokenId=28, 0.008 ETH transferred Financier→Supplier
 * Postman test: paper Figure 17 (not for sale → rejected), Figure 19 (insufficient balance)
 */
router.post("/:tokenId/buy", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const { callerType = "financier", callerPrivateKey } = req.body;

    const result = await buyInvoice({ tokenId, callerType, callerPrivateKey });

    res.json({
      message:   "Invoice NFT purchased successfully",
      source:    "blockchain",
      algorithm: "Algorithm 5 — buyInvoice (Section IV-B-4)",
      ownership: "Financier (1st ownership transfer)",
      note:      "Financier will receive full invoiceAmount on due date via settleInvoice",
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Settle Invoice — Dissertation Algorithm 9 ────────────────────────────────
/**
 * POST /api/invoices/:tokenId/settle
 *
 * Called by: Buyer (on or after due date)
 * Body: { callerType: "buyer", callerPrivateKey? }
 *
 * ETH (= invoiceAmount, NOT discounted price) → Financier
 * NFT ownership → Buyer (final transfer)
 * Financier profit = invoiceAmount - discountedPrice - gasFees (Equation 1)
 */
router.post("/:tokenId/settle", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const { callerType = "buyer", callerPrivateKey } = req.body;

    const result = await settleInvoice({ tokenId, callerType, callerPrivateKey });

    res.json({
      message:   "Invoice settled successfully",
      source:    "blockchain",
      algorithm: "Dissertation Algorithm 9 — settleInvoice",
      ownership: "Buyer (2nd and final ownership transfer)",
      note:      "Financier has received full invoice amount. Buyer can now optionally burn NFT.",
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Burn Invoice NFT — Dissertation ──────────────────────────────────────────
/**
 * POST /api/invoices/:tokenId/burn
 *
 * Called by: Buyer (after settlement — OPTIONAL)
 * Body: { callerType: "buyer", callerPrivateKey? }
 *
 * Paper: "Buyer can choose to keep NFT as proof of payment OR burn it — buyer's own choice"
 */
router.post("/:tokenId/burn", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const { callerType = "buyer", callerPrivateKey } = req.body;

    const result = await burnInvoiceNFT({ tokenId, callerType, callerPrivateKey });

    res.json({
      message:   "Invoice NFT burned permanently",
      source:    "blockchain",
      note:      "Buyer chose to burn NFT (dissertation: optional step after settlement)",
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Get Invoice Metadata — Read from Blockchain ──────────────────────────────
/**
 * GET /api/invoices/:tokenId
 *
 * Returns full InvoiceMetadata struct (Figure 5) from blockchain.
 * NO DATABASE — blockchain is the only source of truth (paper design philosophy).
 *
 * Postman test: paper Figure 9 (after mint), Figure 11 (after sign), Figure 14 (after list)
 */
router.get("/:tokenId", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const data = await getInvoiceMetadata(tokenId);

    res.json({
      source:    "blockchain",
      note:      "All data read directly from Ethereum blockchain — no database (paper design)",
      struct:    "InvoiceMetadata (Figure 5 of IEEE paper)",
      data,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
