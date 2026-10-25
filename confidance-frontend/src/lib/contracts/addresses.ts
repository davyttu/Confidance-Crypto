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
  "0x62B2C06C1F1D8e677D0b309E51b25fdDeBF6e781"
);

export const PAYMENT_FACTORY_INSTANT = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_INSTANT",
  "0xF8AE1807C9a6Ed4C25cd59513825277A8e8F0368"
);

// Factories Arbitrum One. Les variables Base ci-dessus ne sont pas réutilisées.
const PAYMENT_FACTORY_SCHEDULED_ARBITRUM = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_SCHEDULED_ARBITRUM",
  "0x3746BC33ce743962E2554c962BB4A1d6b2Cf0E4C"
);

const PAYMENT_FACTORY_RECURRING_ARBITRUM = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_RECURRING_ARBITRUM",
  "0xd84e6AE29c492F305f2686C02425242E282DA5E3"
);

const PAYMENT_FACTORY_INSTANT_ARBITRUM = getEnvAddress(
  "NEXT_PUBLIC_PAYMENT_FACTORY_INSTANT_ARBITRUM",
  "0x4B0F57DC60EEFdbDC0a4B79E1A0082b8125dc4b5"
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
    factory_recurring: "0xEFa8C5b8d7A7f7dcE6F68da21d9d5Ef8e1042cE6",
    factory_instant: "0x0000000000000000000000000000000000000000",
  },

  arbitrum_mainnet: {
    factory: "0x0000000000000000000000000000000000000000",
    factory_scheduled: PAYMENT_FACTORY_SCHEDULED_ARBITRUM,
    factory_recurring: PAYMENT_FACTORY_RECURRING_ARBITRUM,
    factory_instant: PAYMENT_FACTORY_INSTANT_ARBITRUM,
  },
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const NETWORK_BY_CHAIN_ID = {
  8453: "base_mainnet",
  84532: "base_sepolia",
  42161: "arbitrum_mainnet",
} as const;

export type FactoryKind = "scheduled" | "instant" | "recurring";

const FACTORY_FIELD: Record<FactoryKind, "factory_scheduled" | "factory_instant" | "factory_recurring"> = {
  scheduled: "factory_scheduled",
  instant: "factory_instant",
  recurring: "factory_recurring",
};

/**
 * Adresse de factory pour un réseau donné.
 * Un chainId inconnu renvoie null : jamais l'adresse Base par défaut.
 * Les hooks de paiement n'appellent pas encore cette fonction.
 */
export function getFactoryAddress(chainId: number, kind: FactoryKind): `0x${string}` | null {
  const network = NETWORK_BY_CHAIN_ID[chainId as keyof typeof NETWORK_BY_CHAIN_ID];
  if (!network) return null;
  const address = CONTRACT_ADDRESSES[network][FACTORY_FIELD[kind]];
  if (!address || address.toLowerCase() === ZERO_ADDRESS) return null;
  return address as `0x${string}`;
}

/**
 * Factory réellement utilisée pour une écriture.
 * Base (et tout chainId autre qu'Arbitrum ou Base Sepolia) garde les adresses de production.
 * Arbitrum ne retombe jamais sur une factory Base.
 */
export function getPaymentFactory(chainId: number | undefined, kind: FactoryKind): `0x${string}` {
  if (chainId === 42161) {
    const address = getFactoryAddress(chainId, kind);
    if (!address) {
      throw new Error(`Factory ${kind} introuvable sur Arbitrum`);
    }
    return address;
  }
  if (chainId === 84532 && kind === "recurring") {
    return CONTRACT_ADDRESSES.base_sepolia.factory_recurring as `0x${string}`;
  }
  if (kind === "instant") return PAYMENT_FACTORY_INSTANT as `0x${string}`;
  if (kind === "recurring") return PAYMENT_FACTORY_RECURRING as `0x${string}`;
  return PAYMENT_FACTORY_SCHEDULED as `0x${string}`;
}

/** Factory récurrente des hooks de création. */
export function getRecurringFactoryAddress(chainId?: number): `0x${string}` {
  return getPaymentFactory(chainId, "recurring");
}
