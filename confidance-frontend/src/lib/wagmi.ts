// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, polygon, arbitrum, avalanche } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Confidance Crypto',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [
    base,
    polygon,
    arbitrum,
    avalanche,
  ],
  ssr: true,
});
