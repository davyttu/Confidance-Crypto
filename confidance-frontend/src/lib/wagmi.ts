// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia, polygon, arbitrum, avalanche } from 'wagmi/chains';
import { http } from 'viem';
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';

// Obligatoire pour WalletConnect. Créez un projet gratuit sur https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'e4e1f0c2b5a7d8e9f0a1b2c3d4e5f6a7';
const targetChain = process.env.NEXT_PUBLIC_CHAIN;
const chains = targetChain === 'base_sepolia'
  ? [baseSepolia]
  : [base, polygon, arbitrum, avalanche];
const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://base.publicnode.com';
const baseSepoliaRpcUrl =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://sepolia.base.org';
const transports = {
  [base.id]: http(baseRpcUrl),
  [baseSepolia.id]: http(baseSepoliaRpcUrl),
  [polygon.id]: http('https://polygon-rpc.com'),
  [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  [avalanche.id]: http('https://api.avax.network/ext/bc/C/rpc'),
};

export const config = getDefaultConfig({
  appName: 'Confidance Crypto',
  projectId,
  chains,
  transports,
  ssr: true,
  wallets: [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        walletConnectWallet,
        rainbowWallet,
        trustWallet,
      ],
    },
  ],
});
