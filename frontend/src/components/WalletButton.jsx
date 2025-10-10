import React, { useState } from "react";
import { ethers } from "ethers";

const WalletButton = () => {
  const [address, setAddress] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Veuillez installer MetaMask pour continuer.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts[0]);
    } catch (err) {
      console.error("Erreur de connexion :", err);
    }
  };

  const truncateAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <button
      onClick={connectWallet}
      className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-md"
    >
      {address ? truncateAddress(address) : "🔗 Connecter mon wallet"}
    </button>
  );
};

export default WalletButton;
