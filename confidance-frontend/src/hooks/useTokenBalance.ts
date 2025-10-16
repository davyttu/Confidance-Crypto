// src/hooks/useTokenBalance.ts

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface UseTokenBalanceReturn {
  balance: bigint | undefined;
  formatted: string;
  symbol: TokenSymbol;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useTokenBalance(tokenSymbol: TokenSymbol): UseTokenBalanceReturn {
  const { address } = useAccount();
  const token = getToken(tokenSymbol);

  // Pour ETH natif
  const {
    data: nativeBalance,
    isLoading: isNativeLoading,
    isError: isNativeError,
    refetch: refetchNative,
  } = useBalance({
    address,
    query: {
      enabled: token.isNative && !!address,
    },
  });

  // Pour tokens ERC20
  const {
    data: erc20Balance,
    isLoading: isErc20Loading,
    isError: isErc20Error,
    refetch: refetchErc20,
  } = useReadContract({
    address: token.isNative ? undefined : token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !token.isNative && !!address && token.address !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Sélection des données selon le type de token
  const balance = token.isNative
    ? nativeBalance?.value
    : (erc20Balance as bigint | undefined);

  const isLoading = token.isNative ? isNativeLoading : isErc20Loading;
  const isError = token.isNative ? isNativeError : isErc20Error;
  const refetch = token.isNative ? refetchNative : refetchErc20;

  // Formatage
  const formatted = balance
    ? formatBalance(balance, token.decimals, tokenSymbol)
    : '0';

  return {
    balance,
    formatted,
    symbol: tokenSymbol,
    isLoading,
    isError,
    refetch,
  };
}

// Helper pour formater la balance
function formatBalance(
  balance: bigint,
  decimals: number,
  symbol: TokenSymbol
): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const fractionalPart = balance % divisor;

  // Conversion en string avec padding
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

  // Garder 4 décimales max
  const truncatedFractional = fractionalStr.slice(0, 4).replace(/0+$/, '');

  if (truncatedFractional === '') {
    return `${integerPart} ${symbol}`;
  }

  return `${integerPart}.${truncatedFractional} ${symbol}`;
}