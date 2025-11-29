// src/lib/contracts/addresses.ts

// Adresse de la PaymentFactory déployée sur Base Mainnet
export const FACTORY_ADDRESS = "0x7F80CB9c88b1993e8267dab207f33EDf8f4ef744";

// (Optionnel) — si plus tard tu veux gérer plusieurs réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    factory: FACTORY_ADDRESS,
  },
  base_sepolia: {
    factory: "0x0000000000000000000000000000000000000000", // placeholder testnet
  },
};
