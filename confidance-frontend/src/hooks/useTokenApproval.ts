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
  spenderAddress: `0x${string}` | undefined;
  amount: bigint;
  releaseTime?: number; // ✅ NOUVEAU : pour détecter paiement instantané
}

interface UseTokenApprovalReturn {
  currentAllowance: bigint | undefined;
  isAllowanceSufficient: boolean;
  isCheckingAllowance: boolean;
  approve: (amountOverride?: bigint) => void; // ✅ FIX : Permettre de passer un montant override
  isApproving: boolean;
  isApproveSuccess: boolean;
  approveError: Error | null;
  approveTxHash: `0x${string}` | undefined;
  reset: () => void;
}

export function useTokenApproval({
  tokenSymbol,
  spenderAddress,
  amount,
  releaseTime, // ✅ NOUVEAU
}: UseTokenApprovalProps): UseTokenApprovalReturn {
  const { address: userAddress } = useAccount();
  const token = getToken(tokenSymbol);
  
  // ✅ FIX : Log pour déboguer
  console.log('🔧 useTokenApproval hook créé/mis à jour:', {
    tokenSymbol,
    amount: amount.toString(),
    isNative: token.isNative,
    hasSpenderAddress: !!spenderAddress,
  });

  // ✅ NOUVEAU : Détecter si c'est un paiement instantané
  const isInstantPayment = releaseTime 
    ? (releaseTime - Math.floor(Date.now() / 1000)) < 60 
    : false;

  // ✅ NOUVEAU : Calculer le montant à approuver (avec ou sans fees)
  const totalAmountToApprove = isInstantPayment 
    ? amount  // Paiement instantané : pas de fees
    : amount + (amount * BigInt(179)) / BigInt(10000); // Paiement programmé : + 1.79%

  // Déterminer si on doit skip AVANT d'appeler les hooks
  const shouldSkip = token.isNative || !userAddress || !spenderAddress;

  // Toujours définir des args stables (éviter undefined conditionnel)
  const allowanceArgs: [string, string] = [
    userAddress || '0x0000000000000000000000000000000000000000',
    spenderAddress || '0x0000000000000000000000000000000000000000',
  ];

  // 1. Vérifier l'allowance actuelle
  const {
    data: currentAllowance,
    isLoading: isCheckingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: token.address || '0x0000000000000000000000000000000000000000',
    abi: erc20Abi,
    functionName: 'allowance',
    args: allowanceArgs,
    query: {
      enabled: !shouldSkip,
    },
  });

  // 2. Écrire la transaction d'approbation
  const {
    writeContract,
    data: approveTxHash,
    error: approveError,
    reset,
    isPending: isApprovePending,
  } = useWriteContract();

  // ✅ FIX : Logs pour suivre les erreurs d'approbation
  useEffect(() => {
    if (approveError) {
      console.error('❌ Erreur approbation:', approveError);
    }
  }, [approveError]);

  useEffect(() => {
    if (isApprovePending) {
      console.log('⏳ Transaction d\'approbation en attente de confirmation MetaMask...');
    }
  }, [isApprovePending]);

  // 3. Attendre la confirmation
  const { 
    isLoading: isWaitingConfirmation, 
    isSuccess: isApproveSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });
  
  // ✅ FIX : Logs détaillés pour la confirmation
  useEffect(() => {
    if (approveTxHash) {
      console.log('📋 État confirmation approbation:', {
        hash: approveTxHash,
        isWaitingConfirmation,
        isApproveSuccess,
        hasReceipt: !!receipt,
        receiptStatus: receipt?.status,
      });
    }
  }, [approveTxHash, isWaitingConfirmation, isApproveSuccess, receipt]);

  // ✅ FIX : Logs pour suivre l'état de l'approbation
  useEffect(() => {
    if (approveTxHash) {
      console.log('✅ Hash d\'approbation reçu:', approveTxHash);
      console.log('🔗 Voir sur Basescan:', `https://basescan.org/tx/${approveTxHash}`);
    }
  }, [approveTxHash]);

  useEffect(() => {
    if (isWaitingConfirmation) {
      console.log('⏳ Approbation en attente de confirmation blockchain...');
    }
  }, [isWaitingConfirmation]);

  useEffect(() => {
    if (isApproveSuccess) {
      console.log('✅ Approbation confirmée avec succès !');
    }
  }, [isApproveSuccess]);

  // 4. Refetch allowance après confirmation
  useEffect(() => {
    if (isApproveSuccess) {
      console.log('🔄 Refetch de l\'allowance après confirmation...');
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

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

  // ✅ MODIFIÉ : Vérifier l'allowance contre le montant TOTAL (avec fees si nécessaire)
  // ✅ FIX : Si totalAmountToApprove est 0, on considère toujours qu'on doit approuver
  const isAllowanceSufficient = totalAmountToApprove > BigInt(0)
    && currentAllowance !== undefined 
    && currentAllowance >= totalAmountToApprove;

  // ✅ MODIFIÉ : Approuver le montant TOTAL (avec possibilité d'override)
  const approve = (amountOverride?: bigint) => {
    console.log('🔍 Fonction approve() appelée', { amountOverride: amountOverride?.toString() });
    
    if (!spenderAddress || !token.address) {
      console.error('❌ Approbation impossible: spenderAddress ou token.address manquant', {
        spenderAddress,
        tokenAddress: token.address,
      });
      return;
    }

    // ✅ FIX : Utiliser le montant override si fourni, sinon utiliser le montant calculé
    const amountToApprove = amountOverride || totalAmountToApprove;

    // ✅ FIX : Vérifier que le montant n'est pas zéro
    if (amountToApprove === BigInt(0)) {
      console.error('❌ Approbation impossible: montant à approuver est zéro', {
        amount: amount.toString(),
        amountOverride: amountOverride?.toString(),
        totalAmountToApprove: totalAmountToApprove.toString(),
        isInstant: isInstantPayment,
        amountToApprove: amountToApprove.toString(),
      });
      return;
    }

    // ✅ FIX : Vérifier que le montant n'est pas trop grand (dépassement uint256)
    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    if (amountToApprove > MAX_UINT256) {
      console.error('❌ Approbation impossible: montant trop grand (dépassement uint256)', {
        amountToApprove: amountToApprove.toString(),
        maxUint256: MAX_UINT256.toString(),
      });
      return;
    }

    // ✅ FIX : Vérifier que le montant est raisonnable (pas plus de 1 billion de tokens)
    const MAX_REASONABLE = BigInt(10 ** 12) * BigInt(10 ** (token.decimals || 18));
    if (amountToApprove > MAX_REASONABLE) {
      console.warn('⚠️ Montant très élevé pour approbation:', {
        amountToApprove: amountToApprove.toString(),
        maxReasonable: MAX_REASONABLE.toString(),
      });
    }

    console.log('🔍 Lancement approbation:', {
      token: tokenSymbol,
      baseAmount: amount.toString(),
      amountOverride: amountOverride?.toString(),
      isInstant: isInstantPayment,
      feesAdded: !isInstantPayment,
      totalToApprove: amountToApprove.toString(),
      totalToApproveFormatted: `${(Number(amountToApprove) / (10 ** token.decimals)).toFixed(6)} ${tokenSymbol}`,
      spenderAddress,
      tokenAddress: token.address,
      decimals: token.decimals,
    });

    try {
      console.log('📤 Appel writeContract pour approbation...');
      console.log('📋 Paramètres approve:', {
        tokenAddress: token.address,
        spenderAddress,
        amount: amountToApprove.toString(),
        amountHex: `0x${amountToApprove.toString(16)}`,
      });
      
      writeContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, amountToApprove],
      });
      console.log('✅ writeContract appelé pour approbation (pas d\'erreur immédiate)');
    } catch (err) {
      console.error('❌ Erreur lors de l\'appel writeContract pour approbation:', err);
      throw err; // Re-lancer l'erreur pour qu'elle soit catchée par le code appelant
    }
  };

  const isApproving = isWaitingConfirmation || isApprovePending;

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