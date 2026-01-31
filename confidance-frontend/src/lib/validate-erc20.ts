/**
 * Validates an ERC20 contract address and fetches name, symbol, decimals, balanceOf(user).
 * Rejects if decimals > 18 or any required call reverts.
 */

import type { PublicClient, Address } from 'viem';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

export type Erc20Info = {
  name: string;
  symbol: string;
  decimals: number;
  balanceOf: bigint;
};

const DECIMALS_MAX = 18;

export async function validateErc20Address(
  publicClient: PublicClient,
  tokenAddress: string,
  userAddress: Address
): Promise<Erc20Info> {
  const addr = tokenAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('Adresse de contrat invalide');
  }

  const address = addr as Address;

  const [name, symbol, decimals, balanceOf] = await Promise.all([
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: 'name',
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    }),
  ]);

  const decimalsNum = Number(decimals);
  if (decimalsNum > DECIMALS_MAX) {
    throw new Error(
      `Ce token utilise ${decimalsNum} décimales. Seuls les tokens avec au plus ${DECIMALS_MAX} décimales sont acceptés.`
    );
  }

  return {
    name: String(name ?? '').trim() || 'Unknown',
    symbol: String(symbol ?? '').trim().toUpperCase() || '???',
    decimals: decimalsNum,
    balanceOf: BigInt(balanceOf ?? 0),
  };
}
