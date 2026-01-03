// src/lib/contracts/addresses.ts

// Adresse de la PaymentFactory déployée sur Base Mainnet (V2 avec Instant Payments)
export const FACTORY_ADDRESS = "0x88Da5f28c4d5b7392812dB67355d72D21516bCaf";

// (Optionnel) — si plus tard tu veux gérer plusieurs réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    factory: "0x88Da5f28c4d5b7392812dB67355d72D21516bCaf", // V2 avec Instant Payments
  },
  base_sepolia: {
    factory: "0x0000000000000000000000000000000000000000", // placeholder testnet
  },
};
