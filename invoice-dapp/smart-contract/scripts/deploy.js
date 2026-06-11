/**
 * Deployment script for InvoiceNFT smart contract
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Deploys to Sepolia testnet (paper) or Ganache (local dev).
 * Saves ABI + contract address to backend/src/contracts/ so the
 * Node.js backend can connect to it immediately after deployment.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network ganache
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * After Sepolia deploy, verify on Etherscan (as seniors did):
 *   npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("InvoiceNFT — NFT-based Invoice Discounting DApp");
  console.log("PES University / IEEE Paper Replica");
  console.log("=".repeat(60));
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  console.log("Network:", hre.network.name);
  console.log("-".repeat(60));

  // Deploy
  const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
  const contract   = await InvoiceNFT.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ InvoiceNFT deployed to:", address);

  // Read ABI from compiled artifact
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/InvoiceNFT.sol/InvoiceNFT.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Output directory — backend reads ABI and address from here
  const outputDir = path.join(__dirname, "../../backend/src/contracts");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save full ABI (backend ethers.js needs this)
  fs.writeFileSync(
    path.join(outputDir, "InvoiceNFT.json"),
    JSON.stringify(artifact, null, 2)
  );

  // Save contract address + network info
  const addressData = {
    address,
    network:     hre.network.name,
    deployedAt:  new Date().toISOString(),
    deployedBy:  deployer.address,
  };
  fs.writeFileSync(
    path.join(outputDir, "contractAddress.json"),
    JSON.stringify(addressData, null, 2)
  );

  console.log("✅ ABI and address saved to backend/src/contracts/");
  console.log("-".repeat(60));

  // Print summary matching paper Table 1 format
  console.log("CONTRACT DETAILS:");
  console.log("  Contract Address:", address);
  console.log("  Network:         ", hre.network.name);
  console.log("  Token Name:       InvoiceNFT");
  console.log("  Token Symbol:     INV");
  console.log("  ERC Standard:     ERC-721");
  console.log("-".repeat(60));

  if (hre.network.name === "sepolia") {
    console.log("To verify on Etherscan (as done in the paper):");
    console.log(`  npx hardhat verify --network sepolia ${address}`);
    console.log(`  https://sepolia.etherscan.io/address/${address}`);
  }

  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
