require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Hardhat configuration for InvoiceNFT DApp
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 *
 * Two networks as per paper experimental setup (Section V):
 *   - ganache: local testing (Ganache GUI, port 7545)
 *   - sepolia: Ethereum Sepolia testnet (paper used this for validation)
 *
 * Contract verified on Etherscan Sepolia as stated in paper Section VI-A.
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // Local Ganache network for development & testing
    ganache: {
      url: process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: [
        process.env.SUPPLIER_PRIVATE_KEY,
        process.env.BUYER_PRIVATE_KEY,
        process.env.FINANCIER_PRIVATE_KEY,
      ].filter(Boolean),
    },

    // Ethereum Sepolia testnet — used in the paper (Table 1 & 2 gas measurements)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 11155111,
    },
  },

  // Etherscan verification — paper states contract was verified on Etherscan Sepolia
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
