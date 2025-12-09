// src/lib/contracts/addresses.ts

// Adresse de la PaymentFactory déployée sur Base Mainnet
export const FACTORY_ADDRESS = "0xd8e57052142b62081687137c44C54F78306547f8";

// (Optionnel) — si plus tard tu veux gérer plusieurs réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    factory: FACTORY_ADDRESS,
  },
  base_sepolia: {
    factory: "0x0000000000000000000000000000000000000000", // placeholder testnet
  },
};
