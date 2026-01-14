// src/hooks/useErc20Balance.ts
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface UseErc20BalanceResult {
  balance: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function useErc20Balance(tokenAddress: `0x${string}`): UseErc20BalanceResult {
  const { address } = useAccount();

  const {
    data: balance,
    isLoading,
    isError,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: balance as bigint | undefined,
    isLoading,
    isError,
  };
}
