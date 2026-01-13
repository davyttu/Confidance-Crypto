// src/hooks/useTokenApproval.ts

import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface UseTokenApprovalProps {
  tokenSymbol: TokenSymbol;
  spenderAddress: `0x${string}` | undefined;
  amount: bigint;
  releaseTime?: number; // ✅ NOUVEAU : pour détecter paiement instantané
}

export interface UseTokenApprovalReturn {
  currentAllowance: bigint | undefined;
  isAllowanceSufficient: boolean;
  isCheckingAllowance: boolean;
  approve: (amountOverride?: bigint, tokenSymbolOverride?: TokenSymbol, tokenAddressOverride?: `0x${string}`) => void; // ✅ FIX : Permettre de passer un montant, tokenSymbol et tokenAddress override
  isApproving: boolean;
  isApproveSuccess: boolean;
  approveError: Error | null;
  approveTxHash: `0x${string}` | undefined;
  approveReceipt: any; // ✅ FIX USDT : Exposer le receipt pour vérifier la confirmation
  reset: () => void;
  refetchAllowance: () => Promise<any>; // ✅ FIX USDT : Exposer refetchAllowance (retourne une promesse)
}

export function useTokenApproval({
  tokenSymbol,
  spenderAddress,
  amount,
  releaseTime, // ✅ NOUVEAU
}: UseTokenApprovalProps): UseTokenApprovalReturn {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
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

  // ✅ FIX : Logs détaillés pour suivre les erreurs d'approbation
  useEffect(() => {
    if (approveError) {
      console.error('❌ [useTokenApproval] Erreur approbation détectée:', approveError);
      console.error('❌ [useTokenApproval] Type d\'erreur:', typeof approveError);
      console.error('❌ [useTokenApproval] Détails complets:', JSON.stringify(approveError, null, 2));
      console.error('❌ [useTokenApproval] Détails erreur:', {
        name: approveError.name,
        message: approveError.message,
        cause: approveError.cause,
        stack: approveError.stack,
        code: (approveError as any)?.code,
        shortMessage: (approveError as any)?.shortMessage,
        data: (approveError as any)?.data,
      });
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
    error: receiptError, // ✅ NOUVEAU : Détecter les erreurs de réception
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: {
      // ✅ FIX : Ne pas attendre indéfiniment si la transaction n'existe pas
      retryCount: 10, // 10 tentatives
      retryDelay: 2000, // 2 secondes entre chaque tentative
    },
  });
  
  // ✅ NOUVEAU : Détecter si la transaction n'existe pas sur la blockchain (annulée par MetaMask)
  useEffect(() => {
    if (approveTxHash && receiptError) {
      console.error('❌ [useTokenApproval] Erreur lors de l\'attente de la transaction:', receiptError);
      console.error('❌ [useTokenApproval] Cela peut indiquer que la transaction a été annulée par MetaMask avant soumission.');
      console.error('❌ [useTokenApproval] Détails:', {
        name: receiptError.name,
        message: receiptError.message,
        code: (receiptError as any)?.code,
      });
      console.error('🔗 [useTokenApproval] Vérifiez sur Basescan si la transaction existe:', `https://basescan.org/tx/${approveTxHash}`);
    }
  }, [approveTxHash, receiptError]);
  
  // ✅ NOUVEAU : Vérifier rapidement si la transaction existe sur la blockchain après réception du hash
  useEffect(() => {
    if (approveTxHash && !isApproveSuccess && !receiptError && publicClient) {
      // Attendre 3 secondes puis vérifier si la transaction existe
      const checkTimeout = setTimeout(async () => {
        try {
          const tx = await publicClient.getTransaction({ hash: approveTxHash });
          if (tx) {
            console.log('✅ [useTokenApproval] Transaction trouvée sur la blockchain:', {
              hash: tx.hash,
              blockNumber: tx.blockNumber,
              status: tx.blockNumber ? 'dans un bloc' : 'en attente dans le mempool',
            });
          }
        } catch (err: any) {
          if (err?.name === 'TransactionNotFoundError' || err?.message?.includes('could not be found')) {
            console.warn('⚠️ [useTokenApproval] Transaction non trouvée sur la blockchain après 3 secondes.');
            console.warn('⚠️ [useTokenApproval] Cela peut indiquer que MetaMask a annulé la transaction avant soumission.');
            console.warn('🔗 [useTokenApproval] Vérifiez sur Basescan:', `https://basescan.org/tx/${approveTxHash}`);
          }
        }
      }, 3000);
      
      return () => clearTimeout(checkTimeout);
    }
  }, [approveTxHash, isApproveSuccess, receiptError, publicClient]);
  
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
    console.log('ℹ️ Token natif (ETH) détecté, pas besoin d\'approbation', { tokenSymbol });
    return {
      currentAllowance: BigInt(0),
      isAllowanceSufficient: true,
      isCheckingAllowance: false,
      approve: () => {
        console.warn('⚠️ Tentative d\'approbation pour token natif (ETH), ignorée');
      },
      isApproving: false,
      isApproveSuccess: true,
      approveError: null,
      approveTxHash: undefined,
      approveReceipt: undefined, // ✅ FIX USDT : Exposer approveReceipt même pour ETH
      reset: () => {},
      refetchAllowance: async () => {}, // ✅ FIX USDT : Exposer refetchAllowance même pour ETH
    };
  }

  // ✅ MODIFIÉ : Vérifier l'allowance contre le montant TOTAL (avec fees si nécessaire)
  // ✅ FIX : Si totalAmountToApprove est 0, on considère toujours qu'on doit approuver
  const isAllowanceSufficient = totalAmountToApprove > BigInt(0)
    && currentAllowance !== undefined 
    && currentAllowance >= totalAmountToApprove;

  // ✅ MODIFIÉ : Approuver le montant TOTAL (avec possibilité d'override pour montant, tokenSymbol et tokenAddress)
  const approve = (amountOverride?: bigint, tokenSymbolOverride?: TokenSymbol, tokenAddressOverride?: `0x${string}`) => {
    // ✅ FIX CRITIQUE : Utiliser le tokenSymbol et tokenAddress override si fournis, sinon utiliser ceux du hook
    const finalTokenSymbol = tokenSymbolOverride || tokenSymbol;
    const finalToken = tokenSymbolOverride ? getToken(tokenSymbolOverride) : token;
    const finalTokenAddress = tokenAddressOverride || (finalToken.address === 'NATIVE' ? undefined : finalToken.address as `0x${string}`);
    
    console.log('🔍 [useTokenApproval] Fonction approve() appelée', { 
      amountOverride: amountOverride?.toString(),
      tokenSymbolOverride,
      tokenSymbolFromHook: tokenSymbol,
      finalTokenSymbol,
      tokenAddressOverride,
      tokenAddressFromHook: token.address,
      finalTokenAddress,
      isNative: finalToken.isNative,
    });
    
    // ✅ FIX CRITIQUE : Vérifier que ce n'est pas un token natif (ETH)
    if (finalToken.isNative) {
      console.error('❌ Approbation impossible: token natif (ETH) n\'a pas besoin d\'approbation', {
        finalTokenSymbol,
        finalTokenAddress,
      });
      return;
    }
    
    if (!spenderAddress || !finalTokenAddress) {
      console.error('❌ Approbation impossible: spenderAddress ou token.address manquant/invalide', {
        spenderAddress,
        finalTokenAddress,
        finalTokenSymbol,
        isNative: finalToken.isNative,
        hasOverride: !!tokenSymbolOverride,
      });
      return;
    }

    // ✅ FIX : Utiliser le montant override si fourni, sinon utiliser le montant calculé
    // ⚠️ IMPORTANT : Si amountOverride est fourni, l'utiliser directement SANS ajouter de fees
    // car le montant total (avec fees) est déjà calculé dans amountOverride
    // ✅ FIX CRITIQUE : Pour les paiements récurrents, on passe toujours amountOverride (total avec fees déjà incluses)
    // donc on ne doit PAS ajouter de fees supplémentaires. Le hook ne devrait PAS calculer totalAmountToApprove avec fees
    // si amountOverride est fourni. Mais si releaseTime n'est pas défini, isInstantPayment sera false
    // et totalAmountToApprove sera calculé avec fees. C'est pourquoi on utilise amountOverride directement.
    const amountToApprove = amountOverride || totalAmountToApprove;
    
    console.log('🔍 [useTokenApproval] Calcul montant à approuver:', {
      amountOverride: amountOverride?.toString(),
      totalAmountToApprove: totalAmountToApprove.toString(),
      amountToApprove: amountToApprove.toString(),
      hasOverride: !!amountOverride,
      isInstant: isInstantPayment,
      releaseTimeProvided: !!releaseTime,
      note: amountOverride ? '✅ Utilisation du montant override (fees déjà incluses - pas d\'ajout de fees)' : `⚠️ Utilisation du montant calculé (fees ajoutées si isInstant=${isInstantPayment})`,
      warning: !amountOverride && !isInstantPayment ? '⚠️ ATTENTION: Des fees (1.79%) seront ajoutées au montant calculé' : '✅ Pas de double comptage de fees',
    });

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

    // ✅ FIX CRITIQUE : Vérifier que le token.address correspond bien au tokenSymbol (utiliser les valeurs finales)
    const expectedToken = getToken(finalTokenSymbol);
    if (finalTokenAddress !== expectedToken.address) {
      console.error('❌ ERREUR CRITIQUE: Mismatch entre tokenSymbol et token.address !', {
        finalTokenSymbol,
        finalTokenAddress,
        expectedTokenAddress: expectedToken.address,
        expectedTokenSymbol: expectedToken.symbol,
        hasOverride: !!tokenSymbolOverride,
        hookTokenSymbol: tokenSymbol,
      });
      throw new Error(`Mismatch token: tokenSymbol=${finalTokenSymbol} mais token.address=${finalTokenAddress} (attendu: ${expectedToken.address})`);
    }
    
    // ✅ FIX CRITIQUE : Vérifier que ce n'est pas ETH (qui n'a pas besoin d'approbation) - déjà vérifié plus haut mais double vérification
    if (finalToken.isNative) {
      console.error('❌ ERREUR CRITIQUE: Tentative d\'approbation d\'un token natif (ETH) !', {
        finalTokenSymbol,
        finalTokenAddress,
        isNative: finalToken.isNative,
      });
      throw new Error(`Impossible d'approuver un token natif (ETH). Le tokenSymbol=${finalTokenSymbol} ne devrait pas nécessiter d'approbation.`);
    }

    console.log('🔍 [useTokenApproval] Lancement approbation:', {
      token: finalTokenSymbol,
      tokenAddress: finalTokenAddress,
      baseAmount: amount.toString(),
      amountOverride: amountOverride?.toString(),
      isInstant: isInstantPayment,
      feesAdded: !isInstantPayment,
      totalToApprove: amountToApprove.toString(),
      totalToApproveFormatted: `${(Number(amountToApprove) / (10 ** finalToken.decimals)).toFixed(6)} ${finalTokenSymbol}`,
      spenderAddress,
      decimals: finalToken.decimals,
      isNative: finalToken.isNative,
      hasTokenOverride: !!tokenSymbolOverride,
    });

    try {
      console.log('📤 [useTokenApproval] Appel writeContract pour approbation...');
      console.log('📋 [useTokenApproval] Paramètres approve:', {
        tokenSymbol: finalTokenSymbol,
        tokenAddress: finalTokenAddress,
        spenderAddress,
        amount: amountToApprove.toString(),
        amountHex: `0x${amountToApprove.toString(16)}`,
        hasTokenOverride: !!tokenSymbolOverride,
        hookTokenSymbol: tokenSymbol,
        hookTokenAddress: token.address,
      });
      
      // ✅ FIX CRITIQUE : Vérifier une dernière fois que tous les paramètres sont valides
      if (!finalTokenAddress || finalTokenAddress === 'NATIVE') {
        throw new Error(`Adresse du token invalide: ${finalTokenAddress}`);
      }
      
      if (!spenderAddress) {
        throw new Error(`SpenderAddress invalide: ${spenderAddress}`);
      }
      
      if (amountToApprove <= BigInt(0)) {
        throw new Error(`Montant invalide: ${amountToApprove.toString()}`);
      }
      
      console.log('✅ [useTokenApproval] Tous les paramètres sont valides, appel writeContract...');
      console.log('📋 [useTokenApproval] Paramètres writeContract:', {
        address: finalTokenAddress,
        functionName: 'approve',
        args: [spenderAddress, amountToApprove.toString()],
        argsFormatted: [
          spenderAddress,
          `${amountToApprove.toString()} (${(Number(amountToApprove) / (10 ** finalToken.decimals)).toFixed(6)} ${finalTokenSymbol})`,
        ],
        abiLength: erc20Abi.length,
      });
      
      // ✅ FIX CRITIQUE : Utiliser finalTokenAddress au lieu de token.address
      console.log('🚀 [useTokenApproval] Appel writeContract avec les paramètres suivants:');
      console.log('   - Token Address:', finalTokenAddress);
      console.log('   - Token Symbol:', finalTokenSymbol);
      console.log('   - Spender Address:', spenderAddress);
      console.log('   - Amount (raw):', amountToApprove.toString());
      console.log('   - Amount (formatted):', `${(Number(amountToApprove) / (10 ** finalToken.decimals)).toFixed(6)} ${finalTokenSymbol}`);
      console.log('   - Decimals:', finalToken.decimals);
      
      // ✅ FIX : Vérifier que amountToApprove est bien un bigint et pas une string
      const amountAsBigInt = typeof amountToApprove === 'bigint' ? amountToApprove : BigInt(amountToApprove.toString());
      
      console.log('📤 [useTokenApproval] Appel writeContract avec paramètres finaux:', {
        address: finalTokenAddress,
        functionName: 'approve',
        args: [
          spenderAddress,
          amountAsBigInt.toString(),
        ],
        argsFormatted: [
          `spender: ${spenderAddress}`,
          `amount: ${amountAsBigInt.toString()} (${(Number(amountAsBigInt) / (10 ** finalToken.decimals)).toFixed(6)} ${finalTokenSymbol})`,
        ],
        amountType: typeof amountAsBigInt,
        amountIsBigInt: typeof amountAsBigInt === 'bigint',
        userAddress: userAddress || 'non disponible',
        tokenDecimals: finalToken.decimals,
      });
      
      writeContract({
        address: finalTokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, amountAsBigInt],
      });
      
      console.log('✅ [useTokenApproval] writeContract appelé pour approbation (pas d\'erreur immédiate)');
      console.log('💡 [useTokenApproval] Si MetaMask annule la transaction, vérifiez:');
      console.log('   1. Que l\'adresse du token est correcte:', finalTokenAddress);
      console.log('   2. Que l\'adresse du spender est correcte:', spenderAddress);
      console.log('   3. Que le montant est valide:', amountAsBigInt.toString(), `(${(Number(amountAsBigInt) / (10 ** finalToken.decimals)).toFixed(6)} ${finalTokenSymbol})`);
      console.log('   4. Que vous avez suffisamment de tokens pour approuver');
    } catch (err) {
      console.error('❌ [useTokenApproval] Erreur lors de l\'appel writeContract pour approbation:', err);
      console.error('❌ [useTokenApproval] Détails de l\'erreur:', {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
        stack: (err as Error)?.stack,
        cause: (err as Error)?.cause,
      });
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
    approveReceipt: receipt, // ✅ FIX USDT : Exposer le receipt
    reset,
    refetchAllowance, // ✅ FIX USDT : Exposer refetchAllowance
  };
}