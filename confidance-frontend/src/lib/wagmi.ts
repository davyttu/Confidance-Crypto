// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia, polygon, arbitrum, avalanche } from 'wagmi/chains';
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

export const config = getDefaultConfig({
  appName: 'Confidance Crypto',
  projectId,
  chains,
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
