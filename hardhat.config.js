require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  PRIVATE_KEY,
  CORE_MAINNET_RPC,
  CORE_TESTNET_RPC,
  BASE_RPC,
  BASE_SEPOLIA_RPC,
  SEPOLIA_RPC,

  // 👇 AJOUT (Polygon)
  POLYGON_RPC,
  POLYGONSCAN_API_KEY,
} = process.env;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, // Optimisé pour la taille du bytecode (minimum)
      },
      viaIR: true,
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

    // ===============================
    // 🟣 POLYGON MAINNET (AJOUT)
    // ===============================
    polygon_mainnet: {
      url: POLYGON_RPC || "https://polygon-rpc.com",
      chainId: 137,
      accounts: [PRIVATE_KEY],
      timeout: 60000,
    },
  },

  etherscan: {
    // ✅ API V2 - Utilise une seule clé API pour tous les réseaux
    apiKey: process.env.BASESCAN_API_KEY || "",
    customChains: [
      {
        network: "base_mainnet",
        chainId: 8453,
        urls: {
          // ✅ API V2 endpoint
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "polygon_mainnet",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com",
        },
      },
    ],
  },
};
