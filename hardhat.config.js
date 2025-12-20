require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  PRIVATE_KEY,
  CORE_MAINNET_RPC,
  CORE_TESTNET_RPC,
  BASE_RPC,
  BASE_SEPOLIA_RPC,
  SEPOLIA_RPC,
} = process.env;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,        // ← SEUL CHANGEMENT : 200 → 1 (optimisé taille)
      },
      viaIR: true,      // ← Tu as déjà ça, on le garde !
    },
  },
  networks: {
    core_mainnet: {
      url: CORE_MAINNET_RPC,
      accounts: [PRIVATE_KEY],
    },
    core_testnet: {
      url: CORE_TESTNET_RPC,
      accounts: [PRIVATE_KEY],
    },
    base_mainnet: {
      url: BASE_RPC || "https://mainnet.base.org",
      chainId: 8453,
      accounts: [PRIVATE_KEY],
      timeout: 60000,
    },
    base_sepolia: {
      url: BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      chainId: 84532,
      accounts: [PRIVATE_KEY],
    },
    sepolia: {
      url: SEPOLIA_RPC || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: process.env.BASESCAN_API_KEY || "",
    customChains: [
      {
        network: "base_mainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
};
