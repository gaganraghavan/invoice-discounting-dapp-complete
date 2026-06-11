/**
 * app.js — Main Express.js application entry point
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section V (Experimental Setup):
 *   "Server Development: Node.js was employed for server-side development"
 *   "API Development: Express.js facilitated the creation of API endpoints"
 *   "API Testing: Postman was utilized for testing API calls"
 *
 * All routes read/write directly from blockchain — no database (paper design).
 */

"use strict";

require("dotenv").config();

const express           = require("express");
const cors              = require("cors");
const invoiceRoutes     = require("./routes/invoiceRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const errorHandler      = require("./middleware/errorHandler");
const { checkConnection } = require("./config/blockchain");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
/**
 * GET /health
 * Returns server status + blockchain connection info.
 * Useful for Postman smoke test before running algorithm tests.
 */
app.get("/health", async (req, res) => {
  const blockchain = await checkConnection();
  res.json({
    status:     "ok",
    server:     "Invoice Discounting DApp — PES University",
    paper:      "A Non-Fungible Token Based Approach to Invoice Discounting (IEEE)",
    network:    process.env.NETWORK || "ganache",
    port:       PORT,
    blockchain,
    timestamp:  new Date().toISOString(),
    endpoints: {
      mint:           "POST /api/invoices/mint",
      sign:           "POST /api/invoices/:tokenId/sign",
      approveSale:    "POST /api/invoices/:tokenId/approve-sale",
      revokeSale:     "POST /api/invoices/:tokenId/revoke-sale",
      buy:            "POST /api/invoices/:tokenId/buy",
      settle:         "POST /api/invoices/:tokenId/settle",
      burn:           "POST /api/invoices/:tokenId/burn",
      getMetadata:    "GET  /api/invoices/:tokenId",
      profitCalc:     "POST /api/invoices/profit-calculator",
      marketplace:    "GET  /api/marketplace",
      allInvoices:    "GET  /api/marketplace/all",
      listingDetail:  "GET  /api/marketplace/:tokenId",
    },
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/invoices",    invoiceRoutes);
app.use("/api/marketplace", marketplaceRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log("=".repeat(60));
  console.log("  Invoice Discounting DApp — Backend Server");
  console.log("  PES University IEEE Paper Replica");
  console.log("=".repeat(60));
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  Network: ${process.env.NETWORK || "ganache"}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log("-".repeat(60));

  // Check blockchain connection on startup
  const conn = await checkConnection();
  if (conn.connected) {
    console.log(`  ✅ Blockchain connected`);
    console.log(`     Chain ID:    ${conn.chainId}`);
    console.log(`     Block:       ${conn.blockNumber}`);
  } else {
    console.log(`  ⚠️  Blockchain NOT connected: ${conn.error}`);
    console.log(`     Make sure Ganache is running on port 7545`);
    console.log(`     or set SEPOLIA_RPC_URL in .env`);
  }
  console.log("=".repeat(60));
});

module.exports = app;
