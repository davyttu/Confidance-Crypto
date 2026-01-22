// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia, polygon, arbitrum, avalanche } from 'wagmi/chains';
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;
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
