'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface LiquidityPosition {
  depositedETH: string;
  receivedAmount: string;
  token: 'USDC' | 'USDT';
  healthFactor: number;
  status: 'healthy' | 'warning' | 'critical';
  accumulatedInterest: string;
  createdAt: string;
}

export function useLiquidity() {
  const { address } = useAccount();
  const [position, setPosition] = useState<LiquidityPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPosition = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // TODO: Remplacer par l'appel API réel
        const response = await fetch(`/api/liquidity/position/${address}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch position');
        }

        const data = await response.json();
        setPosition(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosition();
  }, [address]);

  const createPosition = async (
    ethAmount: string,
    token: 'USDC' | 'USDT',
    ltvPercentage: number
  ) => {
    if (!address) throw new Error('Wallet not connected');

    // TODO: Implémenter la création de position
    console.log('Creating position...', { ethAmount, token, ltvPercentage });
  };

  const repay = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected');
    
    // TODO: Implémenter le remboursement
    console.log('Repaying...', { amount });
  };

  const addCollateral = async (ethAmount: string) => {
    if (!address) throw new Error('Wallet not connected');
    
    // TODO: Implémenter l'ajout de collatéral
    console.log('Adding collateral...', { ethAmount });
  };

  const closePosition = async () => {
    if (!address) throw new Error('Wallet not connected');
    
    // TODO: Implémenter la clôture
    console.log('Closing position...');
  };

  return {
    position,
    isLoading,
    error,
    createPosition,
    repay,
    addCollateral,
    closePosition
  };
}