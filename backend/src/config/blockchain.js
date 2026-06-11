/**
 * blockchain.js — Blockchain connection configuration
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Section V (Experimental Setup):
 *   "Ether.js and Web3.js, the modules from Node.js was utilised to establish
 *    communication with the Sepolia blockchain network"
 *
 * This file provides:
 *   - getReadOnlyProvider()    — for reading data (no signing needed)
 *   - getReadOnlyContract()    — contract instance for view calls
 *   - getContractWithSigner()  — contract instance that can send transactions
 *
 * No database — all data lives on the blockchain (paper design philosophy).
 */

"use strict";

const { ethers } = require("ethers");
const fs   = require("fs");
const path = require("path");

// ─── Load ABI and Contract Address ──────────────────────────────────────────
// These files are created by deploy.js automatically after deployment

const contractsDir  = path.join(__dirname, "../contracts");
const abiPath       = path.join(contractsDir, "InvoiceNFT.json");
const addressPath   = path.join(contractsDir, "contractAddress.json");

function loadContractArtifacts() {
  if (!fs.existsSync(abiPath)) {
    throw new Error(
      "InvoiceNFT.json not found in backend/src/contracts/.\n" +
      "Run deployment first:\n" +
      "  cd smart-contract\n" +
      "  npx hardhat run scripts/deploy.js --network ganache"
    );
  }
  if (!fs.existsSync(addressPath)) {
    throw new Error(
      "contractAddress.json not found in backend/src/contracts/.\n" +
      "Run deployment first."
    );
  }

  const artifact       = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const addressData    = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  const contractAddress = process.env.CONTRACT_ADDRESS || addressData.address;

  if (!contractAddress || contractAddress === "0x_fill_after_deployment") {
    throw new Error(
      "CONTRACT_ADDRESS not set in .env and contractAddress.json is missing.\n" +
      "Deploy the contract first."
    );
  }

  return { abi: artifact.abi, address: contractAddress };
}

// ─── Provider factory ────────────────────────────────────────────────────────

function getProvider() {
  const network = process.env.NETWORK || "ganache";

  if (network === "sepolia") {
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    if (!rpcUrl || rpcUrl.includes("your_alchemy")) {
      throw new Error("SEPOLIA_RPC_URL not set in .env");
    }
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  // Default: Ganache local
  const ganacheUrl = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
  return new ethers.JsonRpcProvider(ganacheUrl);
}

// ─── Read-only contract (no signing — for GET endpoints) ─────────────────────

function getReadOnlyContract() {
  const provider          = getProvider();
  const { abi, address }  = loadContractArtifacts();
  return new ethers.Contract(address, abi, provider);
}

// ─── Signed contract (for write transactions) ────────────────────────────────
// privateKey: the caller's Ethereum private key
// Paper: Supplier, Buyer, Financier each have their own private key (Table 1)

function getContractWithSigner(privateKey) {
  if (!privateKey) {
    throw new Error("Private key is required to sign transactions");
  }

  const provider          = getProvider();
  const wallet            = new ethers.Wallet(privateKey, provider);
  const { abi, address }  = loadContractArtifacts();
  return new ethers.Contract(address, abi, wallet);
}

// ─── Utility: get signer address from private key ────────────────────────────

function getAddressFromPrivateKey(privateKey) {
  return new ethers.Wallet(privateKey).address;
}

// ─── Connection health check ─────────────────────────────────────────────────

async function checkConnection() {
  try {
    const provider  = getProvider();
    const network   = await provider.getNetwork();
    const blockNum  = await provider.getBlockNumber();
    return {
      connected:   true,
      networkName: network.name,
      chainId:     network.chainId.toString(),
      blockNumber: blockNum,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {
  getProvider,
  getReadOnlyContract,
  getContractWithSigner,
  getAddressFromPrivateKey,
  checkConnection,
  loadContractArtifacts,
};
