// src/hooks/useCreatePayment.ts

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { decodeEventLog } from 'viem';
import {
  type TokenSymbol,
  getToken,
  getProtocolFeeBps,
  PROTOCOL_FEE_BPS_PARTICULAR,
  PROTOCOL_FEE_BPS_PRO,
} from '@/config/tokens';
import { useTokenApproval, type UseTokenApprovalReturn } from './useTokenApproval';
import { paymentFactoryScheduledAbi, paymentFactoryInstantAbi } from '@/lib/contracts/paymentFactoryAbi';
import { PAYMENT_FACTORY_SCHEDULED, PAYMENT_FACTORY_INSTANT } from '@/lib/contracts/addresses';
import { erc20Abi } from '@/lib/contracts/erc20Abi';
import { calculateGasFromReceipt, saveGasTransaction } from '@/lib/utils/gas';
import { useAuth } from '@/contexts/AuthContext';

// ✅ Factories (Base Mainnet)
const FACTORY_SCHEDULED_ADDRESS: `0x${string}` = PAYMENT_FACTORY_SCHEDULED as `0x${string}`;
const FACTORY_INSTANT_ADDRESS: `0x${string}` = PAYMENT_FACTORY_INSTANT as `0x${string}`;

const getFactoryAddress = (isInstant: boolean): `0x${string}` =>
  (isInstant ? FACTORY_INSTANT_ADDRESS : FACTORY_SCHEDULED_ADDRESS);

const getFactoryAbi = (isInstant: boolean) =>
  (isInstant ? paymentFactoryInstantAbi : paymentFactoryScheduledAbi);

const resolveOnchainFeeBps = async (params: {
  isInstantPayment: boolean;
  address?: `0x${string}`;
  publicClient?: ReturnType<typeof usePublicClient>;
  isProVerified: boolean;
}): Promise<number> => {
  if (params.isInstantPayment) {
    return 0;
  }
  if (!params.publicClient || !params.address) {
    return getProtocolFeeBps({ isInstantPayment: false, isProVerified: params.isProVerified });
  }
  try {
    const isProOnchain = await params.publicClient.readContract({
      address: FACTORY_SCHEDULED_ADDRESS,
      abi: paymentFactoryScheduledAbi,
      functionName: 'isProWallet',
      args: [params.address],
    });
    return (isProOnchain as boolean) ? PROTOCOL_FEE_BPS_PRO : PROTOCOL_FEE_BPS_PARTICULAR;
  } catch (error) {
    console.warn('⚠️ Impossible de lire isProWallet on-chain, fallback off-chain.', error);
    return getProtocolFeeBps({ isInstantPayment: false, isProVerified: params.isProVerified });
  }
};

const getFriendlyApprovalErrorMessage = (error: Error, t: TFunction): string => {
  const candidates = [
    error.message,
    (error as any)?.shortMessage,
    (error as any)?.cause?.message,
  ].filter(Boolean) as string[];
  const errorMsgLower = candidates.join(' | ').toLowerCase();

  if (
    errorMsgLower.includes('user rejected') ||
    errorMsgLower.includes('user denied') ||
    errorMsgLower.includes('user cancelled')
  ) {
    return t('create.modal.errorUserRejected', {
      defaultValue: 'Transaction cancelled. No charge was made. You can try again anytime.',
    });
  }
  if (
    errorMsgLower.includes('insufficient funds') ||
    errorMsgLower.includes('balance') ||
    errorMsgLower.includes('insufficient balance')
  ) {
    return t('create.modal.errorInsufficientEthGas', {
      defaultValue: 'Insufficient ETH to pay transaction fees (gas). Please add ETH to your wallet.',
    });
  }
  if (errorMsgLower.includes('nonce') || errorMsgLower.includes('replacement transaction')) {
    return t('create.modal.errorNonce', {
      defaultValue: 'Nonce error. Please try again in a moment.',
    });
  }
  if (errorMsgLower.includes('network') || errorMsgLower.includes('connection') || errorMsgLower.includes('rpc')) {
    return t('create.modal.errorNetworkRpc', {
      defaultValue: 'Network or RPC error. Check your connection and try again.',
    });
  }
  if (errorMsgLower.includes('gas') || errorMsgLower.includes('transaction underpriced')) {
    return t('create.modal.errorGas', {
      defaultValue: 'Gas error. Check your network connection and try again.',
    });
  }
  if (candidates.length > 0) {
    return t('create.modal.errorApprovingWithDetails', {
      defaultValue: 'Approval error. {{details}}',
      details: candidates[0],
    });
  }
  return t('create.modal.errorApprovingGeneric', {
    defaultValue: 'Approval error. Check MetaMask for details.',
  });
};

const isUserRejectedError = (error: Error): boolean => {
  const candidates = [
    error.message,
    (error as any)?.shortMessage,
    (error as any)?.cause?.message,
  ].filter(Boolean) as string[];
  const msg = candidates.join(' | ').toLowerCase();
  return msg.includes('user rejected') || msg.includes('user denied') || msg.includes('user cancelled');
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(
      value,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2
    );
  } catch (error) {
    return `"[unserializable: ${(error as Error)?.message || 'unknown'}]"`;
  }
};


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
  const { user } = useAuth();
  
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
  // ✅ FIX : Timeout de sécurité pour éviter que la modal reste bloquée (60 secondes maximum)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ✅ FIX : Flag pour éviter les enregistrements multiples
  const isSavingRef = useRef<boolean>(false);
  const savedContractAddressRef = useRef<`0x${string}` | undefined>(undefined);
  // ✅ FIX CRITIQUE : Ref pour toujours avoir la dernière instance du hook d'approbation
  const approvalHookRef = useRef<UseTokenApprovalReturn | null>(null);
  // ✅ FIX : Ref pour le timeout de sécurité du processus de création
  const creationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ✅ FIX : Ref pour stocker le statut actuel et le vérifier dans le timeout
  const statusRef = useRef<PaymentStatus>(status);
  // ✅ FIX : Ref pour stocker contractAddress et le vérifier dans le timeout
  const contractAddressRef = useRef<`0x${string}` | undefined>(contractAddress);

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
      setProgressMessage(
        t('create.modal.transactionConfirmedFetching', {
          defaultValue: 'Transaction confirmed, fetching details...',
        })
      );
    }
  }, [isConfirmed, createTxHash, status]);

  // Hook d'approbation (pour ERC20)
  // ✅ FIX CRITIQUE : Ne pas créer le hook si currentParams n'est pas défini
  // Cela évite de créer le hook avec 'ETH' par défaut et de tenter d'approuver le mauvais token
  const token = currentParams ? getToken(currentParams.tokenSymbol) : null;
  
  // 🔧 FIX ERC20 ALLOWANCE : Calculer totalRequired
  // - Paiement programmé : amount + fees (taux selon statut)
  // - Paiement instantané : amount (0% fees)
  const isInstantFromParams = currentParams
    ? (currentParams.releaseTime - Math.floor(Date.now() / 1000)) < 60
    : false;

  const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
  const feeBps = getProtocolFeeBps({ isInstantPayment: isInstantFromParams, isProVerified });

  const amountForApproval = currentParams?.amount
    ? (isInstantFromParams
        ? currentParams.amount
        : currentParams.amount + (currentParams.amount * BigInt(feeBps)) / BigInt(10000))
    : BigInt(1);
  
  // ✅ FIX CRITIQUE : Utiliser le tokenSymbol de currentParams, ou 'USDC' comme valeur par défaut
  // On utilise 'USDC' au lieu de 'ETH' car :
  // 1. Le hook ne sera jamais utilisé pour ETH (pas besoin d'approbation)
  // 2. 'USDC' est un token ERC20 valide qui peut servir de placeholder
  // 3. Les override dans approve() garantiront que le bon token est utilisé
  const approvalTokenSymbol: TokenSymbol = currentParams?.tokenSymbol || 'USDC';
  
  // ✅ FIX : Toujours créer le hook, mais il se mettra à jour quand currentParams change
  // Les override dans approve() garantiront que le bon token est utilisé même si le hook
  // a été créé avec un token par défaut
  const approvalHook = useTokenApproval({
    tokenSymbol: approvalTokenSymbol,
    spenderAddress: isInstantFromParams ? FACTORY_INSTANT_ADDRESS : FACTORY_SCHEDULED_ADDRESS, // ✅ Spender selon instant/programmé
    amount: amountForApproval,
    releaseTime: currentParams?.releaseTime,
  });
  
  // ✅ FIX CRITIQUE : Mettre à jour la ref à chaque render pour toujours avoir la dernière instance
  approvalHookRef.current = approvalHook;

  // ✅ FIX : Log pour vérifier que le hook est bien créé
  console.log('🔧 approvalHook créé:', {
    tokenSymbol: approvalTokenSymbol,
    currentParamsTokenSymbol: currentParams?.tokenSymbol || 'null',
    currentParamsExists: currentParams !== null,
    amount: currentParams?.amount?.toString() || '0',
    isNative: token?.isNative,
    hasApproveFunction: typeof approvalHook.approve === 'function',
    note: 'Les override dans approve() garantiront que le bon token est utilisé',
  });

  // Fonction principale de création
  const createPayment = async (params: CreatePaymentParams) => {
    console.log('🚀🚀🚀 [DEBUT] createPayment appelé 🚀🚀🚀');
    console.log('📋 [DEBUT] Paramètres reçus:', {
      tokenSymbol: params.tokenSymbol,
      amount: params.amount.toString(),
      releaseTime: params.releaseTime,
      releaseTimeDate: new Date(params.releaseTime * 1000).toISOString(),
      beneficiary: params.beneficiary,
      cancellable: params.cancellable,
      address: address || 'NON CONNECTÉ',
      chainId,
    });
    
    if (!address) {
      console.error('❌ [createPayment] Wallet non connecté');
      setError(new Error(t('dashboard.auth.walletNotConnected.title', { defaultValue: 'Wallet not connected' })));
      setStatus('error');
      setProgressMessage(t('dashboard.auth.walletNotConnected.description', { defaultValue: 'Please connect your wallet to access your dashboard.' }));
      return;
    }
    
    console.log('✅ [DEBUT] Wallet connecté, continuation...');

    try {
      setError(null);
      // ✅ FIX : Réinitialiser le hash d'approbation pour cette nouvelle tentative
      currentApproveTxHash.current = undefined;
      const tokenData = getToken(params.tokenSymbol);
      
      console.log('🔍 [createPayment] Token data:', {
        symbol: tokenData.symbol,
        address: tokenData.address,
        isNative: tokenData.isNative,
        decimals: tokenData.decimals,
      });
      
      // ✅ FIX : Déterminer si c'est un paiement instantané pour sélectionner la bonne factory
      const now = Math.floor(Date.now() / 1000);
      const isInstantPayment = (params.releaseTime - now) < 60;
      const feeBpsForPayment = await resolveOnchainFeeBps({
        isInstantPayment,
        address,
        publicClient,
        isProVerified,
      });
      const factoryAddress = getFactoryAddress(isInstantPayment);
      const factoryAbi = getFactoryAbi(isInstantPayment);
      
      // ✅ FIX : Vérifier que le contrat Factory existe bien
      if (!publicClient) {
        throw new Error('Client blockchain non disponible');
      }
      
      console.log('🔍 [createPayment] Vérification que le contrat Factory existe...', {
        isInstantPayment,
        factoryAddress,
        factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
      });
      try {
        const factoryCode = await publicClient.getBytecode({ address: factoryAddress });
        if (!factoryCode || factoryCode === '0x') {
          console.error('❌ [ERREUR CRITIQUE] Le contrat Factory n\'existe pas à l\'adresse:', factoryAddress);
          throw new Error(`Le contrat Factory n'existe pas à l'adresse ${factoryAddress}. Vérifiez que le contrat est bien déployé sur Base Mainnet.`);
        }
        console.log('✅ [createPayment] Contrat Factory trouvé à l\'adresse:', factoryAddress);
        console.log('🔗 [createPayment] Voir sur Basescan:', `https://basescan.org/address/${factoryAddress}`);
      } catch (factoryErr) {
        console.error('❌ [ERREUR] Erreur lors de la vérification du contrat Factory:', factoryErr);
        throw new Error(`Impossible de vérifier le contrat Factory: ${(factoryErr as Error).message}`);
      }
      
      // ✅ FIX : Vérifier que le token ERC20 existe bien (si ce n'est pas ETH)
      if (!tokenData.isNative && tokenData.address && tokenData.address !== 'NATIVE') {
        console.log('🔍 [createPayment] Vérification que le token ERC20 existe...');
        try {
          const tokenCode = await publicClient.getBytecode({ address: tokenData.address as `0x${string}` });
          if (!tokenCode || tokenCode === '0x') {
            console.error('❌ [ERREUR CRITIQUE] Le token ERC20 n\'existe pas à l\'adresse:', tokenData.address);
            throw new Error(`Le token ${params.tokenSymbol} n'existe pas à l'adresse ${tokenData.address}. Vérifiez la configuration des tokens.`);
          }
          console.log('✅ [createPayment] Token ERC20 trouvé à l\'adresse:', tokenData.address);
        } catch (tokenErr) {
          console.error('❌ [ERREUR] Erreur lors de la vérification du token ERC20:', tokenErr);
          throw new Error(`Impossible de vérifier le token ERC20: ${(tokenErr as Error).message}`);
        }
      }

      // ✅ FIX CRITIQUE : Mettre à jour currentParams AVANT tout pour que le hook se mette à jour
      console.log('🔄 [createPayment] Mise à jour currentParams avec:', {
        tokenSymbol: params.tokenSymbol,
        amount: params.amount.toString(),
        beneficiary: params.beneficiary,
      });
      setCurrentParams(params);
      setCapturedPayerAddress(address);

      // ✅ FIX CRITIQUE : Attendre que le hook useTokenApproval soit bien mis à jour avec le nouveau tokenSymbol
      // On force React à re-rendre en attendant et en utilisant une ref qui est mise à jour à chaque render
      console.log('⏳ [createPayment] Attente que le hook useTokenApproval se mette à jour avec le bon token...');

      // Forcer React à re-rendre avec le nouveau currentParams
      // On attend plusieurs renders en utilisant requestAnimationFrame
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100)); // ✅ FIX : Augmenté à 100ms pour laisser plus de temps

      // ✅ FIX CRITIQUE : Utiliser la ref pour avoir la dernière instance du hook
      const currentApprovalHook = approvalHookRef.current;
      
      console.log('🔍 [createPayment] Hook récupéré après mise à jour:', {
        hasHook: !!currentApprovalHook,
        tokenSymbol: params.tokenSymbol,
        currentParamsTokenSymbol: currentParams?.tokenSymbol || 'null',
      });

      if (!currentApprovalHook) {
        console.error('❌ Hook d\'approbation non disponible');
        setError(
          new Error(
            t('create.modal.errorInternalApprovalHookUnavailable', {
              defaultValue: 'Internal error: approval hook unavailable',
            })
          )
        );
        setStatus('error');
        return;
      }

      console.log('✅ Hook d\'approbation récupéré depuis la ref');
      
      // ✅ FIX : Pour les tokens ERC20, attendre un peu que React se stabilise
      // Note: On ne vérifie plus currentParams car il peut être mis à jour de manière asynchrone par React
      // Au lieu de bloquer, on passera les bons paramètres directement à approve()
      if (!tokenData.isNative) {
        console.log('⏳ [ERC20] Attente que React se stabilise...');
        console.log('🔍 [DIAGNOSTIC] État:', {
          paramsTokenSymbol: params.tokenSymbol,
          tokenDataSymbol: tokenData.symbol,
          tokenDataAddress: tokenData.address,
          note: 'Les paramètres seront passés directement à approve()',
        });
        
        // Attendre un peu que React se stabilise (mais pas trop longtemps)
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // ✅ `now` et `isInstantPayment` sont déjà définis plus haut (ligne 265-266)
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
          setProgressMessage(
            t('create.modal.instantPaymentEth', {
              defaultValue: '⚡ Instant ETH payment (0% fees)...',
            })
          );

          console.log('⚡ createInstantPaymentETH:', {
            beneficiary: params.beneficiary,
            amount: params.amount.toString(),
          });

          console.log('📤 [ETH INSTANTANÉ] Appel writeContract...');
          console.log('📋 [ETH INSTANTANÉ] Paramètres:', {
            factoryAddress: factoryAddress,
            functionName: 'createInstantPaymentETH',
            beneficiary: params.beneficiary,
            valueToSend: params.amount.toString(),
            valueToSendFormatted: `${(Number(params.amount) / 1e18).toFixed(6)} ETH`,
          });

          writeContract({
            abi: factoryAbi,
            address: factoryAddress,
            functionName: 'createInstantPaymentETH',
            args: [params.beneficiary],
            value: params.amount, // ✅ Montant exact, pas de fees
          });
          console.log('✅ [ETH INSTANTANÉ] writeContract appelé (pas d\'erreur synchrone)');
          console.log('⏳ [ETH INSTANTANÉ] Attente de la réponse MetaMask...');
        } else {
          // PAIEMENT PROGRAMMÉ ETH (taux selon statut)
          setStatus('creating');
          setProgressMessage(t('create.modal.creatingPaymentETH', { defaultValue: 'Creating ETH payment...' }));

          const amountToPayee = params.amount;
          const protocolFee = (amountToPayee * BigInt(feeBpsForPayment)) / BigInt(10000);
          const totalRequired = amountToPayee + protocolFee;

          console.log('💰 Calcul paiement programmé:', {
            amountToPayee: amountToPayee.toString(),
            protocolFee: protocolFee.toString(),
            totalRequired: totalRequired.toString()
          });

          console.log('📤 [ETH PROGRAMMÉ] Appel writeContract...');
          console.log('📋 [ETH PROGRAMMÉ] Paramètres:', {
            factoryAddress: factoryAddress,
            functionName: 'createPaymentETH',
            beneficiary: params.beneficiary,
            amountToPayee: amountToPayee.toString(),
            releaseTime: params.releaseTime,
            releaseTimeDate: new Date(params.releaseTime * 1000).toISOString(),
            cancellable: params.cancellable || false,
            valueToSend: totalRequired.toString(),
            valueToSendFormatted: `${(Number(totalRequired) / 1e18).toFixed(6)} ETH`,
          });

          writeContract({
            abi: factoryAbi,
            address: factoryAddress,
            functionName: 'createPaymentETH',
            args: [
              params.beneficiary,
              amountToPayee,
              BigInt(params.releaseTime),
              params.cancellable || false,
            ],
            value: totalRequired,
          });
          console.log('✅ [ETH PROGRAMMÉ] writeContract appelé (pas d\'erreur synchrone)');
          console.log('⏳ [ETH PROGRAMMÉ] Attente de la réponse MetaMask...');
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
            setProgressMessage(
              t('create.modal.instantApproval', {
                defaultValue: '⚡ Instant {{token}} approval (0% fees)...',
                token: tokenData.symbol,
              })
            );
            // ✅ FIX : Passer le montant directement (pas de fees pour instantané) + tokenSymbol et tokenAddress override
            if (!tokenData.address) {
              throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
            }
            currentApprovalHook.approve(params.amount, params.tokenSymbol as TokenSymbol, tokenData.address as `0x${string}`);
          } else {
            // Approbation déjà suffisante, passer directement à la création
            console.log('✅ Allowance suffisante, création instantanée directe');
            setStatus('creating');
            setProgressMessage(t('create.modal.instantPayment', { defaultValue: '⚡ Instant payment...' }));

            if (!tokenData.address) {
              throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
            }

            console.log('⚡ createInstantPaymentERC20:', {
              beneficiary: params.beneficiary,
              tokenAddress: tokenData.address,
              amount: params.amount.toString(),
            });

            writeContract({
              abi: factoryAbi,
              address: factoryAddress,
              functionName: 'createInstantPaymentERC20',
              args: [
                params.beneficiary,
                tokenData.address as `0x${string}`,
                params.amount, // ✅ Montant exact, pas de fees
              ],
            });
          }
        } else {
          // PAIEMENT PROGRAMMÉ ERC20 (taux selon statut)
          
          // ✅ FIX : Calculer le montant total nécessaire (avec fees)
          const protocolFee = (params.amount * BigInt(feeBpsForPayment)) / BigInt(10000);
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

          console.log('🔍 [VERIFICATION ALLOWANCE] Début vérification allowance pour paiement programmé ERC20...');
          
          // ✅ FIX : Vérifier manuellement l'allowance avec le bon montant
          // (car le hook peut ne pas être à jour immédiatement après setCurrentParams)
          // IMPORTANT : Par sécurité, on approuve toujours sauf si l'allowance est clairement supérieure
          const currentAllowance = currentApprovalHook.currentAllowance;
          const isChecking = currentApprovalHook.isCheckingAllowance;
          
          console.log('🔍 [VERIFICATION ALLOWANCE] État actuel:', {
            currentAllowance: currentAllowance?.toString() || 'undefined',
            isCheckingAllowance: isChecking,
            currentParams: currentParams ? {
              tokenSymbol: currentParams.tokenSymbol,
              amount: currentParams.amount.toString(),
            } : 'null',
          });
          
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
          
          console.log('🔍 [VERIFICATION ALLOWANCE] Vérification allowanceIsSufficient (PAIEMENT PROGRAMMÉ):', {
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
          console.log('🔐 [VERIFICATION ALLOWANCE] Approbation nécessaire (toujours approuver pour paiement programmé ERC20):', {
            currentAllowance: currentApprovalHook.currentAllowance?.toString() || 'non disponible',
            totalRequired: totalRequired.toString(),
            safetyMargin: safetyMargin.toString(),
            needsApproval: true,
          });
          
          console.log('✅ [VERIFICATION ALLOWANCE] Décision: APPROBATION NÉCESSAIRE, passage à l\'approbation...');
          
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
            setError(
              new Error(
                t('create.modal.errorTokenMismatch', {
                  defaultValue: 'Error: payment token ({{token}}) does not match. Please refresh the page.',
                  token: params.tokenSymbol,
                })
              )
            );
            setStatus('error');
            setProgressMessage(
              t('create.modal.tokenMismatchRefresh', { defaultValue: 'Token error - please refresh' })
            );
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
          
          console.log('🔄 [AVANT APPROBATION] Passage au statut approving...');
          setStatus('approving');
          setProgressMessage(
            t('create.modal.approvingToken', {
              defaultValue: 'Approving {{token}}...',
              token: tokenData.symbol,
            })
          );
          
          console.log('📞 [AVANT APPROBATION] Vérification de currentApprovalHook...');
          console.log('🔍 [AVANT APPROBATION] Vérification currentApprovalHook:', {
            hasApproveFunction: typeof currentApprovalHook.approve === 'function',
            approveFunction: typeof currentApprovalHook.approve === 'function' ? currentApprovalHook.approve.toString().substring(0, 100) : 'N/A',
            isNative: tokenData.isNative,
            tokenSymbol: tokenData.symbol,
            tokenAddress: tokenData.address,
            currentAllowance: currentApprovalHook.currentAllowance?.toString() || 'undefined',
            isAllowanceSufficient: currentApprovalHook.isAllowanceSufficient,
            isCheckingAllowance: currentApprovalHook.isCheckingAllowance,
          });
          
          // ✅ FIX CRITIQUE : Vérifier que approve est bien une fonction
          if (typeof currentApprovalHook.approve !== 'function') {
            console.error('❌ [ERREUR CRITIQUE] currentApprovalHook.approve n\'est pas une fonction !', {
              type: typeof currentApprovalHook.approve,
              currentApprovalHook: currentApprovalHook,
            });
            setError(
              new Error(
                t('create.modal.errorApprovalFunctionUnavailableRefresh', {
                  defaultValue: 'Error: approval function unavailable. Please refresh the page.',
                })
              )
            );
            setStatus('error');
            setProgressMessage(
              t('create.modal.approvalFunctionUnavailable', { defaultValue: 'Error: approval function unavailable' })
            );
            return;
          }
          
          try {
            // ✅ FIX : Utiliser le montant exact avec une marge de sécurité de 10%
            // Cela rassure l'utilisateur car il voit exactement combien il approuve
            // Augmenté à 10% pour éviter les problèmes d'arrondi et de timing
            const approvalAmount = (totalRequired * BigInt(110)) / BigInt(100); // +10% de marge (augmenté de 5% à 10%)
            
            console.log('🔐 [AVANT APPROBATION] Montants approbation:', {
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
            console.log('🔍 [AVANT APPROBATION] État avant appel approve():', {
              paramsTokenSymbol: params.tokenSymbol,
              approvalTokenSymbol,
              currentParamsTokenSymbol: currentParams?.tokenSymbol,
              tokenDataSymbol: tokenData.symbol,
              tokenDataAddress: tokenData.address,
              hookIsNative: token?.isNative,
            });
            
            // ✅ FIX : Log pour diagnostic
            const hookTokenSymbol = currentParams?.tokenSymbol || approvalTokenSymbol;
            const hookToken = getToken(hookTokenSymbol);
            console.log('🔍 [AVANT APPROBATION] État avant appel approve():', {
              paramsTokenSymbol: params.tokenSymbol,
              approvalTokenSymbol,
              currentParamsTokenSymbol: currentParams?.tokenSymbol || 'null',
              tokenDataSymbol: tokenData.symbol,
              tokenDataAddress: tokenData.address,
              hookTokenSymbol,
              hookTokenAddress: hookToken.address,
              hookIsNative: token?.isNative,
              addressesMatch: hookToken.address === tokenData.address,
            });
            
            // ✅ FIX CRITIQUE : Le hook peut utiliser un tokenSymbol différent au moment de sa création
            // Mais la fonction approve() utilise getToken(tokenSymbol) en interne, donc elle utilisera
            // le tokenSymbol passé au hook lors de sa création. Si le hook a été créé avec 'USDC'
            // alors qu'on veut approuver 'USDT', cela échouera.
            // Solution: Vérifier que le hook utilise bien le bon token, et si ce n'est pas le cas,
            // créer une nouvelle instance du hook ou passer le bon tokenSymbol directement.
            // Pour l'instant, on fait confiance que React a mis à jour le hook après les attentes.
            
            // ✅ FIX CRITIQUE : Passer le tokenSymbol et tokenAddress en override à la fonction approve
            // Cela garantit que le bon token est utilisé même si le hook a été créé avec un token par défaut
            console.log('📞 [APPROBATION] Appel de currentApprovalHook.approve() avec montant:', approvalAmount.toString());
            console.log('📞 [APPROBATION] Token attendu:', tokenData.symbol, 'Address:', tokenData.address);
            console.log('📞 [APPROBATION] Hook tokenSymbol actuel:', hookTokenSymbol);
            console.log('📞 [APPROBATION] Passage du tokenSymbol et tokenAddress en override pour garantir le bon token');
            
            // ✅ FIX CRITIQUE : Appeler approve() avec le tokenSymbol et tokenAddress en override
            // Cela garantit que le bon token est utilisé même si le hook a été créé avec 'ETH' ou 'USDC' par défaut
            if (!tokenData.address || tokenData.address === 'NATIVE') {
              throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat valide`);
            }
            
            // ✅ FIX CRITIQUE : Vérifier que tous les paramètres sont corrects avant d'appeler approve()
            console.log('🔍 [APPROBATION] Vérification finale des paramètres avant approve():', {
              tokenSymbol: params.tokenSymbol,
              tokenAddress: tokenData.address,
              spenderAddress: factoryAddress,
              approvalAmount: approvalAmount.toString(),
              approvalAmountFormatted: `${(Number(approvalAmount) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
              totalRequired: totalRequired.toString(),
              tokenDecimals,
              allParamsValid: !!params.tokenSymbol && !!tokenData.address && !!factoryAddress && approvalAmount > BigInt(0),
            });
            
            // ✅ FIX : Vérifier que l'adresse du token correspond bien au tokenSymbol
            const expectedToken = getToken(params.tokenSymbol as TokenSymbol);
            if (tokenData.address !== expectedToken.address) {
              const errorMsg = `Erreur: L'adresse du token (${tokenData.address}) ne correspond pas au tokenSymbol (${params.tokenSymbol}). Attendu: ${expectedToken.address}`;
              console.error('❌ [ERREUR CRITIQUE]', errorMsg);
              throw new Error(errorMsg);
            }
            
            // ✅ FIX : Vérifier que le montant est valide
            if (approvalAmount <= BigInt(0)) {
              const errorMsg = `Erreur: Le montant d'approbation doit être supérieur à zéro. Montant: ${approvalAmount.toString()}`;
              console.error('❌ [ERREUR CRITIQUE]', errorMsg);
              throw new Error(errorMsg);
            }
            
            // ✅ FIX CRITIQUE : Vérifier directement l'allowance pour le BON token avant d'appeler approve()
            // Cela garantit que MetaMask ne rejettera pas la transaction
            if (!publicClient || !address) {
              throw new Error('Client blockchain ou adresse wallet non disponible');
            }
            
              console.log('🔍 [APPROBATION] Vérification directe de l\'allowance pour le bon token...', {
                factoryAddress,
                factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
              });
            try {
              const directAllowance = await publicClient.readContract({
                address: tokenData.address as `0x${string}`,
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
                args: [address, factoryAddress],
              }) as bigint;
              
              console.log('📊 [APPROBATION] Allowance actuelle lue directement:', {
                token: params.tokenSymbol,
                tokenAddress: tokenData.address,
                owner: address,
                spender: factoryAddress,
                factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
                currentAllowance: directAllowance.toString(),
                approvalAmount: approvalAmount.toString(),
                isSufficient: directAllowance >= approvalAmount,
                needApproval: directAllowance < approvalAmount,
              });
              
              // Si l'allowance est déjà suffisante, pas besoin d'approuver
              if (directAllowance >= approvalAmount) {
                console.log('✅ [APPROBATION] Allowance déjà suffisante, pas besoin d\'approuver');
                // Passer directement à la création du paiement
                // Ne pas appeler approve(), passer à la création
                console.log('⏭️ [APPROBATION] Passage direct à la création du paiement...');
                // TODO: Appeler directement la création du paiement ici
                // Pour l'instant, on continue avec approve() pour être sûr
              }
            } catch (allowanceErr) {
              console.error('❌ [APPROBATION] Erreur lors de la vérification directe de l\'allowance:', allowanceErr);
              // Continue quand même, on essaiera d'approuver
            }
            
            // ✅ FIX : Utiliser le hook mais avec les override pour garantir le bon token
            // Le hook gère le suivi de la transaction (approveTxHash, approveError, etc.)
            console.log('📤 [APPROBATION] Appel de approve() avec override via le hook...');
            console.log('📋 [APPROBATION] Paramètres qui seront passés à writeContract:', {
              address: tokenData.address,
              functionName: 'approve',
              args: [factoryAddress, approvalAmount.toString()],
              spenderAddress: factoryAddress,
              factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
              approvalAmount: approvalAmount.toString(),
              approvalAmountHex: `0x${approvalAmount.toString(16)}`,
              tokenDecimals,
              approvalAmountFormatted: `${(Number(approvalAmount) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol}`,
            });
            
            // ✅ FIX : Appeler approve() avec les override pour garantir le bon token
            // Même si le hook a été créé avec un token par défaut, les override garantissent le bon token
            currentApprovalHook.approve(approvalAmount, params.tokenSymbol as TokenSymbol, tokenData.address as `0x${string}`);
            
            console.log('✅ [APPROBATION] approve() appelé avec succès (pas d\'erreur immédiate)');
            console.log('✅ [APPROBATION] TokenSymbol override:', params.tokenSymbol, 'TokenAddress override:', tokenData.address);
            console.log('✅ [APPROBATION] SpenderAddress:', factoryAddress, `(${isInstantPayment ? 'INSTANT' : 'SCHEDULED'})`);
            console.log('✅ [APPROBATION] Montant:', approvalAmount.toString(), `(${(Number(approvalAmount) / (10 ** tokenDecimals)).toFixed(6)} ${tokenData.symbol})`);
            console.log('⏳ [APPROBATION] Attente de la transaction MetaMask...');
            console.log('📊 [APPROBATION] Si MetaMask rejette la transaction, vérifiez les logs [useTokenApproval] ci-dessus');
          } catch (err) {
            if (isUserRejectedError(err as Error)) {
              const errorMessage = getFriendlyApprovalErrorMessage(err as Error, t);
              console.info('ℹ️ [APPROBATION] Annulée par l’utilisateur.');
              setError(new Error(errorMessage));
              setStatus('error');
              setProgressMessage(errorMessage);
              return;
            }
            console.error('❌ [ERREUR APPROBATION] Erreur lors de l\'appel currentApprovalHook.approve():', err);
            console.error('❌ [ERREUR APPROBATION] Stack trace:', (err as Error)?.stack);
            console.error('❌ [ERREUR APPROBATION] Détails:', {
              name: (err as Error)?.name,
              message: (err as Error)?.message,
              cause: (err as Error)?.cause,
            });
            setError(err as Error);
            setStatus('error');
            setProgressMessage(
              t('create.modal.approvalErrorSeeConsole', { defaultValue: 'Approval error - see console' })
            );
          }
          
          // ✅ FIX : Ne pas continuer - on attendra que l'approbation soit confirmée dans le useEffect suivant
          return;
        }
      }
    } catch (err) {
      console.error('Erreur createPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage(t('create.modal.errorCreating', { defaultValue: 'Error during creation' }));
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
  
  // ✅ FIX CRITIQUE : Détecter immédiatement les erreurs d'approbation et mettre à jour le statut
  useEffect(() => {
    // Si on est en train d'approuver et qu'une erreur survient, mettre à jour immédiatement
    if (status === 'approving' && approvalHook.approveError) {
      // Analyser l'erreur pour donner un message plus clair
      const errorMessage = getFriendlyApprovalErrorMessage(approvalHook.approveError, t);
      
      if (isUserRejectedError(approvalHook.approveError)) {
        console.info('ℹ️ [APPROBATION] Annulée par l’utilisateur.');
        console.info('ℹ️ [ERREUR APPROBATION] Message d\'annulation:', errorMessage);
      } else {
        console.error('❌ [ERREUR APPROBATION DÉTECTÉE] Erreur d\'approbation pendant le processus:', {
          error: approvalHook.approveError,
          message: approvalHook.approveError.message,
          name: approvalHook.approveError.name,
          stack: approvalHook.approveError.stack,
          status,
        });
        console.error('❌ [ERREUR APPROBATION] Message d\'erreur final:', errorMessage);
      }
      setError(new Error(errorMessage));
      setStatus('error');
      setProgressMessage(errorMessage);
      
      // Nettoyer les timeouts
      if (creationTimeoutRef.current) {
        clearTimeout(creationTimeoutRef.current);
        creationTimeoutRef.current = null;
      }
    }
  }, [approvalHook.approveError, status]);

  // ✅ FIX : Logs pour suivre l'état de l'approbation
  useEffect(() => {
    console.log('🔍 [SUIVI APPROBATION] État approbation:', {
      approveTxHash: approvalHook.approveTxHash || 'NON DISPONIBLE',
      isApproveSuccess: approvalHook.isApproveSuccess,
      isApproving: approvalHook.isApproving,
      approveError: approvalHook.approveError?.message || 'Aucune erreur',
      status,
      currentAllowance: approvalHook.currentAllowance?.toString() || 'undefined',
      isAllowanceSufficient: approvalHook.isAllowanceSufficient,
      hasReceipt: !!approvalHook.approveReceipt,
      receiptStatus: approvalHook.approveReceipt?.status || 'NON DISPONIBLE',
    });
    
    // ✅ FIX : Logger spécifiquement quand une transaction est envoyée
    if (approvalHook.approveTxHash && !currentApproveTxHash.current) {
      console.log('✅ [SUIVI APPROBATION] NOUVELLE transaction d\'approbation détectée:', approvalHook.approveTxHash);
      console.log('🔗 [SUIVI APPROBATION] Voir sur Basescan:', `https://basescan.org/tx/${approvalHook.approveTxHash}`);
    }
    
    // ✅ FIX : Logger quand l'approbation réussit
    if (approvalHook.isApproveSuccess && approvalHook.approveTxHash) {
      console.log('✅ [SUIVI APPROBATION] Approbation confirmée avec succès !', {
        txHash: approvalHook.approveTxHash,
        receiptStatus: approvalHook.approveReceipt?.status,
        blockNumber: approvalHook.approveReceipt?.blockNumber,
      });
    }
    
    // ✅ FIX : Logger les erreurs d'approbation (mais ne pas mettre à jour le statut ici, c'est fait dans le useEffect précédent)
    if (approvalHook.approveError) {
      if (isUserRejectedError(approvalHook.approveError)) {
        console.info('ℹ️ [SUIVI APPROBATION] Annulation utilisateur détectée.');
      } else {
        console.error('❌ [SUIVI APPROBATION] Erreur d\'approbation détectée:', {
          error: approvalHook.approveError,
          message: approvalHook.approveError.message,
          name: approvalHook.approveError.name,
          stack: approvalHook.approveError.stack,
        });
      }
    }
  }, [approvalHook.approveTxHash, approvalHook.isApproveSuccess, approvalHook.isApproving, approvalHook.approveError, approvalHook.approveReceipt, approvalHook.currentAllowance, approvalHook.isAllowanceSufficient, status]);

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
        if (isUserRejectedError(approvalHook.approveError)) {
          console.info('ℹ️ [APPROBATION] Annulation utilisateur détectée.');
        } else {
          console.error('❌ ERREUR D\'APPROBATION DÉTECTÉE:', {
            error: approvalHook.approveError,
            message: approvalHook.approveError.message,
            name: approvalHook.approveError.name,
          });
        }
        const errorMessage = getFriendlyApprovalErrorMessage(approvalHook.approveError, t);
        setError(new Error(errorMessage));
        setStatus('error');
        setProgressMessage(errorMessage);
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
      
      // ✅ FIX : Nettoyer le timeout précédent s'il existe
      if (creationTimeoutRef.current) {
        clearTimeout(creationTimeoutRef.current);
        creationTimeoutRef.current = null;
      }
      
      // ✅ FIX : Ajouter un timeout de sécurité (90 secondes) pour éviter que le processus reste bloqué
      // Augmenté à 90s car l'enregistrement en DB peut prendre du temps
      creationTimeoutRef.current = setTimeout(() => {
        // ✅ Vérifier le statut actuel via la ref (toujours à jour)
        // Ne déclencher le timeout que si on est toujours dans un état d'attente
        // ET qu'on n'a pas encore trouvé l'adresse du contrat
        const currentStatus = statusRef.current;
        const hasContractAddress = !!contractAddressRef.current;
        
        // ✅ Si on a déjà l'adresse du contrat, le processus est réussi (même si DB prend du temps)
        if (hasContractAddress) {
          console.log('✅ Timeout ignoré - adresse du contrat trouvée:', contractAddressRef.current, '(processus réussi, enregistrement DB en cours)');
          creationTimeoutRef.current = null;
          return;
        }
        
        if (currentStatus === 'approving' || currentStatus === 'creating' || currentStatus === 'confirming') {
          console.error('❌ TIMEOUT: Le processus de création a pris trop de temps (>90s)');
          console.error('❌ État actuel:', {
            status: currentStatus,
            approveTxHash: approvalHook.approveTxHash,
            createTxHash,
            isApproveSuccess: approvalHook.isApproveSuccess,
            approveError: approvalHook.approveError?.message,
            contractAddress: contractAddressRef.current,
            hasContractAddress,
          });
          setError(new Error('Le processus de création a pris trop de temps. Veuillez réessayer. Si le paiement a été créé, vérifiez votre dashboard.'));
          setStatus('error');
          setProgressMessage(t('create.modal.timeoutRetry', { defaultValue: 'Timeout - please try again' }));
          creationTimeoutRef.current = null;
        } else {
          console.log('✅ Timeout ignoré - statut actuel:', currentStatus, '(processus terminé)');
          creationTimeoutRef.current = null;
        }
      }, 90000); // 90 secondes (augmenté de 60s pour laisser plus de temps à l'enregistrement DB)
      
      // ✅ NOUVEAU : Détecter à nouveau si instantané
      const now = Math.floor(Date.now() / 1000);
      const isInstantPayment = (currentParams.releaseTime - now) < 60;

      const factoryAddress = getFactoryAddress(isInstantPayment);
      const factoryAbi = getFactoryAbi(isInstantPayment);

      // ✅ FIX : Attendre un peu que l'allowance soit mise à jour (refetch peut prendre du temps)
      // On vérifie l'allowance actuelle et on attend si nécessaire
      const checkAndCreate = async () => {
        try {
          const feeBpsForPayment = await resolveOnchainFeeBps({
            isInstantPayment,
            address,
            publicClient,
            isProVerified,
          });

          // ✅ FIX : Calculer le montant total requis (sans fees pour paiements instantanés)
          const totalRequired = isInstantPayment 
            ? currentParams.amount  // Paiement instantané : pas de fees
            : currentParams.amount + ((currentParams.amount * BigInt(feeBpsForPayment)) / BigInt(10000)); // Paiement programmé : + fees
          
          console.log('💰 Calcul totalRequired:', {
            isInstantPayment,
            amount: currentParams.amount.toString(),
            totalRequired: totalRequired.toString(),
            fees: isInstantPayment ? '0% (instantané)' : `${feeBpsForPayment / 100}% (programmé)`,
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

          if (!address || !token.address || !publicClient) {
            const errorMsg = 'Paramètres manquants pour vérifier l\'allowance';
            console.error('❌', errorMsg, { address: !!address, tokenAddress: !!token.address, publicClient: !!publicClient });
            setError(new Error(errorMsg));
            setStatus('error');
            setProgressMessage(t('create.modal.invalidParams', { defaultValue: 'Invalid parameters' }));
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
          setProgressMessage(
            t('create.modal.approvalTxNotFound', { defaultValue: 'Approval transaction not found' })
          );
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
          setProgressMessage(
            t('create.modal.approvalTxNotConfirmed', { defaultValue: 'Approval transaction not confirmed' })
          );
          return;
        }

        if (approveReceipt.status !== 'success') {
          console.error('❌ Transaction d\'approbation échouée:', {
            receiptStatus: approveReceipt.status,
            receipt: approveReceipt,
          });
          setError(new Error('La transaction d\'approbation a échoué. Veuillez réessayer.'));
          setStatus('error');
          setProgressMessage(
            t('create.modal.approvalTxFailed', { defaultValue: 'Approval transaction failed' })
          );
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
        
        // ✅ FIX : Utiliser la marge de sécurité attendue (10%) déjà calculée
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
                spender: factoryAddress,
                factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
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
                args: [address, factoryAddress],
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
            console.log('🔍 DERNIÈRE TENTATIVE: Lecture directe allowance pour diagnostic...', {
              factoryAddress,
              factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
            });
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
              args: [address, factoryAddress],
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
            spender: factoryAddress,
            factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
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
            setProgressMessage(
              t('create.modal.approvalTxNotSent', { defaultValue: 'Approval transaction not sent' })
            );
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
            setProgressMessage(
              t('create.modal.approvalTxNotConfirmed', { defaultValue: 'Approval transaction not confirmed' })
            );
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
          setProgressMessage(
            t('create.modal.allowanceInsufficientAfterApproval', { defaultValue: 'Allowance insufficient after approval' })
          );
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
          args: [address, factoryAddress],
        }) as bigint;
        
        const preSimulationIsSufficient = preSimulationAllowance >= totalRequired;
        
        console.log('🔍 Vérification finale allowance juste avant création:', {
          preSimulationAllowance: preSimulationAllowance.toString(),
          totalRequired: totalRequired.toString(),
          isSufficient: preSimulationIsSufficient,
          factoryAddress,
          factoryType: isInstantPayment ? 'INSTANT' : 'SCHEDULED',
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
          setProgressMessage(
            t('create.modal.allowanceInsufficientReapprove', { defaultValue: 'Allowance insufficient - please re-approve' })
          );
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
          setError(
            new Error(
              t('create.modal.balanceInsufficientDetails', {
                defaultValue:
                  'Insufficient balance. You have {{balance}} {{token}}, but {{required}} are required.',
                balance: (Number(balance) / (10 ** tokenDecimals)).toFixed(6),
                token: currentParams.tokenSymbol,
                required: (Number(totalRequired) / (10 ** tokenDecimals)).toFixed(6),
              })
            )
          );
          setStatus('error');
          setProgressMessage(t('create.modal.balanceInsufficient', { defaultValue: 'Insufficient balance' }));
          return;
        }

        // ✅ FIX CRITIQUE : Simuler la transaction AVANT de l'envoyer pour voir l'erreur exacte
        try {
          console.log('🔍 Simulation de la transaction avant envoi...');
          
          if (isInstantPayment) {
            // ⚡ INSTANTANÉ
            await publicClient.simulateContract({
              account: address,
              address: factoryAddress,
              abi: factoryAbi,
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
              address: factoryAddress,
              abi: factoryAbi,
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
          let errorMessage = t('create.modal.txWillFailPrefix', {
            defaultValue: 'The transaction will fail. ',
          });
          if (simulateError?.shortMessage) {
            errorMessage += simulateError.shortMessage;
          } else if (simulateError?.message) {
            errorMessage += simulateError.message;
          } else {
            errorMessage += t('create.modal.checkAllowanceBalance', {
              defaultValue: 'Check your allowance and balance.',
            });
          }
          
          setError(new Error(errorMessage));
          setStatus('error');
          setProgressMessage(
            t('create.modal.txWillFailSeeConsole', { defaultValue: 'Transaction will fail - see console details' })
          );
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
            abi: factoryAbi,
            address: factoryAddress,
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
            abi: factoryAbi,
            address: factoryAddress,
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
      } catch (checkAndCreateError: any) {
        // ✅ FIX CRITIQUE : Catch toutes les erreurs dans checkAndCreate
        console.error('❌ ERREUR CRITIQUE dans checkAndCreate:', checkAndCreateError);
        console.error('❌ Stack trace:', checkAndCreateError?.stack);
        console.error('❌ Détails erreur:', {
          name: checkAndCreateError?.name,
          message: checkAndCreateError?.message,
          cause: checkAndCreateError?.cause,
          code: checkAndCreateError?.code,
        });
        
        // Définir un message d'erreur clair
        let errorMessage = t('create.modal.allowanceCheckErrorPrefix', {
          defaultValue: 'Allowance check error. ',
        });
        if (checkAndCreateError?.message) {
          errorMessage += checkAndCreateError.message;
        } else if (checkAndCreateError?.shortMessage) {
          errorMessage += checkAndCreateError.shortMessage;
        } else {
          errorMessage += t('create.modal.checkConsoleForDetails', {
            defaultValue: 'Check the console for more details.',
          });
        }
        
        setError(new Error(errorMessage));
        setStatus('error');
        setProgressMessage(
          t('create.modal.checkErrorSeeConsole', { defaultValue: 'Error during check - see console' })
        );
      }
    };

      checkAndCreate().catch((err) => {
        // ✅ FIX : Catch supplémentaire au cas où la promesse rejette
        console.error('❌ ERREUR PROMESSE checkAndCreate:', err);
        console.error('❌ Stack trace:', err?.stack);
        console.error('❌ Détails erreur:', {
          name: err?.name,
          message: err?.message,
          cause: err?.cause,
        });
        
        // Nettoyer le timeout
        if (creationTimeoutRef.current) {
          clearTimeout(creationTimeoutRef.current);
          creationTimeoutRef.current = null;
        }
        
        setError(
          new Error(
            t('create.modal.checkErrorWithDetails', {
              defaultValue: 'Error during check: {{details}}',
              details: err?.message || String(err),
            })
          )
        );
        setStatus('error');
        setProgressMessage(
          t('create.modal.checkErrorSeeConsole', { defaultValue: 'Error during check - see console' })
        );
      });
    }
  }, [approvalHook.isApproveSuccess, approvalHook.approveTxHash, status, currentParams, token, address, publicClient]);

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
          // ✅ Annuler le timeout car on passe à la phase de confirmation
          if (creationTimeoutRef.current) {
            clearTimeout(creationTimeoutRef.current);
            creationTimeoutRef.current = null;
            console.log('✅ Timeout annulé - passage à la confirmation');
          }
          
          setStatus('confirming');
          setProgressMessage(
            t('create.modal.retrievingContractAddress', { defaultValue: 'Retrieving contract address...' })
          );

          // ✅ FIX : Utiliser le receipt de useWaitForTransactionReceipt si disponible
          const receiptToUse = receipt || await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          if (!receiptToUse) {
            console.warn('⚠️ Receipt non disponible pour la transaction, nouvelle tentative plus tard.');
            return;
          }

          // ✅ Détecter quelle factory a été utilisée (via receipt.to)
          const txTo = receiptToUse.to?.toLowerCase();
          const isToScheduledFactory = txTo === FACTORY_SCHEDULED_ADDRESS.toLowerCase();
          const isToInstantFactory = txTo === FACTORY_INSTANT_ADDRESS.toLowerCase();

          if (!isToScheduledFactory && !isToInstantFactory) {
            console.warn('⚠️ La transaction analysée n\'est pas vers une factory connue (via receipt.to).');
            console.warn('⚠️ Receipt "to":', receiptToUse.to);
            console.warn('⚠️ Factories attendues:', {
              scheduled: FACTORY_SCHEDULED_ADDRESS,
              instant: FACTORY_INSTANT_ADDRESS,
            });
            // Ne pas bloquer : on tentera de décoder les logs avec les deux ABIs
          }

          // ✅ Déterminer les factories/ABIs candidats
          const factoryCandidates = isToInstantFactory
            ? [{ address: FACTORY_INSTANT_ADDRESS, abi: paymentFactoryInstantAbi, type: 'INSTANT' }]
            : isToScheduledFactory
              ? [{ address: FACTORY_SCHEDULED_ADDRESS, abi: paymentFactoryScheduledAbi, type: 'SCHEDULED' }]
              : [
                  { address: FACTORY_SCHEDULED_ADDRESS, abi: paymentFactoryScheduledAbi, type: 'SCHEDULED' },
                  { address: FACTORY_INSTANT_ADDRESS, abi: paymentFactoryInstantAbi, type: 'INSTANT' },
                ];

          console.log('🔍 Factory candidates:', factoryCandidates.map(c => ({ address: c.address, type: c.type })));

          console.log('📋 Receipt complet:', receiptToUse);
          let foundAddress: `0x${string}` | undefined;

          // ✅ FIX CRITIQUE : Décoder les events PaymentCreated correctement
          // Les events ont paymentContract dans les data, pas dans les topics

          // Chercher les logs émis par une factory candidate
          const factoryAddressesLower = factoryCandidates.map(c => c.address.toLowerCase());
          const factoryLogs = receiptToUse.logs.filter(
            log => factoryAddressesLower.includes(log.address.toLowerCase())
          );

          console.log(`🔍 ${factoryLogs.length} log(s) trouvé(s) depuis une factory candidate`);
          console.log('📋 Factories candidates:', factoryCandidates.map(c => c.address));
          console.log('📋 Tous les logs (adresses):', receiptToUse.logs.map(l => ({
            address: l.address,
            isFactory: factoryAddressesLower.includes(l.address.toLowerCase()),
            topicsCount: l.topics.length,
            firstTopic: l.topics[0],
          })));

          // ✅ FIX CRITIQUE : Si aucun log de factory, essayer de décoder tous les logs
          const logsToDecode = factoryLogs.length > 0 ? factoryLogs : receiptToUse.logs;

          if (factoryLogs.length === 0) {
            console.warn('⚠️ Aucun log trouvé depuis la factory, tentative de décodage de tous les logs...');
          }

          // Essayer de décoder chaque event de création de paiement
          for (const log of logsToDecode) {
            try {
              for (const candidate of factoryCandidates) {
                // Essayer PaymentCreatedETH
                try {
                  const decoded = decodeEventLog({
                    abi: candidate.abi,
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
                    abi: candidate.abi,
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
                }

                // Essayer InstantPaymentCreatedETH
                try {
                  const decoded = decodeEventLog({
                    abi: candidate.abi,
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
                    abi: candidate.abi,
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
              }

              if (foundAddress) {
                break;
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
              // ✅ Exclure la factory utilisée ET l'autre factory de la recherche
              const isScheduledFactory = log.address.toLowerCase() === FACTORY_SCHEDULED_ADDRESS.toLowerCase();
              const isInstantFactory = log.address.toLowerCase() === FACTORY_INSTANT_ADDRESS.toLowerCase();
              if (!isScheduledFactory && !isInstantFactory) {
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
              
              // ✅ FIX : Annuler le timeout car l'adresse a été trouvée (processus réussi)
              if (creationTimeoutRef.current) {
                clearTimeout(creationTimeoutRef.current);
                creationTimeoutRef.current = null;
                console.log('✅ Timeout annulé - adresse du contrat trouvée (déjà enregistré):', foundAddress);
              }
              
              setContractAddress(foundAddress);
              setStatus('success');
              setProgressMessage(t('create.modal.paymentCreatedSuccess', { defaultValue: 'Paiement créé avec succès !' }));
              return;
            }
            
            setContractAddress(foundAddress);
            
            // ✅ FIX : Annuler le timeout car l'adresse a été trouvée (processus réussi)
            if (creationTimeoutRef.current) {
              clearTimeout(creationTimeoutRef.current);
              creationTimeoutRef.current = null;
              console.log('✅ Timeout annulé - adresse du contrat trouvée:', foundAddress);
            }

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

              const factoryAddress = getFactoryAddress(isInstantPayment);
              const factoryAbi = getFactoryAbi(isInstantPayment);

              
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

                // 💰 NOUVEAU : Enregistrer les frais de gas
                try {
                  console.log('💰 Début enregistrement frais de gas...');

                  if (!result.payment?.id || !userAddress) {
                    console.warn('⚠️ Impossible d\'enregistrer les frais de gas : payment_id ou user_address manquant');
                    return;
                  }

                  const paymentId = result.payment.id;

                  // 1. Transaction d'approbation (ERC20 uniquement)
                  if (approvalHook.approveTxHash && approvalHook.approveReceipt) {
                    console.log('📋 Enregistrement transaction d\'approbation...');

                    const approvalGas = calculateGasFromReceipt(approvalHook.approveReceipt);

                    await saveGasTransaction({
                      scheduledPaymentId: paymentId,
                      userAddress: userAddress,
                      chainId: chainId,
                      txHash: approvalHook.approveTxHash,
                      txType: 'approve',
                      tokenAddress: tokenData?.address || null,
                      gasUsed: approvalGas.gas_used,
                      gasPrice: approvalGas.gas_price,
                      gasCostNative: approvalGas.total_gas_fee,
                    });

                    console.log('✅ Transaction d\'approbation enregistrée:', {
                      hash: approvalHook.approveTxHash,
                      gas_used: approvalGas.gas_used,
                      gas_cost: approvalGas.total_gas_fee,
                    });
                  }

                  // 2. Transaction de création (toujours présente)
                  if (createTxHash && receiptToUse) {
                    console.log('📋 Enregistrement transaction de création...');

                    const creationGas = calculateGasFromReceipt(receiptToUse);

                    await saveGasTransaction({
                      scheduledPaymentId: paymentId,
                      userAddress: userAddress,
                      chainId: chainId,
                      txHash: createTxHash,
                      txType: 'create',
                      tokenAddress: tokenData?.address || null,
                      gasUsed: creationGas.gas_used,
                      gasPrice: creationGas.gas_price,
                      gasCostNative: creationGas.total_gas_fee,
                    });

                    console.log('✅ Transaction de création enregistrée:', {
                      hash: createTxHash,
                      gas_used: creationGas.gas_used,
                      gas_cost: creationGas.total_gas_fee,
                    });
                  }

                  console.log('✅ Tous les frais de gas enregistrés avec succès !');
                } catch (gasError) {
                  // Ne pas bloquer si l'enregistrement des gas échoue
                  console.error('❌ Erreur lors de l\'enregistrement des frais de gas (non bloquant):', gasError);
                }
              }
            } catch (apiError) {
              console.error('❌ Erreur API:', apiError);
            } finally {
              // ✅ FIX : Libérer le flag même en cas d'erreur
              isSavingRef.current = false;
            }

            setStatus('success');
            setProgressMessage(t('create.modal.paymentCreatedSuccess', { defaultValue: 'Payment created successfully!' }));
          } else {
            console.error('❌ Impossible de trouver l\'adresse du contrat');
            
            // ✅ FIX : Vérifier que receiptToUse et factoryLogs existent avant de les utiliser
            try {
              const receiptToUse = receipt || (publicClient && createTxHash ? await publicClient.getTransactionReceipt({ hash: createTxHash }) : null);
              const factoryLogs = receiptToUse ? receiptToUse.logs.filter(
                log => log.address.toLowerCase() === FACTORY_SCHEDULED_ADDRESS.toLowerCase()
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
            setProgressMessage(
              t('create.modal.transactionConfirmedNoAddress', {
                defaultValue: 'Transaction confirmed! (Contract address not found - check Basescan)',
              })
            );
            
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
          setProgressMessage(t('create.modal.transactionConfirmed', { defaultValue: 'Transaction confirmed!' }));
        }
      } else if (isConfirmed && createTxHash && !contractAddress) {
        // ✅ FIX : Fallback si l'extraction échoue mais que la transaction est confirmée
        console.log('⚠️ Transaction confirmée mais extraction adresse en cours ou échouée, passage à success...');
        setStatus('success');
        setProgressMessage(t('create.modal.transactionConfirmed', { defaultValue: 'Transaction confirmed!' }));
      }
    };

    extractAndSave();
  }, [isConfirmed, createTxHash, publicClient, contractAddress, receipt]);

  // Effect : Gestion des erreurs
  useEffect(() => {
    console.log('🔍 [ERROR DETECTION] Vérification erreurs:', {
      hasWriteError: !!writeError,
      hasConfirmError: !!confirmError,
      writeErrorMessage: writeError?.message || 'none',
      confirmErrorMessage: confirmError?.message || 'none',
      currentStatus: status,
    });

    if (writeError) {
      console.error('❌ Erreur writeContract détectée:', writeError);
      console.error('❌ Type d\'erreur:', typeof writeError);
      console.error('❌ Détails erreur complets:', safeStringify(writeError));
      console.error('❌ Détails erreur:', {
        name: writeError.name,
        message: writeError.message,
        cause: writeError.cause,
        stack: writeError.stack,
        code: (writeError as any)?.code,
        shortMessage: (writeError as any)?.shortMessage,
        data: (writeError as any)?.data,
      });
      
      // ✅ FIX : Annuler les timeouts si erreur
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (creationTimeoutRef.current) {
        clearTimeout(creationTimeoutRef.current);
        creationTimeoutRef.current = null;
      }
      
      // ✅ FIX : Message d'erreur plus détaillé avec détection précise
      let errorMessage = 'Transaction annulée ou échouée.';
      const errorCandidates = [
        writeError.message,
        (writeError as any)?.shortMessage,
        (writeError as any)?.cause?.message,
      ].filter(Boolean) as string[];
      const errorMsgLower = errorCandidates.join(' | ').toLowerCase();
      
      if (errorMsgLower.includes('user rejected') || errorMsgLower.includes('user denied') || errorMsgLower.includes('user cancelled')) {
        errorMessage = 'Transaction annulée par l\'utilisateur dans MetaMask.';
      } else if (errorMsgLower.includes('insufficient funds') || errorMsgLower.includes('balance') || errorMsgLower.includes('insufficient balance')) {
        errorMessage = 'Balance insuffisante pour effectuer cette transaction. Vérifiez votre solde ETH pour les frais de gas.';
      } else if (errorMsgLower.includes('allowance') || errorMsgLower.includes('approval')) {
        errorMessage = 'Allowance insuffisante. Veuillez approuver à nouveau le token.';
      } else if (errorMsgLower.includes('gas') || errorMsgLower.includes('transaction underpriced')) {
        errorMessage = 'Erreur de gas. Vérifiez votre connexion réseau et réessayez.';
      } else if (errorMsgLower.includes('nonce') || errorMsgLower.includes('replacement transaction')) {
        errorMessage = 'Erreur de nonce. Veuillez réessayer dans quelques instants.';
      } else if (errorMsgLower.includes('network') || errorMsgLower.includes('connection')) {
        errorMessage = 'Erreur de connexion réseau. Vérifiez votre connexion internet.';
      } else if (writeError.message) {
        errorMessage = `Erreur: ${writeError.message}`;
      }
      
      console.error('❌ Message d\'erreur final:', errorMessage);
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
      setProgressMessage(
        t('create.modal.errorConfirmingTransaction', { defaultValue: 'Error confirming transaction' })
      );
    }
  }, [writeError, confirmError]);
  
  // ✅ FIX : Mettre à jour les refs du statut et contractAddress quand ils changent
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  useEffect(() => {
    contractAddressRef.current = contractAddress;
  }, [contractAddress]);

  // ✅ FIX : Nettoyer les timeouts quand le status change vers success, error, ou confirming
  // (confirming signifie que la transaction est confirmée et on extrait l'adresse, donc le timeout n'est plus nécessaire)
  useEffect(() => {
    if (status === 'success' || status === 'error' || status === 'confirming') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (creationTimeoutRef.current) {
        clearTimeout(creationTimeoutRef.current);
        creationTimeoutRef.current = null;
        console.log('✅ Timeout annulé - statut:', status);
      }
    }
  }, [status]);

  // Reset
  const reset = () => {
    // ✅ FIX : Annuler tous les timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (creationTimeoutRef.current) {
      clearTimeout(creationTimeoutRef.current);
      creationTimeoutRef.current = null;
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