// src/hooks/useEthUsdPrice.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useChainId, useReadContract } from 'wagmi';

const CHAINLINK_ETH_USD_FEED_BASE = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0Bb70';

const CHAINLINK_FEED_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
];

type PriceSource = 'onchain' | 'offchain' | null;

interface UseEthUsdPriceResult {
  priceUsd: number | null;
  source: PriceSource;
  isLoading: boolean;
  isError: boolean;
}

export function useEthUsdPrice(): UseEthUsdPriceResult {
  const chainId = useChainId();
  const isBase = chainId === 8453;
  const [offchainPrice, setOffchainPrice] = useState<number | null>(null);
  const [offchainError, setOffchainError] = useState(false);
  const [offchainLoading, setOffchainLoading] = useState(false);

  const { data: decimals } = useReadContract({
    address: isBase ? (CHAINLINK_ETH_USD_FEED_BASE as `0x${string}`) : undefined,
    abi: CHAINLINK_FEED_ABI,
    functionName: 'decimals',
    query: { enabled: isBase },
  });

  const { data: latestRoundData } = useReadContract({
    address: isBase ? (CHAINLINK_ETH_USD_FEED_BASE as `0x${string}`) : undefined,
    abi: CHAINLINK_FEED_ABI,
    functionName: 'latestRoundData',
    query: { enabled: isBase },
  });

  const onchainPrice = useMemo(() => {
    if (!decimals || !latestRoundData) return null;
    const answer = (latestRoundData as unknown as { answer: bigint }).answer;
    if (answer <= 0n) return null;
    const denom = 10 ** Number(decimals);
    return Number(answer) / denom;
  }, [decimals, latestRoundData]);

  useEffect(() => {
    let isMounted = true;

    const fetchOffchain = async () => {
      setOffchainLoading(true);
      setOffchainError(false);

      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          { cache: 'no-store' }
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const price = data?.ethereum?.usd;
        if (isMounted && typeof price === 'number') {
          setOffchainPrice(price);
        }
      } catch (error) {
        if (isMounted) {
          setOffchainError(true);
        }
      } finally {
        if (isMounted) {
          setOffchainLoading(false);
        }
      }
    };

    if (!onchainPrice) {
      fetchOffchain();
    }

    return () => {
      isMounted = false;
    };
  }, [onchainPrice]);

  return {
    priceUsd: onchainPrice ?? offchainPrice,
    source: onchainPrice ? 'onchain' : offchainPrice ? 'offchain' : null,
    isLoading: !onchainPrice && offchainLoading,
    isError: !onchainPrice && offchainError,
  };
}
