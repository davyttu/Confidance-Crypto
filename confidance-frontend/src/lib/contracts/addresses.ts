// src/lib/contracts/addresses.ts

// Adresse de la PaymentFactory déployée sur Base Mainnet
export const FACTORY_ADDRESS = "0x0C43FDad2D0947d4b28A432125c7aB8F0c85D32A";

// (Optionnel) — si plus tard tu veux gérer plusieurs réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    factory: FACTORY_ADDRESS,
  },
  base_sepolia: {
    factory: "0x0000000000000000000000000000000000000000", // placeholder testnet
  },
};
