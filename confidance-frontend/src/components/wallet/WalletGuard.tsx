// src/components/wallet/WalletGuard.tsx
'use client';

import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AlertCircle, Wifi } from 'lucide-react';
import { ReactNode } from 'react';

interface WalletGuardProps {
  children: ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Wifi className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Connexion requise</h2>
            <p className="text-muted-foreground">
              Connectez votre wallet pour accéder à cette page
            </p>
          </div>

          <ConnectButton />
        </div>
      </div>
    );
  }

  // Wrong network
  if (chainId !== 8453) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Mauvais réseau</h2>
            <p className="text-muted-foreground">
              Vous devez être sur <strong>Base Mainnet</strong> pour utiliser cette application
            </p>
            <p className="text-sm text-muted-foreground">
              Réseau actuel : ChainID {chainId}
            </p>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-400">
              💡 Cliquez sur votre wallet et changez de réseau vers Base Mainnet
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All good, render children
  return <>{children}</>;
}