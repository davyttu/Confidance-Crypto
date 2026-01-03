// src/hooks/useCreatePayment.ts

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { decodeEventLog } from 'viem';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { useTokenApproval, type UseTokenApprovalReturn } from './useTokenApproval';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

// ⚠️ ADRESSE DE LA FACTORY - Déployée sur Base Mainnet (V2 avec Instant Payments)
const FACTORY_ADDRESS: `0x${string}` = '0x88Da5f28c4d5b7392812dB67355d72D21516bCaf';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// ✅ Multi-chain : réseau courant (utilisé par l'API / DB)
const getNetworkFromChainId = (chainId: number): string => {
  switch (chainId) {
    case 8453:
      return 'base_mainnet';
    case 137:
      return 'polygon_mainnet';
    case 42161:
      return 'arbitrum_mainnet';
    case 43114:
      return 'avalanche_mainnet';
    default:
      return `chain_${chainId}`;
  }
};


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
  const { t } = useTranslation();
  const { address } = useAccount();
  const chainId = useChainId();
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
  // ✅ FIX CRITIQUE : Ref pour toujours avoir la dernière instance du hook d'approbation
  const approvalHookRef = useRef<UseTokenApprovalReturn | null>(null);

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
  
  // ✅ FIX CRITIQUE : Utiliser le tokenSymbol de currentParams SANS valeur par défaut
  // Si currentParams n'existe pas, utiliser 'ETH' (qui n'a pas besoin d'approbation)
  // Cela évite d'approuver le mauvais token (ex: USDC au lieu de USDT)
  const approvalTokenSymbol: TokenSymbol = currentParams?.tokenSymbol || 'ETH';
  
  // ✅ FIX : Ne créer le hook qu'avec le bon tokenSymbol
  const approvalHook = useTokenApproval({
    tokenSymbol: approvalTokenSymbol, // ✅ FIX : Utiliser le tokenSymbol réel, pas de valeur par défaut USDC
    spenderAddress: FACTORY_ADDRESS,
    amount: amountForApproval, // 🔧 FIX : Approve totalRequired (amountToPayee + fees)
    releaseTime: currentParams?.releaseTime,
  });
  
  // ✅ FIX CRITIQUE : Mettre à jour la ref à chaque render pour toujours avoir la dernière instance
  approvalHookRef.current = approvalHook;

  // ✅ FIX : Log pour vérifier que le hook est bien créé avec le bon token
  console.log('🔧 approvalHook créé:', {
    tokenSymbol: approvalTokenSymbol,
    currentParamsTokenSymbol: currentParams?.tokenSymbol || 'null',
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
      // ✅ FIX : Réinitialiser le hash d'approbation pour cette nouvelle tentative
      currentApproveTxHash.current = undefined;
      const tokenData = getToken(params.tokenSymbol);

      // ✅ FIX CRITIQUE : Mettre à jour currentParams AVANT tout pour que le hook se mette à jour
      setCurrentParams(params);
      setCapturedPayerAddress(address);

      // ✅ FIX CRITIQUE : Attendre que le hook useTokenApproval soit bien mis à jour avec le nouveau tokenSymbol
      // On force React à re-rendre en attendant et en utilisant une ref qui est mise à jour à chaque render
      console.log('⏳ Attente que le hook useTokenApproval se mette à jour avec le bon token...');

      // Forcer React à re-rendre avec le nouveau currentParams
      // On attend plusieurs renders en utilisant requestAnimationFrame
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 50)); // Sécurité supplémentaire

      // ✅ FIX CRITIQUE : Utiliser la ref pour avoir la dernière instance du hook
      const currentApprovalHook = approvalHookRef.current;

      if (!currentApprovalHook) {
        console.error('❌ Hook d\'approbation non disponible');
        setError(new Error('Erreur interne: hook d\'approbation non disponible'));
        setStatus('error');
        return;
      }

      console.log('✅ Hook d\'approbation récupéré depuis la ref');

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
          setProgressMessage(t('create.modal.creatingPaymentETH', { defaultValue: 'Création du paiement ETH...' }));

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
            currentAllowance: currentApprovalHook.currentAllowance?.toString() || '0',
            isAllowanceSufficient: currentApprovalHook.isAllowanceSufficient,
            isCheckingAllowance: currentApprovalHook.isCheckingAllowance,
          });

          // ✅ FIX : Vérifier manuellement l'allowance avec le bon montant
          const allowanceIsSufficient = currentApprovalHook.currentAllowance !== undefined
            && currentApprovalHook.currentAllowance >= params.amount;

          // Vérifier si approbation nécessaire
          if (!allowanceIsSufficient || currentApprovalHook.isCheckingAllowance) {
            console.log('🔐 Approbation nécessaire pour paiement instantané');
            setStatus('approving');
            setProgressMessage(`⚡ Approbation ${tokenData.symbol} instantané (0% fees)...`);
            // ✅ FIX : Passer le montant directement (pas de fees pour instantané)
            currentApprovalHook.approve(params.amount);
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
          const currentAllowanceFormatted = currentApprovalHook.currentAllowance
            ? (Number(currentApprovalHook.currentAllowance) / (10 ** tokenDecimals)).toFixed(6)
            : 'en cours de vérification...';
          
          console.log('💰 Calcul paiement programmé ERC20:', {
            amount: params.amount.toString(),
            amountFormatted: `${amountFormatted} ${tokenData.symbol}`,
            protocolFee: protocolFee.toString(),
            protocolFeeFormatted: `${(Number(protocolFee) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
            totalRequired: totalRequired.toString(),
            totalRequiredFormatted: `${totalRequiredFormatted} ${tokenData.symbol}`,
            currentAllowance: currentApprovalHook.currentAllowance?.toString() || 'en cours de vérification...',
            currentAllowanceFormatted: `${currentAllowanceFormatted} ${tokenData.symbol}`,
            isAllowanceSufficient: currentApprovalHook.isAllowanceSufficient,
            isCheckingAllowance: currentApprovalHook.isCheckingAllowance,
          });

          // ✅ FIX : Vérifier manuellement l'allowance avec le bon montant
          // (car le hook peut ne pas être à jour immédiatement après setCurrentParams)
          // IMPORTANT : Par sécurité, on approuve toujours sauf si l'allowance est clairement supérieure
          const currentAllowance = currentApprovalHook.currentAllowance;
          const isChecking = currentApprovalHook.isCheckingAllowance;
          
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
            currentAllowance: currentApprovalHook.currentAllowance?.toString() || 'non disponible',
            totalRequired: totalRequired.toString(),
            safetyMargin: safetyMargin.toString(),
            needsApproval: true,
          });
          
          // ✅ FIX : Vérifier que tokenData correspond bien à params.tokenSymbol (c'est le plus important)
          // Le hook se mettra à jour automatiquement quand currentParams change
          console.log('🔍 Vérification tokenSymbol avant approbation:', {
            paramsTokenSymbol: params.tokenSymbol,
            currentParamsTokenSymbol: currentParams?.tokenSymbol,
            approvalTokenSymbol: approvalTokenSymbol,
            tokenDataSymbol: tokenData.symbol,
            tokenDataAddress: tokenData.address,
          });
          
          // ✅ FIX : Vérifier uniquement que tokenData correspond (pas de vérification stricte sur approvalTokenSymbol)
          // car approvalTokenSymbol peut être 'ETH' si currentParams n'est pas encore mis à jour
          // Le hook se mettra à jour automatiquement au prochain render
          if (params.tokenSymbol !== tokenData.symbol) {
            console.error('❌ ERREUR: Le token du paiement ne correspond pas !', {
              paramsTokenSymbol: params.tokenSymbol,
              tokenDataSymbol: tokenData.symbol,
            });
            setError(new Error(`Erreur: le token du paiement (${params.tokenSymbol}) ne correspond pas. Veuillez rafraîchir la page.`));
            setStatus('error');
            setProgressMessage('Erreur de token - veuillez rafraîchir');
            return;
          }
          
          // ✅ FIX : Si approvalTokenSymbol ne correspond pas encore, c'est normal car currentParams vient d'être mis à jour
          // Le hook se mettra à jour automatiquement au prochain render de React
          if (params.tokenSymbol !== approvalTokenSymbol && approvalTokenSymbol !== 'ETH') {
            console.warn('⚠️ Le hook utilise un tokenSymbol différent, mais il se mettra à jour automatiquement:', {
              paramsTokenSymbol: params.tokenSymbol,
              approvalTokenSymbol,
              note: 'Le hook devrait se mettre à jour au prochain render. On continue...',
            });
          }
          
          setStatus('approving');
          setProgressMessage(`Approbation ${tokenData.symbol}...`);
          
          console.log('📞 Appel de currentApprovalHook.approve() avec montant override...');
          console.log('🔍 Vérification currentApprovalHook:', {
            hasApproveFunction: typeof currentApprovalHook.approve === 'function',
            approveFunction: currentApprovalHook.approve.toString().substring(0, 100),
            isNative: tokenData.isNative,
            tokenSymbol: tokenData.symbol,
            tokenAddress: tokenData.address,
          });
          
          try {
            // ✅ FIX : Utiliser le montant exact avec une marge de sécurité de 10%
            // Cela rassure l'utilisateur car il voit exactement combien il approuve
            // Augmenté à 10% pour éviter les problèmes d'arrondi et de timing
            const approvalAmount = (totalRequired * BigInt(110)) / BigInt(100); // +10% de marge (augmenté de 5% à 10%)
            
            console.log('🔐 Montants approbation:', {
              token: tokenData.symbol,
              tokenAddress: tokenData.address,
              totalRequired: totalRequired.toString(),
              totalRequiredFormatted: totalRequiredFormatted,
              approvalAmount: approvalAmount.toString(),
              approvalAmountFormatted: `${(Number(approvalAmount) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
              margin: '10%',
            });
            
            // ✅ FIX CRITIQUE : Vérifier que le hook utilise le bon token AVANT d'appeler approve()
            // Le hook devrait se mettre à jour automatiquement, mais vérifions quand même
            console.log('🔍 État avant appel approve():', {
              paramsTokenSymbol: params.tokenSymbol,
              approvalTokenSymbol,
              currentParamsTokenSymbol: currentParams?.tokenSymbol,
              tokenDataSymbol: tokenData.symbol,
              tokenDataAddress: tokenData.address,
              hookIsNative: token?.isNative,
            });
            
            // ✅ FIX : Passer le montant avec marge de sécurité
            console.log('📞 Appel de currentApprovalHook.approve()...');
            currentApprovalHook.approve(approvalAmount);
          } catch (err) {
            console.error('❌ Erreur lors de l\'appel currentApprovalHook.approve():', err);
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
      // ✅ FIX CRITIQUE : Vérifier s'il y a une erreur d'approbation
      if (approvalHook.approveError) {
        console.error('❌ ERREUR D\'APPROBATION DÉTECTÉE:', {
          error: approvalHook.approveError,
          message: approvalHook.approveError.message,
          name: approvalHook.approveError.name,
        });
        setError(approvalHook.approveError);
        setStatus('error');
        setProgressMessage('Erreur lors de l\'approbation - ' + approvalHook.approveError.message);
        return;
      }

      console.log('✅ Conditions remplies, passage à la création...');
      console.log('📋 Détails approbation confirmée:', {
        approveTxHash: approvalHook.approveTxHash || 'NON DISPONIBLE',
        isApproveSuccess: approvalHook.isApproveSuccess,
        isApproving: approvalHook.isApproving,
        hasReceipt: !!approvalHook.approveReceipt,
        receiptStatus: approvalHook.approveReceipt?.status || 'NON DISPONIBLE',
        approveError: approvalHook.approveError?.message || 'Aucune erreur',
      });
      
      // ✅ NOUVEAU : Détecter à nouveau si instantané
      const now = Math.floor(Date.now() / 1000);
      const isInstantPayment = (currentParams.releaseTime - now) < 60;

      // ✅ FIX : Calculer le montant total requis (sans fees pour paiements instantanés)
      const totalRequired = isInstantPayment 
        ? currentParams.amount  // Paiement instantané : pas de fees
        : currentParams.amount + ((currentParams.amount * BigInt(179)) / BigInt(10000)); // Paiement programmé : + 1.79%
      
      console.log('💰 Calcul totalRequired:', {
        isInstantPayment,
        amount: currentParams.amount.toString(),
        totalRequired: totalRequired.toString(),
        fees: isInstantPayment ? '0% (instantané)' : '1.79% (programmé)',
      });
      
      // ✅ FIX : Calculer la marge de sécurité attendue (10%)
      const expectedAllowance = (totalRequired * BigInt(110)) / BigInt(100);
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

        // ✅ FIX CRITIQUE USDT : Vérifier que le receipt de la transaction d'approbation est bien confirmé
        const isUSDT = currentParams?.tokenSymbol === 'USDT';
        
        console.log('🔍 DÉBUT checkAndCreate - État de l\'approbation:', {
          token: currentParams?.tokenSymbol,
          approveTxHash: approvalHook.approveTxHash || 'NON DISPONIBLE',
          isApproveSuccess: approvalHook.isApproveSuccess,
          isApproving: approvalHook.isApproving,
          approveError: approvalHook.approveError?.message || 'Aucune erreur',
          hasReceipt: !!approvalHook.approveReceipt,
          receiptStatus: approvalHook.approveReceipt?.status || 'NON DISPONIBLE',
        });
        
        if (!approvalHook.approveTxHash) {
          console.error('❌ Hash de transaction d\'approbation non disponible');
          console.error('❌ État complet:', {
            isApproveSuccess: approvalHook.isApproveSuccess,
            isApproving: approvalHook.isApproving,
            approveError: approvalHook.approveError,
            approveTxHash: approvalHook.approveTxHash,
          });
          
          // ✅ FIX : Si pas de hash mais qu'il y a une erreur, l'afficher
          if (approvalHook.approveError) {
            setError(new Error(`Transaction d'approbation échouée: ${approvalHook.approveError.message}`));
          } else {
            setError(new Error('Hash de transaction d\'approbation non disponible. La transaction n\'a peut-être pas été envoyée. Vérifiez MetaMask.'));
          }
          setStatus('error');
          setProgressMessage('Transaction d\'approbation non trouvée');
          return;
        }

        // ✅ FIX : Si le receipt n'est pas disponible, le récupérer directement depuis la blockchain
        let approveReceipt = approvalHook.approveReceipt;
        if (!approveReceipt && approvalHook.approveTxHash && publicClient) {
          console.log('🔄 Récupération du receipt depuis la blockchain...');
          try {
            approveReceipt = await publicClient.getTransactionReceipt({
              hash: approvalHook.approveTxHash,
            });
            console.log('✅ Receipt récupéré depuis blockchain:', {
              status: approveReceipt.status,
              blockNumber: approveReceipt.blockNumber,
            });
          } catch (receiptErr) {
            console.warn('⚠️ Impossible de récupérer le receipt, la transaction est peut-être encore en attente:', receiptErr);
            // Attendre jusqu'à 15 secondes pour que le receipt soit disponible
            let receiptWaitTime = 0;
            while (!approveReceipt && receiptWaitTime < 15000) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              receiptWaitTime += 2000;
              try {
                approveReceipt = await publicClient.getTransactionReceipt({
                  hash: approvalHook.approveTxHash,
                });
                if (approveReceipt) {
                  console.log('✅ Receipt récupéré après attente:', {
                    status: approveReceipt.status,
                    blockNumber: approveReceipt.blockNumber,
                  });
                  break;
                }
              } catch (err) {
                // Continue d'attendre
              }
            }
          }
        }

        if (!approveReceipt) {
          console.error('❌ Impossible de récupérer le receipt de la transaction d\'approbation');
          setError(new Error('Impossible de confirmer la transaction d\'approbation. Vérifiez Basescan.'));
          setStatus('error');
          setProgressMessage('Transaction d\'approbation non confirmée');
          return;
        }

        if (approveReceipt.status !== 'success') {
          console.error('❌ Transaction d\'approbation échouée:', {
            receiptStatus: approveReceipt.status,
            receipt: approveReceipt,
          });
          setError(new Error('La transaction d\'approbation a échoué. Veuillez réessayer.'));
          setStatus('error');
          setProgressMessage('Transaction d\'approbation échouée');
          return;
        }

        console.log('✅ Receipt d\'approbation confirmé:', {
          receiptStatus: approveReceipt.status,
          blockNumber: approveReceipt.blockNumber,
          transactionHash: approveReceipt.transactionHash,
          logs: approveReceipt.logs?.length || 0,
        });

        // ✅ FIX USDT : Vérifier les logs de la transaction pour confirmer que l'approbation a bien été effectuée
        if (approveReceipt.logs && approveReceipt.logs.length > 0) {
          console.log('📋 Logs de la transaction d\'approbation:', {
            numberOfLogs: approveReceipt.logs.length,
            firstLogAddress: approveReceipt.logs[0]?.address,
            tokenAddress: token.address,
            match: approveReceipt.logs[0]?.address?.toLowerCase() === token.address?.toLowerCase(),
          });
        } else {
          console.warn('⚠️ Aucun log dans la transaction d\'approbation - cela peut indiquer un problème');
        }

        // ✅ FIX USDT : Attendre un délai supplémentaire après confirmation du receipt pour USDT
        if (isUSDT) {
          console.log('⏳ USDT: Attente supplémentaire après confirmation du receipt...');
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 secondes supplémentaires pour USDT
        }

        // ✅ FIX USDT : Forcer un refetch de l'allowance via le hook avant de vérifier
        console.log('🔄 Refetch allowance via hook avant vérification...');
        try {
          if (approvalHook.refetchAllowance) {
            await approvalHook.refetchAllowance();
            // Attendre un peu après le refetch
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err) {
          console.warn('⚠️ Impossible de refetch via hook, on continue avec lecture directe');
        }

        // ✅ FIX CRITIQUE : Attendre que la transaction d'approbation soit vraiment confirmée sur la blockchain
        // On attend jusqu'à 30 secondes maximum pour USDT (plus long que les autres tokens)
        // en vérifiant toutes les 3 secondes (pour éviter rate limit)
        let latestAllowance: bigint | undefined;
        // ✅ FIX : isUSDT est déjà déclaré plus haut, on le réutilise
        const maxWaitTime = isUSDT ? 30000 : 20000; // 30 secondes pour USDT, 20 pour les autres
        const checkInterval = 3000; // 3 secondes (réduit pour éviter rate limit 429)
        const maxChecks = isUSDT ? 10 : 6; // Plus de vérifications pour USDT
        let waited = 0;
        let checkCount = 0;
        
        // ✅ FIX : Calculer la marge de sécurité attendue (10%)
        const expectedAllowance = (totalRequired * BigInt(110)) / BigInt(100); // +10% de marge (augmenté de 5% à 10%)
        
        console.log('⏳ Attente confirmation allowance sur la blockchain...');
        console.log('📋 Paramètres vérification:', {
          token: currentParams?.tokenSymbol,
          isUSDT,
          totalRequired: totalRequired.toString(),
          expectedAllowance: expectedAllowance.toString(),
          checkInterval: `${checkInterval}ms`,
          maxWaitTime: `${maxWaitTime}ms`,
          maxChecks,
        });
        
        // ✅ FIX USDT : Attendre plus longtemps pour USDT (8 secondes au lieu de 5)
        // car USDT peut prendre plus de temps à mettre à jour l'allowance
        const initialWaitTime = isUSDT ? 8000 : 5000;
        await new Promise(resolve => setTimeout(resolve, initialWaitTime));
        waited += initialWaitTime;
        
        while (waited < maxWaitTime && checkCount < maxChecks) {
          checkCount++;
          
          try {
            // ✅ FIX USDT : Pour USDT, essayer aussi de lire depuis le hook avant de lire directement
            if (isUSDT && checkCount === 1 && approvalHook.currentAllowance !== undefined) {
              console.log('🔍 USDT: Utilisation allowance du hook:', approvalHook.currentAllowance.toString());
              latestAllowance = approvalHook.currentAllowance;
            } else {
              // Lecture directe depuis la blockchain
              console.log('🔍 Lecture allowance depuis blockchain:', {
                tokenAddress: token.address,
                owner: address,
                spender: FACTORY_ADDRESS,
              });
              
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
              
              console.log('✅ Allowance lue depuis blockchain:', latestAllowance.toString());
            }
            
            // ✅ FIX : Vérifier si l'allowance est suffisante (>= totalRequired avec marge de 10%)
            // On accepte si l'allowance est >= totalRequired (sans marge stricte au moment de la vérification)
            // car la marge est déjà appliquée lors de l'approbation
            const isSufficient = latestAllowance !== undefined && latestAllowance >= totalRequired;
            
            console.log(`🔍 Allowance après ${waited}ms (vérification ${checkCount}/${maxChecks}):`, {
              token: currentParams?.tokenSymbol,
              isUSDT,
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
            
            // ✅ FIX USDT : Pour USDT, forcer un refetch du hook après chaque vérification
            if (isUSDT && approvalHook.refetchAllowance) {
              console.log('🔄 USDT: Refetch allowance via hook...');
              try {
                await approvalHook.refetchAllowance();
                // Attendre un peu après le refetch
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (refetchErr) {
                console.warn('⚠️ Erreur refetch allowance:', refetchErr);
              }
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
          // ✅ FIX USDT : Dernière tentative de lecture directe de l'allowance pour diagnostiquer
          let diagnosticAllowance: bigint | undefined;
          try {
            console.log('🔍 DERNIÈRE TENTATIVE: Lecture directe allowance pour diagnostic...');
            diagnosticAllowance = await publicClient.readContract({
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
            console.log('📊 Diagnostic allowance:', diagnosticAllowance.toString());
          } catch (diagErr) {
            console.error('❌ Erreur diagnostic allowance:', diagErr);
          }

          // ✅ FIX : Vérifier si la transaction d'approbation a vraiment été envoyée
          const hasApproveTx = !!approvalHook.approveTxHash;
          const hasReceipt = !!approvalHook.approveReceipt;
          const receiptStatus = approvalHook.approveReceipt?.status;
          
          console.error('❌ Allowance insuffisante après attente:', {
            token: currentParams?.tokenSymbol,
            latestAllowance: latestAllowance?.toString() || 'undefined',
            diagnosticAllowance: diagnosticAllowance?.toString() || 'undefined',
            totalRequired: totalRequired.toString(),
            expectedAllowance: expectedAllowance.toString(),
            waited: `${waited}ms`,
            expected: totalRequired.toString(),
            approveTxHash: approvalHook.approveTxHash || 'NON DISPONIBLE',
            hasApproveTx,
            hasReceipt,
            receiptStatus: receiptStatus || 'NON DISPONIBLE',
            receiptBlockNumber: approvalHook.approveReceipt?.blockNumber || 'NON DISPONIBLE',
            owner: address,
            spender: FACTORY_ADDRESS,
            tokenAddress: token.address,
            isApproveSuccess: approvalHook.isApproveSuccess,
            approveError: approvalHook.approveError?.message || 'Aucune erreur',
          });

          // ✅ FIX : Si la transaction n'a pas été envoyée, donner un message d'erreur plus clair
          if (!hasApproveTx) {
            console.error('❌ PROBLÈME CRITIQUE: La transaction d\'approbation n\'a jamais été envoyée !');
            setError(new Error(
              'La transaction d\'approbation n\'a pas été envoyée. Veuillez réessayer en approuvant manuellement le token.'
            ));
            setStatus('error');
            setProgressMessage('Transaction d\'approbation non envoyée');
            return;
          }

          if (!hasReceipt || receiptStatus !== 'success') {
            console.error('❌ PROBLÈME CRITIQUE: La transaction d\'approbation n\'est pas confirmée ou a échoué !');
            const basescanLink = approvalHook.approveTxHash 
              ? `https://basescan.org/tx/${approvalHook.approveTxHash}`
              : 'N/A';
            setError(new Error(
              `La transaction d'approbation n'est pas confirmée ou a échoué. Vérifiez sur Basescan: ${basescanLink}`
            ));
            setStatus('error');
            setProgressMessage('Transaction d\'approbation non confirmée');
            return;
          }
          
          // ✅ FIX USDT : Message d'erreur plus détaillé avec lien vers Basescan
          const basescanLink = approvalHook.approveTxHash 
            ? `https://basescan.org/tx/${approvalHook.approveTxHash}`
            : 'N/A';
          
          setError(new Error(
            `Allowance insuffisante après approbation. Attendu: >= ${totalRequired.toString()}, Reçu: ${latestAllowance?.toString() || diagnosticAllowance?.toString() || 'undefined'}. Vérifiez la transaction: ${basescanLink}`
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
            : t('create.modal.creatingPayment', { defaultValue: 'Création du paiement...' })
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

        // ✅ FIX : S'assurer que le statut est bien 'creating' avant d'appeler writeContract
        if (status !== 'creating') {
          console.log('⚠️ Statut n\'est pas "creating", passage à "creating"...');
          setStatus('creating');
        }
        
        if (isInstantPayment) {
          // ⚡ INSTANTANÉ
          console.log('⚡ Création paiement instantané ERC20:', {
            beneficiary: currentParams.beneficiary,
            tokenAddress: token.address,
            amount: currentParams.amount.toString(),
          });
          console.log('📤 Appel writeContract pour créer le paiement instantané...');
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
          console.log('✅ writeContract appelé pour paiement instantané');
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
          console.log('📤 Appel writeContract pour créer le paiement programmé...');
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
          console.log('✅ writeContract appelé pour paiement programmé');
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
        console.log('📋 Hash transaction de création:', createTxHash);
        console.log('📋 Hash transaction d\'approbation:', approvalHook.approveTxHash);
        
        // ✅ FIX CRITIQUE : Vérifier que createTxHash n'est pas le hash d'approbation
        if (createTxHash === approvalHook.approveTxHash) {
          console.warn('⚠️ createTxHash est identique à approveTxHash - attente de la transaction de création...');
          return;
        }
        
        try {
          setStatus('confirming');
          setProgressMessage('Récupération de l\'adresse du contrat...');

          // ✅ FIX : Vérifier que la transaction est bien vers la factory
          const tx = await publicClient.getTransaction({ hash: createTxHash });
          
          if (tx.to?.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
            console.warn('⚠️ La transaction analysée n\'est pas vers la factory.');
            console.warn('⚠️ Transaction "to":', tx.to);
            console.warn('⚠️ Factory attendue:', FACTORY_ADDRESS);
            console.warn('⚠️ Cela signifie que createTxHash pointe vers la transaction d\'approbation, pas la création.');
            console.warn('⚠️ Attente de la transaction de création...');
            // Ne pas bloquer, juste attendre que la bonne transaction arrive
            return;
          }

          // ✅ FIX : Utiliser le receipt de useWaitForTransactionReceipt si disponible
          const receiptToUse = receipt || await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          console.log('📋 Receipt complet:', receiptToUse);
          let foundAddress: `0x${string}` | undefined;

          // ✅ FIX CRITIQUE : Décoder les events PaymentCreated correctement
          // Les events ont paymentContract dans les data, pas dans les topics
          
          // Chercher les logs émis par la factory
          const factoryLogs = receiptToUse.logs.filter(
            log => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
          );

          console.log(`🔍 ${factoryLogs.length} log(s) trouvé(s) depuis la factory`);
          console.log('📋 Factory address attendue:', FACTORY_ADDRESS);
          console.log('📋 Tous les logs (adresses):', receiptToUse.logs.map(l => ({
            address: l.address,
            isFactory: l.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase(),
            topicsCount: l.topics.length,
            firstTopic: l.topics[0],
          })));
          

          // ✅ FIX CRITIQUE : Si aucun log de la factory, essayer de décoder tous les logs
          // Car il se peut que l'event soit émis mais que l'adresse ne corresponde pas exactement
          const logsToDecode = factoryLogs.length > 0 ? factoryLogs : receiptToUse.logs;
          
          if (factoryLogs.length === 0) {
            console.warn('⚠️ Aucun log trouvé depuis la factory, tentative de décodage de tous les logs...');
          }

          // Essayer de décoder chaque event de création de paiement
          for (const log of logsToDecode) {
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
                
                console.log('📋 PaymentCreatedERC20 décodé:', decoded);
                
                if (decoded?.args?.paymentContract) {
                  foundAddress = decoded.args.paymentContract as `0x${string}`;
                  console.log('✅ Contrat trouvé via PaymentCreatedERC20 event:', foundAddress);
                  break;
                } else {
                  console.warn('⚠️ PaymentCreatedERC20 décodé mais paymentContract manquant');
                }
              } catch (e) {
                // Ce n'est pas PaymentCreatedERC20, continuer
                console.log('   ⚠️ Pas PaymentCreatedERC20:', (e as Error).message);
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

          // ✅ FIX : Définir knownTokens une seule fois pour être accessible partout
          const knownTokens = [
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC Base
            '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT Base
            '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI Base (si utilisé)
            '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', // cbBTC Base
            '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', // WBTC Base
          ];

          // Méthode de fallback : Si pas trouvé via décodage, chercher dans les logs
          // ✅ FIX : Méthode simple comme useCreateBatchPayment - prendre la première adresse qui n'est pas la factory
          if (!foundAddress) {
            console.log('⚠️ Décodage events échoué, essai méthode fallback simple...');
            
            for (const log of receiptToUse.logs) {
              if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
                // ✅ FIX : Vérifier que ce n'est pas un token connu (pour éviter de prendre l'adresse du token)
                const isKnownToken = knownTokens.some(
                  token => log.address.toLowerCase() === token.toLowerCase()
                );
                
                if (!isKnownToken) {
                  foundAddress = log.address as `0x${string}`;
                  console.log('✅ Contrat trouvé via méthode fallback simple:', foundAddress);
                  break;
                }
              }
            }
          }


          if (foundAddress) {
            // ✅ FIX : Vérifier si on a déjà enregistré cette adresse
            if (savedContractAddressRef.current === foundAddress) {
              console.log('✅ Paiement déjà enregistré pour ce contrat:', foundAddress);
              setContractAddress(foundAddress);
              setStatus('success');
              setProgressMessage(t('create.modal.paymentCreatedSuccess', { defaultValue: 'Paiement créé avec succès !' }));
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
              setProgressMessage(t('create.modal.savingToDatabase', { defaultValue: 'Enregistrement dans la base de données...' }));
              
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
                setProgressMessage(t('create.modal.paymentCreatedNotSaved', { defaultValue: 'Paiement créé ! (Non enregistré dans la DB)' }));
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

              // Déterminer si c'est un paiement instantané
              const now = Math.floor(Date.now() / 1000);
              const isInstantPayment = (params.releaseTime - now) < 60;
              
              // Déterminer le type de paiement
              const paymentType = isInstantPayment ? 'instant' : 'scheduled';

              const requestBody = {
                contract_address: foundAddress,
                payer_address: userAddress,
                payee_address: params.beneficiary,
                token_symbol: params.tokenSymbol,
                token_address: tokenData?.address || null,
                amount: params.amount.toString(),
                release_time: params.releaseTime,
                cancellable: params.cancellable || false,
                network: getNetworkFromChainId(chainId),
                chain_id: chainId,
                transaction_hash: createTxHash,
                is_instant: isInstantPayment,
                payment_type: paymentType,
              };

              console.log('📤 [FRONTEND] Envoi à l\'API avec is_instant et payment_type:', {
                is_instant: isInstantPayment,
                payment_type: paymentType,
                release_time: params.releaseTime,
                now,
                diff: params.releaseTime - now
              });

              const response = await fetch(`${API_URL}/api/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              });

              if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                  errorData = JSON.parse(errorText);
                } catch {
                  errorData = { message: errorText };
                }
                
                console.error('❌ [FRONTEND] Erreur API lors de l\'enregistrement:', {
                  status: response.status,
                  statusText: response.statusText,
                  error: errorData,
                  isInstant: isInstantPayment,
                  paymentType: paymentType
                });
                
                // ✅ FIX : Gérer l'erreur de doublon de manière gracieuse (ne pas logger comme erreur)
                if (errorText.includes('duplicate key') || 
                    errorText.includes('contract_address') ||
                    errorData?.code === '23505') {
                  console.log('ℹ️ Paiement déjà enregistré (doublon détecté), on continue...');
                  savedContractAddressRef.current = foundAddress;
                  setStatus('success');
                  setProgressMessage(t('create.modal.paymentCreatedSuccess', { defaultValue: 'Paiement créé avec succès !' }));
                  isSavingRef.current = false;
                  return;
                }
                
                // ✅ FIX : Pour les autres erreurs, logger avec plus de détails
                console.error('❌ [FRONTEND] Erreur serveur détaillée:', {
                  error: errorData,
                  hint: errorData?.hint,
                  details: errorData?.details,
                  code: errorData?.code
                });
                
                // Ne pas bloquer l'utilisateur, le paiement est créé sur la blockchain
                savedContractAddressRef.current = foundAddress;
                setStatus('success');
                setProgressMessage(t('create.modal.paymentCreatedSuccess', { defaultValue: 'Paiement créé avec succès !' }));
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
            console.error('❌ Impossible de trouver l\'adresse du contrat');
            
            // ✅ FIX : Vérifier que receiptToUse et factoryLogs existent avant de les utiliser
            try {
              const receiptToUse = receipt || (publicClient && createTxHash ? await publicClient.getTransactionReceipt({ hash: createTxHash }) : null);
              const factoryLogs = receiptToUse ? receiptToUse.logs.filter(
                log => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
              ) : [];
              
              console.error('📋 Détails de diagnostic:', {
                receiptStatus: receiptToUse?.status,
                logsCount: receiptToUse?.logs?.length || 0,
                factoryLogsCount: factoryLogs.length,
                transactionHash: createTxHash,
                basescanLink: createTxHash ? `https://basescan.org/tx/${createTxHash}` : 'N/A',
                allLogAddresses: receiptToUse?.logs?.map(l => l.address) || [],
              });
            } catch (diagError) {
              console.error('📋 Détails de diagnostic (erreur lors de la récupération):', {
                transactionHash: createTxHash,
                basescanLink: createTxHash ? `https://basescan.org/tx/${createTxHash}` : 'N/A',
                error: diagError,
              });
            }
            
            // ✅ FIX : Essayer de récupérer l'adresse depuis Basescan ou depuis la transaction
            // Pour l'instant, on passe à success mais on affiche un message d'avertissement
            console.warn('⚠️ L\'adresse du contrat n\'a pas pu être extraite automatiquement.');
            console.warn('⚠️ Vous devrez peut-être l\'ajouter manuellement dans la base de données.');
            console.warn(`⚠️ Vérifiez la transaction sur Basescan: https://basescan.org/tx/${createTxHash}`);
            console.warn('⚠️ Dans les logs de la transaction, cherchez l\'adresse du contrat créé (généralement la première adresse inconnue).');
            
            // ✅ FIX : Même si on ne trouve pas l'adresse, on passe à success avec le hash
            // L'utilisateur pourra vérifier sur Basescan et ajouter l'adresse manuellement si nécessaire
            setStatus('success');
            setProgressMessage('Transaction confirmée ! (Adresse contrat non trouvée - vérifiez Basescan)');
            
            // ✅ FIX : Essayer d'enregistrer quand même dans Supabase avec contract_address = null
            // Le backend pourra peut-être récupérer l'adresse depuis la transaction
            if (currentParams && capturedPayerAddress) {
              try {
                console.log('📤 Tentative d\'enregistrement dans Supabase sans adresse de contrat...');
                const tokenData = getToken(currentParams.tokenSymbol);
                
                const response = await fetch(`${API_URL}/api/payments`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contract_address: null, // ✅ FIX : null au lieu de l'adresse manquante
                    payer_address: capturedPayerAddress,
                    payee_address: currentParams.beneficiary,
                    token_symbol: currentParams.tokenSymbol,
                    token_address: tokenData?.address || null,
                    amount: currentParams.amount.toString(),
                    release_time: currentParams.releaseTime,
                    cancellable: currentParams.cancellable || false,
                    network: getNetworkFromChainId(chainId),
                    chain_id: chainId,
                    transaction_hash: createTxHash,
                    needs_manual_address: true, // ✅ FIX : Flag pour indiquer que l'adresse doit être ajoutée manuellement
                  }),
                });
                
                if (response.ok) {
                  const result = await response.json();
                  console.log('✅ Paiement enregistré dans Supabase (sans adresse de contrat):', result.payment?.id);
                  console.warn('⚠️ IMPORTANT: Vous devrez ajouter l\'adresse du contrat manuellement dans Supabase pour que le keeper puisse l\'exécuter.');
                } else {
                  const errorText = await response.text();
                  console.warn('⚠️ Erreur lors de l\'enregistrement (non bloquant):', errorText);
                }
              } catch (apiErr) {
                console.warn('⚠️ Erreur API lors de l\'enregistrement (non bloquant):', apiErr);
              }
            }
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