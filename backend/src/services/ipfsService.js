/**
 * ipfsService.js — IPFS integration via web3.storage
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section V (Experimental Setup):
 *   "IPFS Integration: Invoice documents, Non-Fungible Tokens (NFTs), and
 *    associated metadata were stored on the Inter Planetary File System (IPFS),
 *    with integration facilitated through Node.js using web3storage.js module."
 *
 * Section II-D: IPFS properties used in this system:
 *   - Content-addressed: unique CID per file (enables duplicate CID check in Algorithm 1)
 *   - Decentralized: no single point of failure
 *   - Deduplication: same file = same CID (core anti-fraud mechanism)
 *
 * The IPFS CID is what gets stored in the smart contract as the tokenURI.
 * Financiers can view the invoice document by opening: <gateway>/ipfs/<CID>
 */

"use strict";

const { Web3Storage, File } = require("web3.storage");

// ─── Client singleton ────────────────────────────────────────────────────────

let _client = null;

function getWeb3StorageClient() {
  if (_client) return _client;

  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token || token === "your_web3storage_api_token") {
    throw new Error(
      "WEB3_STORAGE_TOKEN not set in .env.\n" +
      "Get your free token from https://web3.storage"
    );
  }
  _client = new Web3Storage({ token });
  return _client;
}

// ─── Upload invoice PDF to IPFS ──────────────────────────────────────────────
/**
 * Uploads an invoice PDF buffer to IPFS via web3.storage.
 * Returns the CID (Content Identifier) — a unique hash of the file content.
 *
 * Key paper property: identical files produce identical CIDs.
 * This is how Algorithm 1's duplicate-CID check prevents double-spending —
 * if a supplier tries to mint the same invoice twice, the CID already
 * exists in the contract and the transaction reverts.
 *
 * @param {Buffer} fileBuffer  — PDF file buffer from multer
 * @param {string} filename    — original filename (e.g. "invoice_001.pdf")
 * @returns {string} IPFS CID
 */
async function uploadToIPFS(fileBuffer, filename) {
  const client = getWeb3StorageClient();

  // Create a File object (web3.storage expects File, not Buffer)
  const file = new File([fileBuffer], filename, { type: "application/pdf" });

  // Upload and get CID
  const cid = await client.put([file], {
    name:      filename,
    wrapWithDirectory: false,  // CID points directly to the file
  });

  return cid;
}

// ─── Build IPFS gateway URL ──────────────────────────────────────────────────
/**
 * Converts a CID to a publicly accessible IPFS gateway URL.
 * Financiers use this to view the invoice PDF before buying.
 *
 * @param {string} cid  — IPFS Content Identifier
 * @returns {string}    — Full URL to view/download the invoice PDF
 */
function getIPFSUrl(cid) {
  const gateway = process.env.IPFS_GATEWAY || "https://w3s.link/ipfs";
  return `${gateway}/${cid}`;
}

// ─── Check if CID already exists on-chain ────────────────────────────────────
/**
 * Fast duplicate CID check against the blockchain.
 * Called before uploading to IPFS to save upload time/cost.
 * Enhancement #4 from our additions — faster than waiting for contract revert.
 *
 * @param {string} cid       — IPFS CID to check
 * @param {object} contract  — read-only contract instance
 * @returns {boolean}
 */
async function checkCIDExistsOnChain(cid, contract) {
  try {
    return await contract.cidExists(cid);
  } catch {
    return false;
  }
}

module.exports = {
  uploadToIPFS,
  getIPFSUrl,
  checkCIDExistsOnChain,
};
