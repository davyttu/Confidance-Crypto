// src/components/WalletSyncProvider.tsx
'use client';

import { useWalletSync } from '@/hooks/useWalletSync';
import { ReactNode } from 'react';

/**
 * Composant qui synchronise automatiquement les wallets connectés
 * À placer DANS le WagmiConfig et DANS le AuthProvider
 */
export function WalletSyncProvider({ children }: { children: ReactNode }) {
  useWalletSync(); // 🔄 Sync automatique du wallet
  
  return <>{children}</>;
}
