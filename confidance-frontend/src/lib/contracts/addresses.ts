// src/lib/contracts/addresses.ts

// Adresse de la PaymentFactory déployée sur Base Mainnet (V3 FIXÉE - Constructor Balance Check)
export const FACTORY_ADDRESS = "0x88530C2f1A77BD8eb69caf91816E42982d25aa6C";

// (Optionnel) — si plus tard tu veux gérer plusieurs réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    factory: "0x88530C2f1A77BD8eb69caf91816E42982d25aa6C", // V3 FIXÉE avec Instant Payments
  },
  base_sepolia: {
    factory: "0x0000000000000000000000000000000000000000", // placeholder testnet
  },
};
