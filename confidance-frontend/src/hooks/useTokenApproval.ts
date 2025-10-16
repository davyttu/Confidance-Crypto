// src/hooks/useTokenApproval.ts

import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface UseTokenApprovalProps {
  tokenSymbol: TokenSymbol;
  spenderAddress: `0x${string}` | undefined; // Adresse du contrat à approuver
  amount: bigint; // Montant à approuver
}

interface UseTokenApprovalReturn {
  // État actuel de l'allowance
  currentAllowance: bigint | undefined;
  isAllowanceSufficient: boolean;
  isCheckingAllowance: boolean;

  // Actions
  approve: () => void;
  isApproving: boolean;
  isApproveSuccess: boolean;
  approveError: Error | null;
  approveTxHash: `0x${string}` | undefined;

  // Reset
  reset: () => void;
}

export function useTokenApproval({
  tokenSymbol,
  spenderAddress,
  amount,
}: UseTokenApprovalProps): UseTokenApprovalReturn {
  const { address: userAddress } = useAccount();
  const token = getToken(tokenSymbol);

  // ETH natif n'a pas besoin d'approbation
  if (token.isNative) {
    return {
      currentAllowance: BigInt(0),
      isAllowanceSufficient: true,
      isCheckingAllowance: false,
      approve: () => {},
      isApproving: false,
      isApproveSuccess: true,
      approveError: null,
      approveTxHash: undefined,
      reset: () => {},
    };
  }

  // 1. Vérifier l'allowance actuelle
  const {
    data: currentAllowance,
    isLoading: isCheckingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args:
      userAddress && spenderAddress ? [userAddress, spenderAddress] : undefined,
    query: {
      enabled: !!userAddress && !!spenderAddress,
    },
  });

  // 2. Écrire la transaction d'approbation
  const {
    writeContract,
    data: approveTxHash,
    error: approveError,
    reset,
  } = useWriteContract();

  // 3. Attendre la confirmation
  const { isLoading: isWaitingConfirmation, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({
      hash: approveTxHash,
    });

  // 4. Refetch allowance après confirmation
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  // Vérifier si l'allowance est suffisante
  const isAllowanceSufficient =
    currentAllowance !== undefined && currentAllowance >= amount;

  // Fonction d'approbation
  const approve = () => {
    if (!spenderAddress) return;

    writeContract({
      address: token.address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddress, amount],
    });
  };

  const isApproving = isWaitingConfirmation;

  return {
    currentAllowance,
    isAllowanceSufficient,
    isCheckingAllowance,
    approve,
    isApproving,
    isApproveSuccess,
    approveError,
    approveTxHash,
    reset,
  };
}