// src/lib/contracts/addresses.ts

// ⚠️ ANCIENNE factory unique (conservée pour compatibilité / legacy)
export const FACTORY_ADDRESS = "0x88530C2f1A77BD8eb69caf91816E42982d25aa6C";

const getEnvAddress = (key: string, fallback: string) =>
  (process.env[key] as string | undefined) || fallback;

// ✅ NOUVELLES factories (Base Mainnet)
export const PAYMENT_FACTORY_SCHEDULED = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_SCHEDULED",
  "0x53D9F5d77155f9154791eF3221c74c8A2C394657"
);

export const PAYMENT_FACTORY_RECURRING = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_RECURRING",
  "0x535FE2BA7F85e1b2aC28d4ccBD5F2d8C54254E2a"
);

export const PAYMENT_FACTORY_INSTANT = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_INSTANT",
  "0xF8AE1807C9a6Ed4C25cd59513825277A8e8F0368"
);

// (Optionnel) — gestion multi-réseaux
export const CONTRACT_ADDRESSES = {
  base_mainnet: {
    // ⚠️ legacy (ne plus utiliser pour les nouveaux paiements)
    factory: "0x88530C2f1A77BD8eb69caf91816E42982d25aa6C",

    // ✅ nouvelles factories
    factory_scheduled: PAYMENT_FACTORY_SCHEDULED,
    factory_recurring: PAYMENT_FACTORY_RECURRING,
    factory_instant: PAYMENT_FACTORY_INSTANT,
  },

  base_sepolia: {
    // placeholders testnet
    factory: "0x0000000000000000000000000000000000000000",
    factory_scheduled: "0x0000000000000000000000000000000000000000",
    factory_recurring: "0x0000000000000000000000000000000000000000",
    factory_instant: "0x0000000000000000000000000000000000000000",
  },
};
