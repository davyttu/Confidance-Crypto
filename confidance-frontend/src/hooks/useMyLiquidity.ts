'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface TimelineEvent {
  icon: string;
  bgColor: string;
  title: string;
  date: string;
  description: string;
  details?: string;
}

interface LiquidityPosition {
  // Données principales
  depositedETH: string;
  depositedEuro: string;
  receivedAmount: string;
  token: 'USDC' | 'USDT';
  
  // Statut
  status: 'healthy' | 'warning' | 'critical';
  healthPercentage: number;
  
  // Dette
  totalDebt: string;
  accumulatedInterest: string;
  totalInterest: string;
  
  // Temps
  daysElapsed: number;
  createdAt: string;
  
  // Recommandations (si warning)
  recommendedETHToAdd?: string;
  recommendedToRepay?: string;
  
  // Liquidation (si critical)
  liquidatedETH?: string;
  remainingETH?: string;
  
  // Timeline
  events: TimelineEvent[];
}

export function useMyLiquidity() {
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
          if (response.status === 404) {
            // Pas de position active
            setPosition(null);
            return;
          }
          throw new Error('Failed to fetch position');
        }

        const data = await response.json();
        setPosition(data);
      } catch (err) {
        console.error('Error fetching position:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosition();

    // Polling toutes les 30 secondes pour les mises à jour temps réel
    const interval = setInterval(fetchPosition, 30000);

    return () => clearInterval(interval);
  }, [address]);

  return {
    position,
    isLoading,
    error
  };
}