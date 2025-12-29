export type ChainConfig = {
  chainId: number
  name: string
  rpcUrl: string
  explorer: string
  nativeSymbol: string
}

export const CHAINS: Record<number, ChainConfig> = {
  // Base
  8453: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    nativeSymbol: "ETH",
  },

  // Polygon
  137: {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    nativeSymbol: "MATIC",
  },

  // Arbitrum
  42161: {
    chainId: 42161,
    name: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    nativeSymbol: "ETH",
  },

  // Avalanche
  43114: {
    chainId: 43114,
    name: "Avalanche",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
    nativeSymbol: "AVAX",
  },
}
