// src/hooks/useCreatePayment.ts

import { useState, useEffect, useRef } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { decodeEventLog } from 'viem';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { useTokenApproval } from './useTokenApproval';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';

// ⚠️ ADRESSE DE LA FACTORY - Déployée sur Base Mainnet
const FACTORY_ADDRESS: `0x${string}` = '0x0BD36382637312095a93354b2e5c71B68f570881';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CreatePaymentParams {
  tokenSymbol: TokenSymbol;
  beneficiary: `0x${string}`;
  amount: bigint;
  releaseTime: number; // Unix timestamp en secondes
  cancellable?: boolean; // Optionnel, par défaut false
}

type PaymentStatus = 
  | 'idle' 
  | 'approving' 
  | 'creating' 
  | 'confirming' 
  | 'success' 
  | 'error';

interface UseCreatePaymentReturn {
  // État
  status: PaymentStatus;
  error: Error | null;
  
  // Transactions
  approveTxHash: `0x${string}` | undefined;
  createTxHash: `0x${string}` | undefined;
  contractAddress: `0x${string}` | undefined;

  // Actions
  createPayment: (params: CreatePaymentParams) => Promise<void>;
  reset: () => void;

  // Progress (pour UI)
  currentStep: number; // 0, 1 ou 2
  totalSteps: number; // 1 (ETH) ou 2 (ERC20)
  progressMessage: string;
}

export function useCreatePayment(): UseCreatePaymentReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  
  // ✅ FIX : Helper pour lire la balance d'un token
  const readTokenBalance = async (tokenAddress: `0x${string}`, userAddress: `0x${string}`): Promise<bigint | null> => {
    if (!publicClient) return null;
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [{ name: 'account', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [userAddress],
      });
      return balance as bigint;
    } catch (err) {
      console.error('❌ Erreur lecture balance:', err);
      return null;
    }
  };

  // État local
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>();
  const [currentParams, setCurrentParams] = useState<CreatePaymentParams | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [capturedPayerAddress, setCapturedPayerAddress] = useState<`0x${string}` | undefined>();
  
  // ✅ FIX : Stocker le hash d'approbation pour cette tentative (protection contre double déclenchement)
  const currentApproveTxHash = useRef<`0x${string}` | undefined>(undefined);
  // ✅ FIX : Timeout de sécurité pour éviter que la modal reste bloquée
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ✅ FIX : Flag pour éviter les enregistrements multiples
  const isSavingRef = useRef<boolean>(false);
  const savedContractAddressRef = useRef<`0x${string}` | undefined>(undefined);

  // Hook pour écrire les transactions
  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
    isPending: isWritePending,
  } = useWriteContract();

  // Attendre confirmation de la transaction de création
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });
  
  // ✅ FIX : Logs pour suivre la confirmation de la transaction
  useEffect(() => {
    if (createTxHash) {
      console.log('📋 État confirmation transaction:', {
        hash: createTxHash,
        isConfirming,
        isConfirmed,
        hasReceipt: !!receipt,
        receiptStatus: receipt?.status,
        confirmError: confirmError?.message,
      });
    }
  }, [createTxHash, isConfirming, isConfirmed, receipt, confirmError]);
  
  // ✅ FIX : Mettre à jour le statut quand la transaction est confirmée
  useEffect(() => {
    if (isConfirmed && createTxHash && status === 'creating') {
      console.log('✅ Transaction confirmée, passage à confirming...');
      setStatus('confirming');
      setProgressMessage('Transaction confirmée, récupération des détails...');
    }
  }, [isConfirmed, createTxHash, status]);

  // Hook d'approbation (pour ERC20)
  const token = currentParams ? getToken(currentParams.tokenSymbol) : null;
  
  // 🔧 FIX ERC20 ALLOWANCE : Calculer totalRequired (amountToPayee + fees 1.79%)
  const amountForApproval = currentParams?.amount 
    ? currentParams.amount + (currentParams.amount * BigInt(179)) / BigInt(10000)
    : BigInt(1);
  
  // ✅ FIX : Ne créer le hook que si currentParams existe, sinon utiliser des valeurs par défaut
  const approvalHook = useTokenApproval({
    tokenSymbol: currentParams?.tokenSymbol || 'USDC', // ✅ FIX : Utiliser USDC par défaut au lieu de ETH
    spenderAddress: FACTORY_ADDRESS,
    amount: amountForApproval, // 🔧 FIX : Approve totalRequired (amountToPayee + fees)
    releaseTime: currentParams?.releaseTime,
  });
  
  // ✅ FIX : Log pour vérifier que le hook est bien créé
  console.log('🔧 approvalHook créé:', {
    tokenSymbol: currentParams?.tokenSymbol || 'USDC',
    amount: currentParams?.amount?.toString() || '0',
    isNative: token?.isNative,
    hasApproveFunction: typeof approvalHook.approve === 'function',
  });

  // Fonction principale de création
  const createPayment = async (params: CreatePaymentParams) => {
    if (!address) {
      setError(new Error('Wallet non connecté'));
      return;
    }

    try {
      setError(null);
      setCurrentParams(params);
      setCapturedPayerAddress(address);
      // ✅ FIX : Réinitialiser le hash d'approbation pour cette nouvelle tentative
      currentApproveTxHash.current = undefined;
      const tokenData = getToken(params.tokenSymbol);

      // ✅ NOUVEAU : Détecter si c'est un paiement instantané
      const now = Math.floor(Date.now() / 1000);
      const isInstantPayment = (params.releaseTime - now) < 60;

      console.log('🚀 Création paiement:', {
        token: params.tokenSymbol,
        amount: params.amount.toString(),
        releaseTime: params.releaseTime,
        now,
        timeUntil: params.releaseTime - now,
        isInstant: isInstantPayment,
      });

      // CAS 1 : ETH NATIF
      if (tokenData.isNative) {
        if (isInstantPayment) {
          // ⚡ PAIEMENT INSTANTANÉ ETH (0% fees)
          setStatus('creating');
          setProgressMessage('⚡ Paiement instantané ETH (0% fees)...');

          console.log('⚡ createInstantPaymentETH:', {
            beneficiary: params.beneficiary,
            amount: params.amount.toString(),
          });

          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createInstantPaymentETH',
            args: [params.beneficiary],
            value: params.amount, // ✅ Montant exact, pas de fees
          });
        } else {
          // PAIEMENT PROGRAMMÉ ETH (1.79% fees)
          setStatus('creating');
          setProgressMessage('Création du paiement ETH...');

          const amountToPayee = params.amount;
          const protocolFee = (amountToPayee * BigInt(179)) / BigInt(10000);
          const totalRequired = amountToPayee + protocolFee;

          console.log('💰 Calcul paiement programmé:', {
            amountToPayee: amountToPayee.toString(),
            protocolFee: protocolFee.toString(),
            totalRequired: totalRequired.toString()
          });

          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createPaymentETH',
            args: [
              params.beneficiary,
              amountToPayee,
              BigInt(params.releaseTime),
              params.cancellable || false,
            ],
            value: totalRequired,
          });
        }
      }
      // CAS 2 : ERC20
      else {
        if (isInstantPayment) {
          // ⚡ PAIEMENT INSTANTANÉ ERC20 (0% fees)
          
          console.log('⚡ Paiement instantané ERC20:', {
            amount: params.amount.toString(),
            currentAllowance: approvalHook.currentAllowance?.toString() || '0',
            isAllowanceSufficient: approvalHook.isAllowanceSufficient,
            isCheckingAllowance: approvalHook.isCheckingAllowance,
          });
          
          // ✅ FIX : Vérifier manuellement l'allowance avec le bon montant
          const allowanceIsSufficient = approvalHook.currentAllowance !== undefined 
            && approvalHook.currentAllowance >= params.amount;
          
          // Vérifier si approbation nécessaire
          if (!allowanceIsSufficient || approvalHook.isCheckingAllowance) {
            console.log('🔐 Approbation nécessaire pour paiement instantané');
            setStatus('approving');
            setProgressMessage(`⚡ Approbation ${tokenData.symbol} instantané (0% fees)...`);
            // ✅ FIX : Passer le montant directement (pas de fees pour instantané)
            approvalHook.approve(params.amount);
          } else {
            // Approbation déjà suffisante, passer directement à la création
            console.log('✅ Allowance suffisante, création instantanée directe');
            setStatus('creating');
            setProgressMessage('⚡ Paiement instantané...');

            if (!tokenData.address) {
              throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
            }

            console.log('⚡ createInstantPaymentERC20:', {
              beneficiary: params.beneficiary,
              tokenAddress: tokenData.address,
              amount: params.amount.toString(),
            });

            writeContract({
              abi: paymentFactoryAbi,
              address: FACTORY_ADDRESS,
              functionName: 'createInstantPaymentERC20',
              args: [
                params.beneficiary,
                tokenData.address as `0x${string}`,
                params.amount, // ✅ Montant exact, pas de fees
              ],
            });
          }
        } else {
          // PAIEMENT PROGRAMMÉ ERC20 (1.79% fees)
          
          // ✅ FIX : Calculer le montant total nécessaire (avec fees)
          const protocolFee = (params.amount * BigInt(179)) / BigInt(10000);
          const totalRequired = params.amount + protocolFee;
          
          // ✅ FIX : Formater les montants pour affichage
          const tokenDecimals = tokenData.decimals || 6;
          const amountFormatted = (Number(params.amount) / (10 ** tokenDecimals)).toFixed(6);
          const totalRequiredFormatted = (Number(totalRequired) / (10 ** tokenDecimals)).toFixed(6);
          const currentAllowanceFormatted = approvalHook.currentAllowance 
            ? (Number(approvalHook.currentAllowance) / (10 ** tokenDecimals)).toFixed(6)
            : 'en cours de vérification...';
          
          console.log('💰 Calcul paiement programmé ERC20:', {
            amount: params.amount.toString(),
            amountFormatted: `${amountFormatted} ${tokenData.symbol}`,
            protocolFee: protocolFee.toString(),
            protocolFeeFormatted: `${(Number(protocolFee) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
            totalRequired: totalRequired.toString(),
            totalRequiredFormatted: `${totalRequiredFormatted} ${tokenData.symbol}`,
            currentAllowance: approvalHook.currentAllowance?.toString() || 'en cours de vérification...',
            currentAllowanceFormatted: `${currentAllowanceFormatted} ${tokenData.symbol}`,
            isAllowanceSufficient: approvalHook.isAllowanceSufficient,
            isCheckingAllowance: approvalHook.isCheckingAllowance,
          });
          
          // ✅ FIX : Vérifier manuellement l'allowance avec le bon montant
          // (car le hook peut ne pas être à jour immédiatement après setCurrentParams)
          // IMPORTANT : Par sécurité, on approuve toujours sauf si l'allowance est clairement supérieure
          const currentAllowance = approvalHook.currentAllowance;
          const isChecking = approvalHook.isCheckingAllowance;
          
          // ✅ FIX : Calculer avec une marge de sécurité (10% de plus) pour éviter les problèmes d'arrondi
          // et permettre une marge confortable pour les fees supplémentaires et les erreurs de timing
          const safetyMargin = (totalRequired * BigInt(110)) / BigInt(100); // +10% de marge (augmenté de 5% à 10%)
          
          // ✅ FIX CRITIQUE : Toujours approuver si :
          // - La vérification est en cours (on ne sait pas encore)
          // - L'allowance est undefined (on ne sait pas)
          // - L'allowance est insuffisante (même avec marge de sécurité)
          // - Le hook a été créé avec un montant incorrect (currentParams était null ou amount était 0 ou 1)
          // - L'allowance est exactement égale à totalRequired (pas de marge, risque d'échec)
          const hookWasCreatedWithIncorrectAmount = !currentParams || currentParams.amount === BigInt(0) || currentParams.amount === BigInt(1);
          const allowanceIsSufficient = !hookWasCreatedWithIncorrectAmount
            && !isChecking
            && currentAllowance !== undefined 
            && currentAllowance >= safetyMargin; // Doit être >= safetyMargin (110% de totalRequired)
          
          console.log('🔍 Vérification allowanceIsSufficient (PAIEMENT PROGRAMMÉ):', {
            token: tokenData.symbol,
            isCheckingAllowance: isChecking,
            hookWasCreatedWithIncorrectAmount,
            hookAmount: currentParams?.amount?.toString() || 'null',
            currentAllowance: currentAllowance?.toString() || 'undefined',
            totalRequired: totalRequired.toString(),
            totalRequiredFormatted: totalRequiredFormatted,
            comparison: currentAllowance !== undefined 
              ? (currentAllowance >= safetyMargin
                  ? `>= ${safetyMargin.toString()} (suffisant avec marge)` 
                  : currentAllowance >= totalRequired
                    ? `>= ${totalRequired.toString()} mais < ${safetyMargin.toString()} (on approuve par sécurité)`
                    : `< ${totalRequired.toString()} (insuffisant)`)
              : 'undefined (insuffisant - on approuve par sécurité)',
            safetyMargin: safetyMargin.toString(),
            safetyMarginFormatted: `${(Number(safetyMargin) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
            allowanceIsSufficient,
            decision: allowanceIsSufficient ? '✅ PAS d\'approbation nécessaire' : '🔐 APPROBATION NÉCESSAIRE',
          });
          
          // ✅ FIX CRITIQUE : TOUJOURS approuver pour les paiements programmés ERC20
          // Le contrat créé fait transferFrom depuis le payer, donc l'allowance doit être donnée au contrat créé
          // Mais comme le contrat n'existe pas encore, on approuve la factory avec un montant élevé
          // Le contrat créé pourra utiliser cette allowance via un mécanisme de délégation
          // OU on approuve toujours pour éviter les problèmes de timing
          console.log('🔐 Approbation nécessaire (toujours approuver pour paiement programmé ERC20):', {
            currentAllowance: approvalHook.currentAllowance?.toString() || 'non disponible',
            totalRequired: totalRequired.toString(),
            safetyMargin: safetyMargin.toString(),
            needsApproval: true,
          });
          setStatus('approving');
          setProgressMessage(`Approbation ${tokenData.symbol}...`);
          
          console.log('📞 Appel de approvalHook.approve() avec montant override...');
          console.log('🔍 Vérification approvalHook:', {
            hasApproveFunction: typeof approvalHook.approve === 'function',
            approveFunction: approvalHook.approve.toString().substring(0, 100),
            isNative: tokenData.isNative,
            tokenSymbol: tokenData.symbol,
          });
          
          try {
            // ✅ FIX : Utiliser le montant exact avec une marge de sécurité de 10%
            // Cela rassure l'utilisateur car il voit exactement combien il approuve
            // Augmenté à 10% pour éviter les problèmes d'arrondi et de timing
            const approvalAmount = (totalRequired * BigInt(110)) / BigInt(100); // +10% de marge (augmenté de 5% à 10%)
            
            console.log('🔐 Montants approbation:', {
              token: tokenData.symbol,
              totalRequired: totalRequired.toString(),
              totalRequiredFormatted: totalRequiredFormatted,
              approvalAmount: approvalAmount.toString(),
              approvalAmountFormatted: `${(Number(approvalAmount) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
              margin: '10%',
            });
            
            // ✅ FIX : Passer le montant avec marge de sécurité
            const approveResult = approvalHook.approve(approvalAmount);
            console.log('✅ approvalHook.approve() appelé avec succès avec montant:', approvalAmount.toString(), 'Résultat:', approveResult);
          } catch (err) {
            console.error('❌ Erreur lors de l\'appel approvalHook.approve():', err);
            setError(err as Error);
            setStatus('error');
            setProgressMessage('Erreur lors de l\'approbation');
          }
          
          // ✅ FIX : Ne pas continuer - on attendra que l'approbation soit confirmée dans le useEffect suivant
          return;
        }
      }
    } catch (err) {
      console.error('Erreur createPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
    }
  };

  // ✅ FIX : Suivre le hash d'approbation pour cette tentative
  useEffect(() => {
    if (approvalHook.approveTxHash && !currentApproveTxHash.current) {
      currentApproveTxHash.current = approvalHook.approveTxHash;
      console.log('✅ Hash d\'approbation capturé pour cette tentative:', approvalHook.approveTxHash);
      console.log('🔗 Voir sur Basescan:', `https://basescan.org/tx/${approvalHook.approveTxHash}`);
    }
  }, [approvalHook.approveTxHash]);
  
  // ✅ FIX : Logs pour suivre l'état de l'approbation
  useEffect(() => {
    console.log('🔍 État approbation:', {
      approveTxHash: approvalHook.approveTxHash,
      isApproveSuccess: approvalHook.isApproveSuccess,
      isApproving: approvalHook.isApproving,
      approveError: approvalHook.approveError,
      status,
    });
  }, [approvalHook.approveTxHash, approvalHook.isApproveSuccess, approvalHook.isApproving, approvalHook.approveError, status]);

  // Effect : Passer de l'approbation à la création
  useEffect(() => {
    // ✅ FIX : Vérifier que l'approbation correspond bien à cette tentative
    // Si currentApproveTxHash n'est pas défini mais qu'on a un hash, on l'accepte (première approbation)
    const approveTxHashMatches = 
      approvalHook.approveTxHash && (
        !currentApproveTxHash.current || // Première approbation
        approvalHook.approveTxHash === currentApproveTxHash.current // Hash correspond
      );

    console.log('🔍 Debug useEffect approbation -> création:', {
      status,
      isApproveSuccess: approvalHook.isApproveSuccess,
      approveTxHashMatches,
      hasCurrentParams: !!currentParams,
      hasToken: !!token,
      isNative: token?.isNative,
      approveTxHash: approvalHook.approveTxHash,
      currentApproveTxHash: currentApproveTxHash.current,
      isApproving: approvalHook.isApproving,
      approveError: approvalHook.approveError,
    });

    // ✅ FIX : Mettre à jour currentApproveTxHash si on a un nouveau hash
    if (approvalHook.approveTxHash && !currentApproveTxHash.current) {
      currentApproveTxHash.current = approvalHook.approveTxHash;
      console.log('✅ Hash d\'approbation mis à jour:', approvalHook.approveTxHash);
    }

    if (
      status === 'approving' &&
      approvalHook.isApproveSuccess &&
      approveTxHashMatches && // ✅ FIX : S'assurer que l'approbation est bien celle de cette tentative
      currentParams &&
      token &&
      !token.isNative
    ) {
      console.log('✅ Conditions remplies, passage à la création...');
      console.log('📋 Détails approbation confirmée:', {
        approveTxHash: approvalHook.approveTxHash,
        isApproveSuccess: approvalHook.isApproveSuccess,
        isApproving: approvalHook.isApproving,
      });
      
      // ✅ NOUVEAU : Détecter à nouveau si instantané
      const now = Math.floor(Date.now() / 1000);
      const isInstantPayment = (currentParams.releaseTime - now) < 60;

      // ✅ FIX : Calculer le montant total requis
      const protocolFee = (currentParams.amount * BigInt(179)) / BigInt(10000);
      const totalRequired = currentParams.amount + protocolFee;
      
      // ✅ FIX : Calculer la marge de sécurité attendue (5%)
      const expectedAllowance = (totalRequired * BigInt(105)) / BigInt(100);
      const currentAllowanceCheck = approvalHook.currentAllowance;
      
      console.log('🔍 Vérification allowance avant création (après approbation):', {
        token: token.symbol,
        currentAllowance: currentAllowanceCheck?.toString() || 'undefined',
        totalRequired: totalRequired.toString(),
        expectedAllowance: expectedAllowance.toString(),
        isAllowanceSufficient: currentAllowanceCheck !== undefined && currentAllowanceCheck >= totalRequired,
      });

      // ✅ FIX : Attendre un peu que l'allowance soit mise à jour (refetch peut prendre du temps)
      // On vérifie l'allowance actuelle et on attend si nécessaire
      const checkAndCreate = async () => {
        if (!address || !token.address || !publicClient) {
          setError(new Error('Paramètres manquants pour vérifier l\'allowance'));
          setStatus('error');
          return;
        }

        // ✅ FIX CRITIQUE : Attendre que la transaction d'approbation soit vraiment confirmée sur la blockchain
        // On attend jusqu'à 20 secondes maximum, en vérifiant toutes les 3 secondes (pour éviter rate limit)
        let latestAllowance: bigint | undefined;
        const maxWaitTime = 20000; // 20 secondes
        const checkInterval = 3000; // 3 secondes (réduit pour éviter rate limit 429)
        const maxChecks = 6; // Maximum 6 vérifications
        let waited = 0;
        let checkCount = 0;
        
        // ✅ FIX : Calculer la marge de sécurité attendue (10%)
        const expectedAllowance = (totalRequired * BigInt(110)) / BigInt(100); // +10% de marge (augmenté de 5% à 10%)
        
        console.log('⏳ Attente confirmation allowance sur la blockchain...');
        console.log('📋 Paramètres vérification:', {
          totalRequired: totalRequired.toString(),
          expectedAllowance: expectedAllowance.toString(),
          checkInterval: `${checkInterval}ms`,
          maxChecks,
        });
        
        // ✅ FIX : Attendre d'abord 5 secondes avant la première vérification (laisser le temps à la transaction d'être confirmée)
        await new Promise(resolve => setTimeout(resolve, 5000));
        waited += 5000;
        
        while (waited < maxWaitTime && checkCount < maxChecks) {
          checkCount++;
          
          try {
            latestAllowance = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: [
                {
                  inputs: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                  ],
                  name: 'allowance',
                  outputs: [{ name: '', type: 'uint256' }],
                  stateMutability: 'view',
                  type: 'function',
                },
              ],
              functionName: 'allowance',
              args: [address, FACTORY_ADDRESS],
            }) as bigint;
            
            // ✅ FIX : Vérifier si l'allowance est suffisante (>= totalRequired avec marge de 10%)
            // On accepte si l'allowance est >= totalRequired (sans marge stricte au moment de la vérification)
            // car la marge est déjà appliquée lors de l'approbation
            const isSufficient = latestAllowance !== undefined && latestAllowance >= totalRequired;
            
            console.log(`🔍 Allowance après ${waited}ms (vérification ${checkCount}/${maxChecks}):`, {
              latestAllowance: latestAllowance?.toString() || 'undefined',
              totalRequired: totalRequired.toString(),
              expectedAllowance: expectedAllowance.toString(),
              isSufficient,
              comparison: latestAllowance !== undefined
                ? (latestAllowance >= totalRequired ? `>= ${totalRequired.toString()} (suffisant)` : `< ${totalRequired.toString()} (insuffisant)`)
                : 'undefined (insuffisant)',
            });
            
            // Si l'allowance est suffisante, on peut continuer
            if (isSufficient) {
              console.log('✅ Allowance suffisante, on peut créer la transaction');
              break;
            }
          } catch (err: any) {
            // ✅ FIX : Gérer les erreurs de rate limit
            if (err?.message?.includes('429') || err?.message?.includes('rate limit')) {
              console.warn('⚠️ Rate limit détecté, attente plus longue avant prochaine vérification...');
              await new Promise(resolve => setTimeout(resolve, 8000)); // Attendre 8 secondes supplémentaires
              waited += 8000;
              continue;
            }
            console.error('❌ Erreur lecture allowance:', err);
          }
          
          // Attendre avant la prochaine vérification
          if (waited < maxWaitTime && checkCount < maxChecks) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
          }
        }
        
        // ✅ FIX : Vérification finale
        const finalIsSufficient = latestAllowance !== undefined && latestAllowance >= totalRequired;
        
        if (!finalIsSufficient) {
          console.error('❌ Allowance insuffisante après attente:', {
            latestAllowance: latestAllowance?.toString() || 'undefined',
            totalRequired: totalRequired.toString(),
            expectedAllowance: expectedAllowance.toString(),
            waited: `${waited}ms`,
            expected: totalRequired.toString(),
          });
          setError(new Error(
            `Allowance insuffisante après approbation. Attendu: >= ${totalRequired.toString()}, Reçu: ${latestAllowance?.toString() || 'undefined'}. Vérifiez que la transaction d'approbation a bien été confirmée.`
          ));
          setStatus('error');
          setProgressMessage('Allowance insuffisante après approbation');
          return;
        }

        // L'approbation est confirmée, lancer la création
        setStatus('creating');
        setProgressMessage(
          isInstantPayment 
            ? '⚡ Paiement instantané...' 
            : 'Création du paiement...'
        );

        if (!token.address) {
          setError(new Error(`Token ${currentParams.tokenSymbol} n'a pas d'adresse de contrat`));
          setStatus('error');
          return;
        }

        // ✅ FIX : Vérifier la balance avant de créer
        if (!address) {
          setError(new Error('Adresse wallet non disponible'));
          setStatus('error');
          return;
        }

        // ✅ FIX CRITIQUE : Vérifier une dernière fois l'allowance juste avant la simulation
        const preSimulationAllowance = await publicClient.readContract({
          address: token.address as `0x${string}`,
          abi: [
            {
              inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
              ],
              name: 'allowance',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'allowance',
          args: [address, FACTORY_ADDRESS],
        }) as bigint;
        
        const preSimulationIsSufficient = preSimulationAllowance >= totalRequired;
        
        console.log('🔍 Vérification finale allowance juste avant création:', {
          preSimulationAllowance: preSimulationAllowance.toString(),
          totalRequired: totalRequired.toString(),
          isSufficient: preSimulationIsSufficient,
        });
        
        if (!preSimulationIsSufficient) {
          console.error('❌ Allowance insuffisante juste avant création:', {
            preSimulationAllowance: preSimulationAllowance.toString(),
            totalRequired: totalRequired.toString(),
            expected: totalRequired.toString(),
          });
          setError(new Error(
            `Allowance insuffisante. Attendu: >= ${totalRequired.toString()}, Reçu: ${preSimulationAllowance.toString()}. Veuillez réapprouver.`
          ));
          setStatus('error');
          setProgressMessage('Allowance insuffisante - veuillez réapprouver');
          return;
        }

        const balance = await readTokenBalance(token.address as `0x${string}`, address);
        const tokenDecimals = token.decimals || 6;
        
        console.log('💰 Vérification balance avant création:', {
          balance: balance?.toString() || 'non disponible',
          balanceFormatted: balance ? `${(Number(balance) / (10 ** tokenDecimals)).toFixed(6)} ${currentParams.tokenSymbol}` : 'non disponible',
          totalRequired: totalRequired.toString(),
          totalRequiredFormatted: `${(Number(totalRequired) / (10 ** tokenDecimals)).toFixed(6)} ${currentParams.tokenSymbol}`,
          isBalanceSufficient: balance ? balance >= totalRequired : false,
        });

        if (balance && balance < totalRequired) {
          console.error('❌ Balance insuffisante pour créer le paiement');
          setError(new Error(`Balance insuffisante. Vous avez ${(Number(balance) / (10 ** tokenDecimals)).toFixed(6)} ${currentParams.tokenSymbol}, mais ${(Number(totalRequired) / (10 ** tokenDecimals)).toFixed(6)} sont nécessaires.`));
          setStatus('error');
          setProgressMessage('Balance insuffisante');
          return;
        }

        // ✅ FIX CRITIQUE : Simuler la transaction AVANT de l'envoyer pour voir l'erreur exacte
        try {
          console.log('🔍 Simulation de la transaction avant envoi...');
          
          if (isInstantPayment) {
            // ⚡ INSTANTANÉ
            await publicClient.simulateContract({
              account: address,
              address: FACTORY_ADDRESS,
              abi: paymentFactoryAbi,
              functionName: 'createInstantPaymentERC20',
              args: [
                currentParams.beneficiary,
                token.address as `0x${string}`,
                currentParams.amount,
              ],
            });
            console.log('✅ Simulation réussie pour paiement instantané');
          } else {
            // PROGRAMMÉ
            await publicClient.simulateContract({
              account: address,
              address: FACTORY_ADDRESS,
              abi: paymentFactoryAbi,
              functionName: 'createPaymentERC20',
              args: [
                currentParams.beneficiary,
                token.address as `0x${string}`,
                currentParams.amount,
                BigInt(currentParams.releaseTime),
                currentParams.cancellable || false,
              ],
            });
            console.log('✅ Simulation réussie pour paiement programmé');
          }
        } catch (simulateError: any) {
          console.error('❌ ERREUR SIMULATION TRANSACTION:', simulateError);
          console.error('❌ Détails erreur:', {
            name: simulateError?.name,
            message: simulateError?.message,
            cause: simulateError?.cause,
            data: simulateError?.data,
            shortMessage: simulateError?.shortMessage,
          });
          
          // Extraire le message d'erreur
          let errorMessage = 'La transaction va échouer. ';
          if (simulateError?.shortMessage) {
            errorMessage += simulateError.shortMessage;
          } else if (simulateError?.message) {
            errorMessage += simulateError.message;
          } else {
            errorMessage += 'Vérifiez votre allowance et votre balance.';
          }
          
          setError(new Error(errorMessage));
          setStatus('error');
          setProgressMessage('Transaction va échouer - voir détails dans la console');
          return;
        }

        if (isInstantPayment) {
          // ⚡ INSTANTANÉ
          console.log('⚡ Création paiement instantané ERC20:', {
            beneficiary: currentParams.beneficiary,
            tokenAddress: token.address,
            amount: currentParams.amount.toString(),
          });
          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createInstantPaymentERC20',
            args: [
              currentParams.beneficiary,
              token.address as `0x${string}`,
              currentParams.amount,
            ],
          });
        } else {
          // PROGRAMMÉ
          console.log('📋 Création paiement programmé ERC20:', {
            beneficiary: currentParams.beneficiary,
            tokenAddress: token.address,
            amountToPayee: currentParams.amount.toString(),
            releaseTime: currentParams.releaseTime,
            releaseTimeDate: new Date(currentParams.releaseTime * 1000).toISOString(),
            cancellable: currentParams.cancellable || false,
          });
          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createPaymentERC20',
            args: [
              currentParams.beneficiary,
              token.address as `0x${string}`,
              currentParams.amount,
              BigInt(currentParams.releaseTime),
              currentParams.cancellable || false,
            ],
          });
        }
      };

      checkAndCreate();
    }
  }, [approvalHook.isApproveSuccess, approvalHook.approveTxHash, status, currentParams, token]);

  // Effect : Extraction de l'adresse du contrat créé ET enregistrement Supabase
  useEffect(() => {
    const extractAndSave = async () => {
      // ✅ FIX : Protection contre les appels multiples
      if (isSavingRef.current) {
        console.log('⏸️ Enregistrement déjà en cours, attente...');
        return;
      }
      
      // ✅ FIX : Vérifier si on a déjà enregistré ce contrat
      if (savedContractAddressRef.current && contractAddress === savedContractAddressRef.current) {
        console.log('✅ Paiement déjà enregistré pour ce contrat:', savedContractAddressRef.current);
        return;
      }
      
      // ✅ FIX : Utiliser le receipt de useWaitForTransactionReceipt si disponible, sinon le récupérer
      if (isConfirmed && createTxHash && publicClient && !contractAddress) {
        console.log('🔍 Début extraction adresse contrat...');
        try {
          setStatus('confirming');
          setProgressMessage('Récupération de l\'adresse du contrat...');

          // ✅ FIX : Utiliser le receipt de useWaitForTransactionReceipt si disponible
          const receiptToUse = receipt || await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          console.log('📋 Receipt complet:', receiptToUse);
          console.log('📋 Receipt status:', receiptToUse.status);
          console.log('📋 Nombre de logs:', receiptToUse.logs.length);

          let foundAddress: `0x${string}` | undefined;

          // ✅ FIX CRITIQUE : Décoder les events PaymentCreated correctement
          // Les events ont paymentContract dans les data, pas dans les topics
          
          // Chercher les logs émis par la factory
          const factoryLogs = receiptToUse.logs.filter(
            log => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
          );

          console.log(`🔍 ${factoryLogs.length} log(s) trouvé(s) depuis la factory`);

          // Essayer de décoder chaque event de création de paiement
          for (const log of factoryLogs) {
            try {
              // Essayer PaymentCreatedETH
              try {
                const decoded = decodeEventLog({
                  abi: paymentFactoryAbi,
                  data: log.data,
                  topics: log.topics as any,
                  eventName: 'PaymentCreatedETH',
                }) as any;
                
                if (decoded?.args?.paymentContract) {
                  foundAddress = decoded.args.paymentContract as `0x${string}`;
                  console.log('✅ Contrat trouvé via PaymentCreatedETH event:', foundAddress);
                  break;
                }
              } catch (e) {
                // Ce n'est pas PaymentCreatedETH, continuer
              }

              // Essayer PaymentCreatedERC20
              try {
                const decoded = decodeEventLog({
                  abi: paymentFactoryAbi,
                  data: log.data,
                  topics: log.topics as any,
                  eventName: 'PaymentCreatedERC20',
                }) as any;
                
                if (decoded?.args?.paymentContract) {
                  foundAddress = decoded.args.paymentContract as `0x${string}`;
                  console.log('✅ Contrat trouvé via PaymentCreatedERC20 event:', foundAddress);
                  break;
                }
              } catch (e) {
                // Ce n'est pas PaymentCreatedERC20, continuer
              }

              // Essayer InstantPaymentCreatedETH
              try {
                const decoded = decodeEventLog({
                  abi: paymentFactoryAbi,
                  data: log.data,
                  topics: log.topics as any,
                  eventName: 'InstantPaymentCreatedETH',
                }) as any;
                
                if (decoded?.args?.paymentContract) {
                  foundAddress = decoded.args.paymentContract as `0x${string}`;
                  console.log('✅ Contrat trouvé via InstantPaymentCreatedETH event:', foundAddress);
                  break;
                }
              } catch (e) {
                // Ce n'est pas InstantPaymentCreatedETH, continuer
              }

              // Essayer InstantPaymentCreatedERC20
              try {
                const decoded = decodeEventLog({
                  abi: paymentFactoryAbi,
                  data: log.data,
                  topics: log.topics as any,
                  eventName: 'InstantPaymentCreatedERC20',
                }) as any;
                
                if (decoded?.args?.paymentContract) {
                  foundAddress = decoded.args.paymentContract as `0x${string}`;
                  console.log('✅ Contrat trouvé via InstantPaymentCreatedERC20 event:', foundAddress);
                  break;
                }
              } catch (e) {
                // Ce n'est pas InstantPaymentCreatedERC20, continuer
              }
            } catch (err) {
              // Erreur de décodage, continuer avec le log suivant
              console.log('⚠️ Erreur décodage event:', err);
            }
          }

          // Méthode de fallback : Si pas trouvé via décodage, chercher dans les logs
          if (!foundAddress) {
            console.log('⚠️ Décodage events échoué, essai méthode fallback...');
            
            // Ignorer les adresses de tokens connus
            const knownTokens = [
              '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC Base
              '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI Base (si utilisé)
            ];
            
            for (const log of receiptToUse.logs) {
              const isKnownToken = knownTokens.some(
                token => log.address.toLowerCase() === token.toLowerCase()
              );
              
              const isFactory = log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase();
              const isPayerAddress = log.address.toLowerCase() === capturedPayerAddress?.toLowerCase();

              // Prendre la première adresse qui n'est ni la factory, ni un token connu, ni le payer
              if (!isFactory && !isKnownToken && !isPayerAddress) {
                foundAddress = log.address as `0x${string}`;
                console.log('✅ Contrat trouvé via méthode fallback:', foundAddress);
                break;
              }
            }
          }

          if (foundAddress) {
            // ✅ FIX : Vérifier si on a déjà enregistré cette adresse
            if (savedContractAddressRef.current === foundAddress) {
              console.log('✅ Paiement déjà enregistré pour ce contrat:', foundAddress);
              setContractAddress(foundAddress);
              setStatus('success');
              setProgressMessage('Paiement créé avec succès !');
              return;
            }
            
            setContractAddress(foundAddress);

            // ✅ FIX : Marquer comme en cours d'enregistrement
            if (isSavingRef.current) {
              console.log('⏸️ Enregistrement déjà en cours pour ce contrat');
              return;
            }
            
            isSavingRef.current = true;

            // Enregistrer dans Supabase via API
            try {
              setProgressMessage('Enregistrement dans la base de données...');
              
              // Capturer les valeurs actuelles
              const params = currentParams;
              const userAddress = capturedPayerAddress;
              
              // ✅ FIX USDC : Recalculer tokenData depuis params au moment de l'enregistrement
              const tokenData = params ? getToken(params.tokenSymbol) : null;

              if (!params || !userAddress) {
                console.error('❌ Paramètres manquants pour enregistrement');
                console.error('❌ DEBUG:', { params, userAddress, capturedPayerAddress, address });
                isSavingRef.current = false;
                setStatus('success');
                setProgressMessage('Paiement créé ! (Non enregistré dans la DB)');
                return;
              }

              console.log('📤 Envoi à l\'API:', {
                contract_address: foundAddress,
                payer_address: userAddress,
                payee_address: params.beneficiary,
                release_time: params.releaseTime,
              });
              
              // ✅ DEBUG USDC : Afficher tokenData complet
              console.log('🔍 DEBUG tokenData:', {
                tokenData: tokenData,
                'tokenData?.address': tokenData?.address,
                'tokenData?.symbol': tokenData?.symbol,
                'params.tokenSymbol': params.tokenSymbol,
                'foundAddress (contract)': foundAddress
              });

              const response = await fetch(`${API_URL}/api/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contract_address: foundAddress,
                  payer_address: userAddress,
                  payee_address: params.beneficiary,
                  token_symbol: params.tokenSymbol,
                  token_address: tokenData?.address || null,
                  amount: params.amount.toString(),
                  release_time: params.releaseTime,
                  cancellable: params.cancellable || false,
                  network: 'base_mainnet',
                  transaction_hash: createTxHash,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                
                // ✅ FIX : Gérer l'erreur de doublon de manière gracieuse (ne pas logger comme erreur)
                if (errorText.includes('duplicate key') || errorText.includes('contract_address')) {
                  console.log('ℹ️ Paiement déjà enregistré (doublon détecté), on continue...');
                  savedContractAddressRef.current = foundAddress;
                  setStatus('success');
                  setProgressMessage('Paiement créé avec succès !');
                  isSavingRef.current = false;
                  return;
                }
                
                // ✅ FIX : Pour les autres erreurs, logger mais ne pas bloquer l'utilisateur
                console.warn('⚠️ Erreur serveur lors de l\'enregistrement (non bloquant):', errorText);
                // Ne pas bloquer l'utilisateur, le paiement est créé sur la blockchain
                savedContractAddressRef.current = foundAddress;
                setStatus('success');
                setProgressMessage('Paiement créé avec succès !');
                isSavingRef.current = false;
                return;
              } else {
                const result = await response.json();
                
                // ✅ FIX : Gérer le cas où le paiement existe déjà (retourné par le backend)
                if (result.alreadyExists) {
                  console.log('⚠️ Paiement déjà enregistré (retourné par le backend)');
                } else {
                  console.log('✅ Paiement enregistré dans Supabase:', result.payment.id);
                }
                
                // ✅ FIX : Marquer comme enregistré
                savedContractAddressRef.current = foundAddress;
                
                // ✅ DEBUG : Afficher ce qui a été enregistré
                console.log('🔍 DEBUG Supabase enregistrement:', {
                  contract_address: result.payment?.contract_address,
                  token_address: result.payment?.token_address,
                  token_symbol: result.payment?.token_symbol,
                  alreadyExists: result.alreadyExists || false
                });
              }
            } catch (apiError) {
              console.error('❌ Erreur API:', apiError);
            } finally {
              // ✅ FIX : Libérer le flag même en cas d'erreur
              isSavingRef.current = false;
            }

            setStatus('success');
            setProgressMessage('Paiement créé avec succès !');
          } else {
            console.error('❌ Impossible de trouver l\'adresse');
            // ✅ FIX : Même si on ne trouve pas l'adresse, on passe à success avec le hash
            setStatus('success');
            setProgressMessage('Paiement créé ! (Vérifiez Basescan)');
          }
        } catch (err) {
          console.error('❌ Erreur:', err);
          // ✅ FIX : Même en cas d'erreur, on passe à success avec le hash de transaction
          setStatus('success');
          setProgressMessage('Transaction confirmée !');
        }
      } else if (isConfirmed && createTxHash && !contractAddress) {
        // ✅ FIX : Fallback si l'extraction échoue mais que la transaction est confirmée
        console.log('⚠️ Transaction confirmée mais extraction adresse en cours ou échouée, passage à success...');
        setStatus('success');
        setProgressMessage('Transaction confirmée !');
      }
    };

    extractAndSave();
  }, [isConfirmed, createTxHash, publicClient, contractAddress, receipt]);

  // Effect : Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      console.error('❌ Erreur writeContract détectée:', writeError);
      console.error('❌ Détails erreur:', {
        name: writeError.name,
        message: writeError.message,
        cause: writeError.cause,
        stack: writeError.stack,
      });
      
      // ✅ FIX : Annuler le timeout si erreur
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // ✅ FIX : Message d'erreur plus détaillé
      let errorMessage = 'Transaction annulée ou échouée.';
      if (writeError.message.includes('User rejected') || writeError.message.includes('User denied')) {
        errorMessage = 'Transaction annulée par l\'utilisateur dans MetaMask.';
      } else if (writeError.message.includes('insufficient funds') || writeError.message.includes('balance')) {
        errorMessage = 'Balance insuffisante pour effectuer cette transaction.';
      } else if (writeError.message.includes('allowance') || writeError.message.includes('approval')) {
        errorMessage = 'Allowance insuffisante. Veuillez approuver à nouveau le token.';
      }
      
      setError(writeError as Error);
      setStatus('error');
      setProgressMessage(errorMessage);
    }
    if (confirmError) {
      console.error('❌ Erreur confirmation transaction détectée:', confirmError);
      console.error('❌ Détails erreur confirmation:', {
        name: confirmError.name,
        message: confirmError.message,
        cause: confirmError.cause,
        stack: confirmError.stack,
      });
      
      // ✅ FIX : Annuler le timeout si erreur
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setError(confirmError as Error);
      setStatus('error');
      setProgressMessage('Erreur de confirmation de la transaction');
    }
  }, [writeError, confirmError]);
  
  // ✅ FIX : Nettoyer le timeout quand le status change vers success ou error
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [status]);

  // Reset
  const reset = () => {
    // ✅ FIX : Annuler le timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus('idle');
    setError(null);
    setContractAddress(undefined);
    setCurrentParams(null);
    setProgressMessage('');
    setCapturedPayerAddress(undefined);
    currentApproveTxHash.current = undefined; // ✅ FIX : Reset hash d'approbation
    isSavingRef.current = false; // ✅ FIX : Reset flag d'enregistrement
    savedContractAddressRef.current = undefined; // ✅ FIX : Reset adresse enregistrée
    resetWrite();
    approvalHook.reset();
  };

  // Calculer les steps
  const totalSteps = token?.isNative ? 1 : 2;
  let currentStep = 0;
  if (status === 'approving') currentStep = 1;
  if (status === 'creating' || status === 'confirming') currentStep = token?.isNative ? 1 : 2;
  if (status === 'success') currentStep = totalSteps;

  return {
    status,
    error,
    approveTxHash: approvalHook.approveTxHash,
    createTxHash,
    contractAddress,
    createPayment,
    reset,
    currentStep,
    totalSteps,
    progressMessage,
  };
}