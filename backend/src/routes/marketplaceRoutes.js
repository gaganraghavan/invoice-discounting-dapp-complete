/**
 * marketplaceRoutes.js — Marketplace API (browse available invoice NFTs)
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section IV-B-3: "Financiers browse marketplace" to find invoices with forSale=true.
 * Section IV-A: "Unified Interface System" — all three parties use the same dashboard.
 *
 * Routes:
 *   GET /api/marketplace          → All invoices currently for sale
 *   GET /api/marketplace/all      → All minted invoices (full history)
 *   GET /api/marketplace/:tokenId → Single listing detail
 *
 * Data source: InvoiceMinted events from blockchain + on-chain metadata reads.
 * NO DATABASE — blockchain is the only source of truth.
 */

"use strict";

const express        = require("express");
const router         = express.Router();
const { ethers }     = require("ethers");
const { getReadOnlyContract } = require("../config/blockchain");
const { getIPFSUrl }          = require("../services/ipfsService");

// ─── Helper: enrich a tokenId with full metadata ─────────────────────────────
async function enrichToken(contract, tokenId, ipfsCID) {
  let meta, owner;
  try {
    meta  = await contract.getInvoiceMetadata(tokenId);
    owner = await contract.ownerOf(tokenId);
  } catch {
    return null;  // Token may have been burned
  }

  return {
    tokenId,
    // Figure 5 metadata fields
    creator:       meta.creator,
    buyer:         meta.buyer,
    currentOwner:  owner,
    currPrice:     ethers.formatEther(meta.currPrice),
    invoiceAmount: ethers.formatEther(meta.invoiceAmount),
    dueDate:       meta.dueDate,
    isApproved:    meta.isApproved,
    forSale:       meta.forSale,
    // IPFS data
    ipfsCID:       ipfsCID || null,
    ipfsUrl:       ipfsCID ? getIPFSUrl(ipfsCID) : null,
    // Ownership stage (for UI display)
    stage:         getOwnershipStage(meta, owner, meta.creator, meta.buyer),
  };
}

/**
 * Determines current stage of the invoice lifecycle.
 * Maps to the complete ownership journey from the paper:
 *   Minted → Signed → Listed → Purchased → Settled → (Burned)
 */
function getOwnershipStage(meta, owner, creator, buyer) {
  if (!meta.isApproved && !meta.forSale) return "MINTED_UNSIGNED";
  if (meta.isApproved  && !meta.forSale && owner.toLowerCase() === creator.toLowerCase())
    return "SIGNED_NOT_LISTED";
  if (meta.forSale)
    return "LISTED_FOR_SALE";
  if (
    owner.toLowerCase() !== creator.toLowerCase() &&
    owner.toLowerCase() !== buyer.toLowerCase()
  )
    return "PURCHASED_BY_FINANCIER";
  if (owner.toLowerCase() === buyer.toLowerCase())
    return "SETTLED_OWNED_BY_BUYER";
  return "UNKNOWN";
}

// ─── GET /api/marketplace — Invoices currently for sale ───────────────────────
/**
 * Reads InvoiceMinted events from blockchain, then checks forSale on each.
 * Returns only those where forSale=true.
 *
 * This is what financiers browse to find investment opportunities.
 * Paper Section IV (flow): "Financiers browse marketplace"
 */
router.get("/", async (req, res, next) => {
  try {
    const contract = getReadOnlyContract();

    const filter = contract.filters.InvoiceMinted();
    const events = await contract.queryFilter(filter);

    const listings = [];

    for (const event of events) {
      const tokenId = Number(event.args.tokenId);
      const ipfsCID = event.args.ipfsCID;

      const enriched = await enrichToken(contract, tokenId, ipfsCID);
      if (enriched && enriched.forSale) {
        listings.push(enriched);
      }
    }

    res.json({
      source:   "blockchain",
      note:     "All data read from Ethereum blockchain — no database",
      count:    listings.length,
      listings,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/marketplace/all — All minted invoices (complete history) ────────
/**
 * Returns all invoices ever minted — regardless of status.
 * Useful for audit trail (paper: "immutable record of invoices and transactions")
 */
router.get("/all", async (req, res, next) => {
  try {
    const contract = getReadOnlyContract();

    const filter = contract.filters.InvoiceMinted();
    const events = await contract.queryFilter(filter);

    const allInvoices = [];

    for (const event of events) {
      const tokenId = Number(event.args.tokenId);
      const ipfsCID = event.args.ipfsCID;

      const enriched = await enrichToken(contract, tokenId, ipfsCID);
      if (enriched) {
        // Add mint transaction info
        enriched.mintedAt    = new Date(Number(event.args[3] || 0) * 1000).toISOString();
        enriched.mintTxHash  = event.transactionHash;
        enriched.mintBlock   = event.blockNumber;
        allInvoices.push(enriched);
      } else {
        // Burned token — still show in history
        allInvoices.push({
          tokenId,
          ipfsCID,
          ipfsUrl:    ipfsCID ? getIPFSUrl(ipfsCID) : null,
          status:     "BURNED",
          mintTxHash: event.transactionHash,
          mintBlock:  event.blockNumber,
        });
      }
    }

    res.json({
      source:      "blockchain",
      note:        "Complete invoice history — blockchain provides immutable audit trail (paper Section VII-B)",
      totalMinted: allInvoices.length,
      invoices:    allInvoices,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/marketplace/:tokenId — Single invoice detail ────────────────────
/**
 * Returns full detail for a specific tokenId including IPFS link.
 * Financiers use this to inspect an invoice before buying.
 * Paper: "Financier can check buyer details, due date, invoice amount,
 *         CMP of the NFT, and view the invoice document via IPFS hash"
 */
router.get("/:tokenId", async (req, res, next) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) return res.status(400).json({ error: "Invalid tokenId" });

    const contract = getReadOnlyContract();

    // Get the IPFS CID from InvoiceMinted event log
    const filter = contract.filters.InvoiceMinted();
    const events = await contract.queryFilter(filter);
    const event  = events.find((e) => Number(e.args.tokenId) === tokenId);

    const ipfsCID  = event ? event.args.ipfsCID : null;
    const enriched = await enrichToken(contract, tokenId, ipfsCID);

    if (!enriched) {
      return res.status(404).json({ error: `Token ${tokenId} not found or has been burned` });
    }

    if (event) {
      enriched.mintTxHash = event.transactionHash;
      enriched.mintBlock  = event.blockNumber;
    }

    res.json({
      source: "blockchain",
      note:   "Data read directly from Ethereum blockchain — no database",
      data:   enriched,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
