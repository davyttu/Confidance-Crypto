import { CHAINS } from '@/config/chains';

const NETWORK_CHAIN_ID: Record<string, number> = {
  base_mainnet: 8453,
  base_sepolia: 84532,
  arbitrum_mainnet: 42161,
  polygon_mainnet: 137,
  avalanche_mainnet: 43114,
};

const CHAIN_ICON: Record<number, string> = {
  8453: '/blockchains/base.svg',
  84532: '/blockchains/base.svg',
  42161: '/blockchains/arbitrum.svg',
  137: '/blockchains/polygon.svg',
  43114: '/blockchains/avalanche.svg',
};

/** Un paiement sans réseau connu reste sur Base, comme aujourd'hui. */
export function chainIdFromPayment(network?: string | null, chainId?: number | null): number {
  if (typeof chainId === 'number' && CHAINS[chainId]) return chainId;
  if (network && NETWORK_CHAIN_ID[network]) return NETWORK_CHAIN_ID[network];
  return 8453;
}

export function explorerOrigin(network?: string | null, chainId?: number | null): string {
  const id = chainIdFromPayment(network, chainId);
  return CHAINS[id]?.explorer ?? 'https://basescan.org';
}

export function explorerTxUrl(hash: string, network?: string | null, chainId?: number | null): string {
  return `${explorerOrigin(network, chainId)}/tx/${hash}`;
}

export function explorerAddressUrl(address: string, network?: string | null, chainId?: number | null): string {
  return `${explorerOrigin(network, chainId)}/address/${address}`;
}

export function chainIconPath(network?: string | null, chainId?: number | null): string {
  return CHAIN_ICON[chainIdFromPayment(network, chainId)] ?? '/blockchains/base.svg';
}

export function chainDisplayName(network?: string | null, chainId?: number | null): string {
  const id = chainIdFromPayment(network, chainId);
  return CHAINS[id]?.name ?? 'Base';
}

export function explorerDisplayName(network?: string | null, chainId?: number | null): string {
  const id = chainIdFromPayment(network, chainId);
  if (id === 42161) return 'Arbiscan';
  if (id === 137) return 'Polygonscan';
  if (id === 43114) return 'Snowtrace';
  return 'Basescan';
}
