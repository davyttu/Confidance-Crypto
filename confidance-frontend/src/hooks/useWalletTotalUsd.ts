// src/hooks/useWalletTotalUsd.ts
'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

interface UseWalletTotalUsdResult {
  totalUsd: number | null;
  isLoading: boolean;
  isError: boolean;
  source: 'debank-open' | 'debank-pro' | null;
  errorMessage: string | null;
  debug: {
    hasAccessKey?: boolean;
    accessKeyLength?: number;
    endpoint?: string;
  } | null;
}

export function useWalletTotalUsd(): UseWalletTotalUsdResult {
  const { address } = useAccount();
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [source, setSource] = useState<'debank-open' | 'debank-pro' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debug, setDebug] = useState<UseWalletTotalUsdResult['debug']>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTotal = async () => {
      if (!address) {
        setTotalUsd(null);
        setSource(null);
        return;
      }

      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);
      setDebug(null);

      try {
        const response = await fetch(`/api/wallet/total?address=${address}`);
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const bodyMessage = typeof errorBody?.body === 'string' ? errorBody.body : null;
          throw new Error(
            `HTTP ${response.status}${bodyMessage ? `: ${bodyMessage}` : ''}`
          );
        }
        const data = await response.json();
        const total = typeof data?.totalUsd === 'number' ? data.totalUsd : null;

        if (isMounted) {
          setTotalUsd(total);
          setSource(
            data?.source === 'debank-pro' || data?.source === 'debank-open'
              ? data.source
              : null
          );
          setDebug(data?.debug ?? null);
          if (total === null) {
            setIsError(true);
          }
        }
      } catch (error) {
        if (isMounted) {
          setIsError(true);
          setTotalUsd(null);
          setSource(null);
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
          setDebug(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTotal();

    return () => {
      isMounted = false;
    };
  }, [address]);

  return {
    totalUsd,
    isLoading,
    isError,
    source,
    errorMessage,
    debug,
  };
}
