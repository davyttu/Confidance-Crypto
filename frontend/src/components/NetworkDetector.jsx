import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

const NETWORKS = {
  1116: {
    name: "Core DAO Mainnet",
    symbol: "CORE",
    rpc: "https://rpc.coredao.org",
    explorer: "https://scan.coredao.org",
    tokens: {
      usdt: "0xYourUSDTcoreAddress",
      usdc: "0xYourUSDCcoreAddress",
    },
  },
  1115: {
    name: "Core DAO Testnet",
    symbol: "tCORE",
    rpc: "https://rpc.test.btcs.network",
    explorer: "https://scan.test.btcs.network",
    tokens: {
      usdt: "0xYourUSDTtestAddress",
      usdc: "0xYourUSDCtestAddress",
    },
  },
  1: {
    name: "Ethereum Mainnet",
    symbol: "ETH",
    rpc: "https://mainnet.infura.io/v3/",
    explorer: "https://etherscan.io",
    tokens: {
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      usdc: "0xA0b86991C6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
  },
  56: {
    name: "Binance Smart Chain",
    symbol: "BNB",
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    tokens: {
      usdt: "0x55d398326f99059fF775485246999027B3197955",
      usdc: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    },
  },
  137: {
    name: "Polygon Mainnet",
    symbol: "MATIC",
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    tokens: {
      usdt: "0xc2132D05D31c914a87C6611C10748AaCbAFCdAaD",
      usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    },
  },
};

export default function NetworkDetector({ onNetworkChange }) {
  const [network, setNetwork] = useState(null);
  const [chainId, setChainId] = useState(null);

  useEffect(() => {
    async function detectNetwork() {
      if (!window.ethereum) {
        setNetwork({ name: "Aucun wallet détecté" });
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      const id = Number(net.chainId);
      setChainId(id);

      const netInfo = NETWORKS[id] || { name: "Réseau non supporté" };
      setNetwork(netInfo);

      // Envoie les infos au parent (optionnel)
      if (onNetworkChange) onNetworkChange({ id, ...netInfo });

      // Écoute les changements
      window.ethereum.on("chainChanged", (chain) => {
        window.location.reload();
      });
    }

    detectNetwork();
  }, [onNetworkChange]);

  // Bouton pour ajouter Core DAO si non présent
  const addCoreNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x45C", // 1116
            chainName: "Core DAO Mainnet",
            rpcUrls: ["https://rpc.coredao.org"],
            nativeCurrency: { name: "Core", symbol: "CORE", decimals: 18 },
            blockExplorerUrls: ["https://scan.coredao.org"],
          },
        ],
      });
    } catch (err) {
      console.error("Erreur d’ajout du réseau :", err);
    }
  };

  return (
    <div className="p-4 rounded-2xl shadow-md bg-gray-900 text-white w-full max-w-md mx-auto mt-4">
      <h2 className="text-xl font-semibold mb-2">🌐 Réseau détecté</h2>
      {network ? (
        <>
          <p className="text-lg">{network.name}</p>
          {network.name.includes("non supporté") && (
            <button
              onClick={addCoreNetwork}
              className="mt-3 px-3 py-2 bg-yellow-500 rounded-lg hover:bg-yellow-600"
            >
              ➕ Ajouter Core DAO à MetaMask
            </button>
          )}
          {network.tokens && (
            <div className="mt-3 text-sm text-gray-300">
              <p>USDT : {network.tokens.usdt}</p>
              <p>USDC : {network.tokens.usdc}</p>
            </div>
          )}
        </>
      ) : (
        <p>Détection du réseau en cours...</p>
      )}
    </div>
  );
}
