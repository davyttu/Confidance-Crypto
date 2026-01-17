// src/lib/contracts/addresses.ts

// ⚠️ ANCIENNE factory unique (conservée pour compatibilité / legacy)
export const FACTORY_ADDRESS = "0x88530C2f1A77BD8eb69caf91816E42982d25aa6C";

// ✅ NOUVELLES factories (Base Mainnet)
export const PAYMENT_FACTORY_SCHEDULED =
  "0x479eFA3f706373a676F4489850bd414855D0941d";

export const PAYMENT_FACTORY_RECURRING =
  "0xf0B85B0F560bC560bee804272e27D74c4Bcf0a26";

export const PAYMENT_FACTORY_INSTANT =
  "0xF8AE1807C9a6Ed4C25cd59513825277A8e8F0368";

// (Optionnel) — gestion multi-réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    // ⚠️ legacy (ne plus utiliser pour les nouveaux paiements)
    factory: "0x88530C2f1A77BD8eb69caf91816E42982d25aa6C",

    // ✅ nouvelles factories
    factory_scheduled: "0x479eFA3f706373a676F4489850bd414855D0941d",
    factory_recurring: "0xf0B85B0F560bC560bee804272e27D74c4Bcf0a26",
    factory_instant: "0xF8AE1807C9a6Ed4C25cd59513825277A8e8F0368",
  },

  base_sepolia: {
    // placeholders testnet
    factory: "0x0000000000000000000000000000000000000000",
    factory_scheduled: "0x0000000000000000000000000000000000000000",
    factory_recurring: "0x0000000000000000000000000000000000000000",
    factory_instant: "0x0000000000000000000000000000000000000000",
  },
};
