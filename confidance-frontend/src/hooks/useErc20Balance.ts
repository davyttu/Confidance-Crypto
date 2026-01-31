// src/hooks/useErc20Balance.ts
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface UseErc20BalanceResult {
  balance: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export function useErc20Balance(
  tokenAddress: `0x${string}` | undefined,
  options?: { enabled?: boolean }
): UseErc20BalanceResult {
  const { address } = useAccount();
  const effectiveAddress = tokenAddress ?? ZERO_ADDRESS;
  const enabled = (options?.enabled !== false) && !!address && !!tokenAddress;

  const {
    data: balance,
    isLoading,
    isError,
  } = useReadContract({
    address: effectiveAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled,
    },
  });

  return {
    balance: balance as bigint | undefined,
    isLoading,
    isError,
  };
}
