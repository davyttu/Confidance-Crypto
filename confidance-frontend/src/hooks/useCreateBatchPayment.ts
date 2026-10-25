// src/hooks/useCreateBatchPayment.ts
// VERSION 2 : Fees s'ajoutent au montant (pas dÃ©duites)

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { parseEther, parseUnits, decodeEventLog } from 'viem';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';
import { PAYMENT_FACTORY_SCHEDULED, PAYMENT_FACTORY_INSTANT, getPaymentFactory } from '@/lib/contracts/addresses';
import { useAuth } from '@/contexts/AuthContext';
import {
  type TokenSymbol,
  getWriteToken,
  getProtocolFeeBps,
  PROTOCOL_FEE_BPS_PARTICULAR,
  PROTOCOL_FEE_BPS_PRO,
} from '@/config/tokens';
import { useTokenApproval } from './useTokenApproval';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

// ✅ Factories (Base Mainnet)
const FACTORY_SCHEDULED_ADDRESS: `0x${string}` = PAYMENT_FACTORY_SCHEDULED as `0x${string}`;
const FACTORY_INSTANT_ADDRESS: `0x${string}` = PAYMENT_FACTORY_INSTANT as `0x${string}`;

const getFactoryAddress = (
  isInstant: boolean,
  scheduled: `0x${string}` = FACTORY_SCHEDULED_ADDRESS,
  instant: `0x${string}` = FACTORY_INSTANT_ADDRESS,
): `0x${string}` => (isInstant ? instant : scheduled);

const resolveOnchainFeeBps = async (params: {
  isInstantPayment: boolean;
  address?: `0x${string}`;
  publicClient?: ReturnType<typeof usePublicClient>;
  isProVerified: boolean;
  scheduledFactory?: `0x${string}`;
}): Promise<number> => {
  if (params.isInstantPayment) {
    return 0;
  }
  if (!params.publicClient || !params.address) {
    return getProtocolFeeBps({ isInstantPayment: false, isProVerified: params.isProVerified });
  }
  try {
    const isProOnchain = await params.publicClient.readContract({
      address: params.scheduledFactory ?? FACTORY_SCHEDULED_ADDRESS,
      abi: paymentFactoryAbi,
      functionName: 'isProWallet',
      args: [params.address],
    });
    return (isProOnchain as boolean) ? PROTOCOL_FEE_BPS_PRO : PROTOCOL_FEE_BPS_PARTICULAR;
  } catch (error) {
    console.warn('⚠️ Impossible de lire isProWallet on-chain, fallback off-chain.', error);
    return getProtocolFeeBps({ isInstantPayment: false, isProVerified: params.isProVerified });
  }
};
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// ✅ Multi-chain : réseau courant
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


const FEE_DENOMINATOR = 10000;

export interface Beneficiary {
  address: string;
  amount: string;
  name?: string;
}

export type CustomTokenPayload = {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
};

interface CreateBatchPaymentParams {
  beneficiaries: Beneficiary[];
  releaseTime: number;
  cancellable?: boolean;
  tokenSymbol?: TokenSymbol;
  customToken?: CustomTokenPayload;
}

type PaymentStatus = 
  | 'idle' 
  | 'creating' 
  | 'confirming' 
  | 'success' 
  | 'error';

interface UseCreateBatchPaymentReturn {
  status: PaymentStatus;
  error: Error | null;
  createTxHash: `0x${string}` | undefined;
  contractAddress: `0x${string}` | undefined;
  createBatchPayment: (params: CreateBatchPaymentParams) => Promise<void>;
  reset: () => void;
  progressMessage: string;
  totalToBeneficiaries: bigint | null;
  protocolFee: bigint | null;
  totalRequired: bigint | null;
  
  // Guest email
  isAuthenticated: boolean;
  needsGuestEmail: boolean;
  setGuestEmail: (email: string) => void;
}

function calculateTotalRequired(amounts: bigint[], feeBps: number): {
  totalToBeneficiaries: bigint;
  protocolFee: bigint;
  totalRequired: bigint;
} {
  const totalToBeneficiaries = amounts.reduce((sum, amount) => sum + amount, BigInt(0));
  const protocolFee = (totalToBeneficiaries * BigInt(feeBps)) / BigInt(FEE_DENOMINATOR);
  const totalRequired = totalToBeneficiaries + protocolFee;

  return { totalToBeneficiaries, protocolFee, totalRequired };
}

export function useCreateBatchPayment(): UseCreateBatchPaymentReturn {
  const { t } = useTranslation();
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const FACTORY_SCHEDULED_ADDRESS = getPaymentFactory(chainId, 'scheduled');
  const FACTORY_INSTANT_ADDRESS = getPaymentFactory(chainId, 'instant');
  const publicClient = usePublicClient();
  const { user, isAuthenticated } = useAuth();

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>();
  const [progressMessage, setProgressMessage] = useState<string>('');
  
  const [totalToBeneficiaries, setTotalToBeneficiaries] = useState<bigint | null>(null);
  const [protocolFee, setProtocolFee] = useState<bigint | null>(null);
  const [totalRequired, setTotalRequired] = useState<bigint | null>(null);
  
  // ✅ FIX: Ajouter ce state
  const [currentParams, setCurrentParams] = useState<CreateBatchPaymentParams | null>(null);
  
  // ✅ FIX: Protection contre les appels multiples d'enregistrement
  const isSavingRef = useRef<boolean>(false);
  const savedTransactionHashRef = useRef<`0x${string}` | undefined>(undefined);
  
  // Guest email
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [needsGuestEmail, setNeedsGuestEmail] = useState(false);
  
  // ✅ Hook d'approbation pour ERC20 batch (built-in ou custom)
  const token = currentParams
    ? currentParams.customToken
      ? {
          address: currentParams.customToken.address,
          decimals: currentParams.customToken.decimals,
          symbol: currentParams.customToken.symbol,
          isNative: false as const,
        }
      : getWriteToken(chainId, currentParams.tokenSymbol || 'ETH')
    : null;
  const isInstantFromParams = currentParams
    ? (currentParams.releaseTime - Math.floor(Date.now() / 1000)) < 60
    : false;
  
  // ✅ Pour les batch, on doit calculer le total (somme de tous les montants)
  const amountForApproval = totalRequired || BigInt(0);
  const approvalTokenSymbol: TokenSymbol = currentParams?.tokenSymbol || 'ETH';
  
  const approvalHook = useTokenApproval({
    tokenSymbol: approvalTokenSymbol,
    spenderAddress: isInstantFromParams ? FACTORY_INSTANT_ADDRESS : FACTORY_SCHEDULED_ADDRESS,
    amount: amountForApproval,
    releaseTime: currentParams?.releaseTime,
  });
  
  // ✅ Ref pour stocker les paramètres nécessaires pour créer le paiement après approbation
  const pendingPaymentParamsRef = useRef<{
    payees: `0x${string}`[];
    amounts: bigint[];
    tokenAddress: `0x${string}`;
    factoryAddress: `0x${string}`;
  } | null>(null);

  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });
  
  // ✅ Hook séparé pour l'approbation (comme dans useCreateRecurringPayment)
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();
  
  // ✅ Attendre la confirmation de la transaction d'approbation
  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveSuccess,
    error: approveConfirmError,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const createBatchPayment = async (params: CreateBatchPaymentParams) => {
    if (!address) {
      setError(new Error('Wallet non connectÃ©'));
      return;
    }

    try {
      setError(null);

      if (params.beneficiaries.length === 0 || params.beneficiaries.length > 5) {
        throw new Error('Le nombre de bÃ©nÃ©ficiaires doit Ãªtre entre 1 et 5');
      }

      // ✅ Déterminer le token (built-in ou custom)
      const tokenSymbol = params.tokenSymbol || 'ETH';
      const token = params.customToken
        ? {
            address: params.customToken.address,
            decimals: params.customToken.decimals,
            symbol: params.customToken.symbol,
            isNative: false as const,
          }
        : getWriteToken(chainId, tokenSymbol);
      const isERC20 = !token.isNative;

      const payees: `0x${string}`[] = [];
      const amounts: bigint[] = [];

      for (const beneficiary of params.beneficiaries) {
        if (!beneficiary.address || !/^0x[a-fA-F0-9]{40}$/.test(beneficiary.address)) {
          throw new Error(`Adresse invalide : ${beneficiary.address}`);
        }

        const amountFloat = parseFloat(beneficiary.amount);
        if (isNaN(amountFloat) || amountFloat <= 0) {
          throw new Error(`Montant invalide : ${beneficiary.amount}`);
        }

        // ✅ Utiliser parseUnits pour les tokens ERC20 (avec decimals) ou parseEther pour ETH
        const amountWei = isERC20 
          ? parseUnits(beneficiary.amount, token.decimals)
          : parseEther(beneficiary.amount);
        
        payees.push(beneficiary.address as `0x${string}`);
        amounts.push(amountWei);
      }

      // ✅ Détecter si c'est un paiement instantané
      const now = Math.floor(Date.now() / 1000);
      const isInstantPayment = (params.releaseTime - now) < 60;
      const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
      const feeBps = await resolveOnchainFeeBps({
        isInstantPayment,
        address,
        publicClient,
        isProVerified,
        scheduledFactory: FACTORY_SCHEDULED_ADDRESS,
      });
      const factoryAddress = getFactoryAddress(isInstantPayment, FACTORY_SCHEDULED_ADDRESS, FACTORY_INSTANT_ADDRESS);
      
      // ✅ Calculer les montants selon le type de paiement
      let totalBenef: bigint;
      let fee: bigint;
      let total: bigint;
      
      if (isInstantPayment) {
        // Paiement instantané : pas de fees
        totalBenef = amounts.reduce((sum, amount) => sum + amount, BigInt(0));
        fee = BigInt(0);
        total = totalBenef;
      } else {
        // Paiement programmé : avec fees
        const calculated = calculateTotalRequired(amounts, feeBps);
        totalBenef = calculated.totalToBeneficiaries;
        fee = calculated.protocolFee;
        total = calculated.totalRequired;
      }

      setTotalToBeneficiaries(totalBenef);
      setProtocolFee(fee);
      setTotalRequired(total);
      
      // ✅ FIX: Stocker params AVANT pour que le hook d'approbation se mette à jour
      // Attendre un peu que React se stabilise
      setCurrentParams(params);
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 150));

      // ✅ Formater les montants avec les bonnes decimals pour l'affichage
      const divisor = BigInt(10 ** token.decimals);
      const formattedTotalBenef = Number(totalBenef) / Number(divisor);
      const formattedFee = Number(fee) / Number(divisor);
      const formattedTotal = Number(total) / Number(divisor);

      console.log('💰 Formatage pour affichage:', {
        totalBenef: totalBenef.toString(),
        total: total.toString(),
        tokenSymbol,
        tokenDecimals: token.decimals,
        divisor: divisor.toString(),
        formattedTotalBenef,
        formattedTotal,
      });

      setStatus('creating');
      setProgressMessage(
        `Création du paiement pour ${payees.length} bénéficiaire(s)...\n` +
        `Montant bénéficiaires: ${formattedTotalBenef.toFixed(4)} ${token.symbol}\n` +
        `Fees protocole: ${formattedFee.toFixed(4)} ${token.symbol}\n` +
        `Total Ã  envoyer: ${formattedTotal.toFixed(4)} ${token.symbol}`
      );

      if (isInstantPayment) {
        if (isERC20) {
          // ⚡ Paiement batch instantané ERC20 : gérer l'approbation automatiquement
          console.log('🔍 Paiement batch ERC20 instantané:', {
            tokenSymbol,
            tokenAddress: token.address,
            factoryAddress,
            totalRequired: total.toString(),
            payeesCount: payees.length,
          });
          
          // ✅ Stocker les paramètres pour créer le paiement après approbation
          pendingPaymentParamsRef.current = {
            payees,
            amounts,
            tokenAddress: token.address as `0x${string}`,
            factoryAddress,
          };
          
          // ✅ Mettre à jour currentParams pour que le hook d'approbation se mette à jour
          // Attendre un peu que React se stabilise
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // ✅ Vérifier l'allowance actuelle
          if (publicClient && address && token.address) {
            try {
              const currentAllowance = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [address, factoryAddress],
              }) as bigint;
              
              console.log('📊 Vérification allowance:', {
                current: currentAllowance.toString(),
                required: total.toString(),
                sufficient: currentAllowance >= total,
              });
              
              if (currentAllowance < total) {
                console.log('⚠️ Allowance insuffisante, demande d\'approbation...');
                setStatus('approving');
                setProgressMessage(
                  `Approbation requise pour ${formattedTotal.toFixed(4)} ${tokenSymbol}...\n` +
                  `Veuillez approuver la transaction dans MetaMask.`
                );
                
                // ✅ Vérifier que le wallet est connecté et prêt
                if (!address || !isConnected) {
                  console.error('❌ Wallet non connecté pour approbation:', { address, isConnected });
                  setError(new Error(t('dashboard.auth.walletNotConnected.title', { defaultValue: 'Wallet not connected' })));
                  setStatus('error');
                  setProgressMessage(t('dashboard.auth.walletNotConnected.description', { defaultValue: 'Please connect your wallet to access your dashboard.' }));
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                console.log('🔍 État du wallet:', {
                  address,
                  isConnected,
                  connectorName: connector?.name,
                  connectorId: connector?.id,
                });
                
                // ✅ Vérifier que tous les paramètres sont valides avant d'appeler approve()
                if (!token.address || token.address === 'NATIVE') {
                  console.error('❌ Adresse du token invalide:', token.address);
                  setError(new Error(`Adresse du token invalide pour ${token.symbol}`));
                  setStatus('error');
                  setProgressMessage(`Erreur: adresse du token ${token.symbol} invalide`);
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                if (!factoryAddress) {
                  console.error('❌ Adresse de la factory invalide:', factoryAddress);
                  setError(new Error('Adresse de la factory invalide'));
                  setStatus('error');
                  setProgressMessage('Erreur: adresse de la factory invalide');
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                if (total <= BigInt(0)) {
                  console.error('❌ Montant total invalide:', total.toString());
                  setError(new Error('Montant total invalide'));
                  setStatus('error');
                  setProgressMessage('Erreur: montant total invalide');
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                // ✅ Vérifier que le hook d'approbation est disponible
                if (!approvalHook || typeof approvalHook.approve !== 'function') {
                  console.error('❌ Hook d\'approbation non disponible ou fonction approve manquante');
                  setError(new Error('Erreur interne: hook d\'approbation non disponible'));
                  setStatus('error');
                  setProgressMessage('Erreur interne: hook d\'approbation non disponible');
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                // ✅ Vérifier l'état du hook d'approbation
                console.log('🔍 État du hook d\'approbation avant appel approve():', {
                  currentAllowance: approvalHook.currentAllowance?.toString(),
                  isAllowanceSufficient: approvalHook.isAllowanceSufficient,
                  isCheckingAllowance: approvalHook.isCheckingAllowance,
                  isApproving: approvalHook.isApproving,
                  isApproveSuccess: approvalHook.isApproveSuccess,
                  approveTxHash: approvalHook.approveTxHash,
                  approveError: approvalHook.approveError?.message,
                  hasApproveFunction: typeof approvalHook.approve === 'function',
                });
                
                // ✅ Appeler directement writeContract pour l'approbation (comme dans useCreateRecurringPayment)
                try {
                  console.log('📤 Appel writeApprove directement avec paramètres:', {
                    amount: total.toString(),
                    amountFormatted: formattedTotal.toFixed(4),
                    tokenSymbol,
                    tokenAddress: token.address,
                    factoryAddress,
                    decimals: token.decimals,
                  });
                  
                  // ✅ Appeler directement writeContract pour déclencher MetaMask
                  writeApprove({
                    address: token.address as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [factoryAddress, total],
                  });
                  
                  console.log('✅ writeApprove appelé, MetaMask devrait s\'ouvrir...');
                  
                  // Le paiement sera créé automatiquement une fois l'approbation confirmée
                  // (géré par le useEffect qui écoute isApproveSuccess)
                  return;
                } catch (approveErr) {
                  console.error('❌ Erreur lors de l\'appel writeApprove:', approveErr);
                  console.error('❌ Détails de l\'erreur:', {
                    name: (approveErr as Error)?.name,
                    message: (approveErr as Error)?.message,
                    stack: (approveErr as Error)?.stack,
                  });
                  setError(approveErr as Error);
                  setStatus('error');
                  setProgressMessage(`Erreur lors de la demande d'approbation: ${(approveErr as Error).message}`);
                  pendingPaymentParamsRef.current = null;
                  return;
                }
              }
              
              console.log('✅ Allowance suffisante, création du paiement immédiatement...');
              // Allowance suffisante, créer le paiement directement
              pendingPaymentParamsRef.current = null; // Nettoyer
              
              writeContract({
                abi: paymentFactoryAbi,
                address: factoryAddress,
                functionName: 'createInstantBatchPaymentERC20',
                args: [
                  token.address as `0x${string}`,
                  payees,
                  amounts,
                ],
              });
            } catch (allowanceError) {
              console.error('❌ Erreur vérification allowance:', allowanceError);
              setError(new Error(`Erreur vérification allowance: ${(allowanceError as Error).message}`));
              setStatus('error');
              pendingPaymentParamsRef.current = null;
              return;
            }
          }
        } else {
          // ⚡ Paiement batch instantané ETH : utiliser createInstantBatchPaymentETH
          writeContract({
            abi: paymentFactoryAbi,
            address: factoryAddress,
            functionName: 'createInstantBatchPaymentETH',
            args: [
              payees,
              amounts,
            ],
            value: total, // Montant exact, pas de fees
          });
        }
      } else {
        // Paiement batch programmé
        if (isERC20 && tokenSymbol !== 'ETH') {
          // ✅ Paiement batch programmé ERC20 : gérer l'approbation automatiquement
          console.log('🔍 Paiement batch ERC20 programmé:', {
            tokenSymbol,
            tokenAddress: token.address,
            factoryAddress,
            totalRequired: total.toString(),
            payeesCount: payees.length,
          });
          
          // ✅ Stocker les paramètres pour créer le paiement après approbation
          pendingPaymentParamsRef.current = {
            payees,
            amounts,
            tokenAddress: token.address as `0x${string}`,
            factoryAddress,
          };
          
          // ✅ Mettre à jour currentParams pour que le hook d'approbation se mette à jour
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // ✅ Vérifier l'allowance actuelle
          if (publicClient && address && token.address) {
            try {
              const currentAllowance = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [address, factoryAddress],
              }) as bigint;
              
              console.log('📊 Vérification allowance pour paiement programmé:', {
                current: currentAllowance.toString(),
                required: total.toString(),
                sufficient: currentAllowance >= total,
              });
              
              if (currentAllowance < total) {
                console.log('⚠️ Allowance insuffisante, demande d\'approbation...');
                setStatus('approving');
                setProgressMessage(
                  `Approbation requise pour ${formattedTotal.toFixed(4)} ${tokenSymbol}...\n` +
                  `Veuillez approuver la transaction dans MetaMask.`
                );
                
                // ✅ Vérifier que le wallet est connecté et prêt
                if (!address || !isConnected) {
                  console.error('❌ Wallet non connecté pour approbation:', { address, isConnected });
                  setError(new Error(t('dashboard.auth.walletNotConnected.title', { defaultValue: 'Wallet not connected' })));
                  setStatus('error');
                  setProgressMessage(t('dashboard.auth.walletNotConnected.description', { defaultValue: 'Please connect your wallet to access your dashboard.' }));
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                // ✅ Vérifier que tous les paramètres sont valides
                if (!token.address || token.address === 'NATIVE') {
                  console.error('❌ Adresse du token invalide:', token.address);
                  setError(new Error(`Adresse du token invalide pour ${token.symbol}`));
                  setStatus('error');
                  setProgressMessage(`Erreur: adresse du token ${token.symbol} invalide`);
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                if (!factoryAddress) {
                  console.error('❌ Adresse de la factory invalide:', factoryAddress);
                  setError(new Error('Adresse de la factory invalide'));
                  setStatus('error');
                  setProgressMessage('Erreur: adresse de la factory invalide');
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                if (total <= BigInt(0)) {
                  console.error('❌ Montant total invalide:', total.toString());
                  setError(new Error('Montant total invalide'));
                  setStatus('error');
                  setProgressMessage('Erreur: montant total invalide');
                  pendingPaymentParamsRef.current = null;
                  return;
                }
                
                // ✅ Appeler directement writeContract pour l'approbation
                try {
                  console.log('📤 Appel writeApprove directement avec paramètres:', {
                    amount: total.toString(),
                    amountFormatted: formattedTotal.toFixed(4),
                    tokenSymbol,
                    tokenAddress: token.address,
                    factoryAddress,
                    decimals: token.decimals,
                  });
                  
                  writeApprove({
                    address: token.address as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [factoryAddress, total],
                  });
                  
                  console.log('✅ writeApprove appelé, MetaMask devrait s\'ouvrir...');
                  
                  // Le paiement sera créé automatiquement une fois l'approbation confirmée
                  // (géré par le useEffect qui écoute isApproveSuccess)
                  return;
                } catch (approveErr) {
                  console.error('❌ Erreur lors de l\'appel writeApprove:', approveErr);
                  setError(approveErr as Error);
                  setStatus('error');
                  setProgressMessage(`Erreur lors de la demande d'approbation: ${(approveErr as Error).message}`);
                  pendingPaymentParamsRef.current = null;
                  return;
                }
              } else {
                // ✅ Allowance suffisante, créer le paiement directement
                console.log('✅ Allowance suffisante, création du paiement batch ERC20 programmé directement...');
                setStatus('creating');
                setProgressMessage(`Création du paiement batch ${token.symbol}...`);
                
                // Nettoyer les paramètres en attente puisqu'on n'a pas besoin d'approbation
                pendingPaymentParamsRef.current = null;
                
                writeContract({
                  abi: paymentFactoryAbi,
                  address: factoryAddress,
                  functionName: 'createBatchPaymentERC20',
                  args: [
                    token.address as `0x${string}`,
                    payees,
                    amounts,
                    BigInt(params.releaseTime),
                    params.cancellable || false,
                  ],
                });
              }
            } catch (allowanceError) {
              console.error('❌ Erreur vérification allowance:', allowanceError);
              setError(new Error(`Erreur vérification allowance: ${(allowanceError as Error).message}`));
              setStatus('error');
              pendingPaymentParamsRef.current = null;
              return;
            }
          }
        } else {
          // Paiement batch programmé ETH : utiliser createBatchPaymentETH
          writeContract({
            abi: paymentFactoryAbi,
            address: factoryAddress,
            functionName: 'createBatchPaymentETH',
            args: [
              payees,
              amounts,
              BigInt(params.releaseTime),
              params.cancellable || false,
            ],
            value: total,
          });
        }
      }

    } catch (err) {
      console.error('Erreur createBatchPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
      pendingPaymentParamsRef.current = null;
    }
  };

  // ✅ useEffect pour créer automatiquement le paiement après approbation réussie
  useEffect(() => {
    if (
      isApproveSuccess &&
      approveTxHash &&
      pendingPaymentParamsRef.current &&
      status === 'approving'
    ) {
      const params = pendingPaymentParamsRef.current;
      console.log('✅ Approbation confirmée, création du paiement batch...', {
        approveTxHash,
        params,
      });
      
      // ✅ Déterminer si c'est un paiement instantané ou programmé
      const isInstant = currentParams 
        ? (currentParams.releaseTime - Math.floor(Date.now() / 1000)) < 60
        : false;
      
      setStatus('creating');
      setProgressMessage('Création du paiement batch après approbation...');
      
      // Créer le paiement (instantané ou programmé)
      if (isInstant) {
        writeContract({
          abi: paymentFactoryAbi,
          address: params.factoryAddress,
          functionName: 'createInstantBatchPaymentERC20',
          args: [
            params.tokenAddress,
            params.payees,
            params.amounts,
          ],
        });
      } else {
        // Paiement programmé : besoin de releaseTime et cancellable
        if (!currentParams) {
          console.error('❌ currentParams manquant pour créer le paiement programmé');
          setError(new Error('Paramètres manquants pour créer le paiement programmé'));
          setStatus('error');
          pendingPaymentParamsRef.current = null;
          return;
        }
        
        // ✅ Paiements batch ERC20 programmés : utiliser createBatchPaymentERC20
        writeContract({
          abi: paymentFactoryAbi,
          address: params.factoryAddress,
          functionName: 'createBatchPaymentERC20',
          args: [
            params.tokenAddress,
            params.payees,
            params.amounts,
            BigInt(currentParams.releaseTime),
            currentParams.cancellable || false,
          ],
        });
      }
      
      // Nettoyer les paramètres en attente
      pendingPaymentParamsRef.current = null;
    }
  }, [isApproveSuccess, approveTxHash, status, writeContract, currentParams]);

  // ✅ useEffect pour gérer les erreurs d'approbation
  useEffect(() => {
    if (status === 'approving' && approveError) {
      console.error('❌ Erreur d\'approbation détectée:', {
        error: approveError,
        message: approveError.message,
        name: approveError.name,
      });
      
      // Analyser l'erreur pour donner un message plus clair
      let errorMessage = 'Erreur lors de l\'approbation. ';
      const errorMsgLower = approveError.message?.toLowerCase() || '';
      
      if (errorMsgLower.includes('user rejected') || errorMsgLower.includes('user denied') || errorMsgLower.includes('user cancelled')) {
        errorMessage = 'Transaction d\'approbation annulée par l\'utilisateur dans MetaMask.';
      } else if (errorMsgLower.includes('insufficient funds') || errorMsgLower.includes('balance') || errorMsgLower.includes('insufficient balance')) {
        errorMessage = 'Balance ETH insuffisante pour payer les frais de transaction (gas). Veuillez ajouter de l\'ETH à votre wallet.';
      } else if (errorMsgLower.includes('network') || errorMsgLower.includes('connection') || errorMsgLower.includes('rpc')) {
        errorMessage = 'Erreur de connexion réseau ou RPC. Vérifiez votre connexion internet et réessayez.';
      } else if (approveError.message) {
        errorMessage += approveError.message;
      } else {
        errorMessage += 'Vérifiez MetaMask pour plus de détails.';
      }
      
      setError(new Error(errorMessage));
      setStatus('error');
      setProgressMessage(errorMessage);
      pendingPaymentParamsRef.current = null;
    }
  }, [approveError, status]);
  
  // ✅ useEffect pour vérifier si writeApprove est bien appelé
  useEffect(() => {
    if (status === 'approving') {
      console.log('🔍 État de l\'approbation:', {
        approveTxHash: approveTxHash || 'NON DISPONIBLE',
        isApproveConfirming,
        isApproveSuccess,
        approveError: approveError?.message || 'AUCUNE ERREUR',
        hasPendingParams: !!pendingPaymentParamsRef.current,
      });
    }
  }, [status, approveTxHash, isApproveConfirming, isApproveSuccess, approveError]);

  useEffect(() => {
    const extractAndSave = async () => {
      // ✅ FIX : Protection contre les appels multiples
      if (isSavingRef.current) {
        console.log('⏸️ Enregistrement déjà en cours, attente...');
        return;
      }
      
      // ✅ FIX : Vérifier si on a déjà enregistré cette transaction
      if (savedTransactionHashRef.current && createTxHash === savedTransactionHashRef.current) {
        console.log('✅ Paiement déjà enregistré pour cette transaction:', savedTransactionHashRef.current);
        return;
      }
      
      // ✅ Pour les paiements instantanés batch, on peut avoir contractAddress undefined
      // et c'est normal - il n'y a pas de contrat créé
      if (isConfirmed && createTxHash && publicClient) {
        console.log('🔍 Début extractAndSave pour batch payment...', {
          isConfirmed,
          createTxHash,
          hasPublicClient: !!publicClient,
          contractAddress,
          hasCurrentParams: !!currentParams,
          currentParamsTokenSymbol: currentParams?.tokenSymbol,
          address,
        });
        
        try {
          setStatus('confirming');
          setProgressMessage('Récupération de l\'adresse du contrat...');
          
          console.log('📋 Lecture de la transaction...');

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          let foundAddress: `0x${string}` | undefined;

          // ✅ Détecter quelle factory a été utilisée
          const tx = await publicClient.getTransaction({ hash: createTxHash });
          const isToScheduledFactory = tx.to?.toLowerCase() === FACTORY_SCHEDULED_ADDRESS.toLowerCase();
          const isToInstantFactory = tx.to?.toLowerCase() === FACTORY_INSTANT_ADDRESS.toLowerCase();
          const factoryAddressUsed = isToInstantFactory ? FACTORY_INSTANT_ADDRESS : FACTORY_SCHEDULED_ADDRESS;
          
          // ✅ Pour les paiements instantanés batch, il n'y a pas de contrat créé (transfert direct)
          // On cherche dans les événements pour confirmer le succès
          if (isToInstantFactory) {
            // Paiement instantané : pas de contrat créé, juste vérifier les événements
            console.log('✅ Paiement batch instantané détecté - transfert direct effectué');
            console.log('📋 Transaction hash:', createTxHash);
            console.log('📋 Receipt status:', receipt.status);
            
            // ✅ Marquer comme en cours d'enregistrement
            if (isSavingRef.current) {
              console.log('⏸️ Enregistrement déjà en cours pour cette transaction');
              return;
            }
            
            isSavingRef.current = true;
            console.log('🔄 Début enregistrement dans la DB...');
            
            setContractAddress(undefined); // Pas de contrat pour les instantanés
            setStatus('success');
            setProgressMessage('Paiement batch instantané effectué avec succès !');
            
            // Enregistrer dans la DB
            if (currentParams && address) {
              try {
                setProgressMessage('Enregistrement dans la base de données...');
                
                const beneficiariesData = currentParams.beneficiaries.map(b => ({
                  address: b.address,
                  amount: b.amount,
                  name: b.name || '',
                }));

                const requestBody = {
                  // ✅ Pour les paiements instantanés batch, utiliser transaction_hash comme contract_address
                  // car il n'y a pas de contrat créé (transfert direct)
                  contract_address: createTxHash, // Utiliser transaction_hash comme identifiant unique
                    payer_address: address,
                    beneficiaries: beneficiariesData,
                    total_to_beneficiaries: totalToBeneficiaries?.toString(),
                    protocol_fee: '0', // Pas de fees pour instantané
                    total_sent: totalRequired?.toString(),
                    release_time: currentParams.releaseTime,
                    cancellable: false, // Pas applicable pour instantané
                    network: getNetworkFromChainId(chainId),
                    chain_id: chainId,
                    transaction_hash: createTxHash,
                  is_instant: true, // ✅ Booléen true (pas string)
                  payment_type: 'instant', // ✅ String 'instant'
                  ...(isAuthenticated && user ? { user_id: user.id } : { guest_email: guestEmail }),
                };

                console.log('📤 Envoi à l\'API /api/payments/batch (PAIEMENT INSTANTANÉ BATCH):', {
                  contract_address: requestBody.contract_address,
                  payer_address: requestBody.payer_address,
                  beneficiaries_count: beneficiariesData.length,
                  is_instant: requestBody.is_instant,
                  payment_type: requestBody.payment_type,
                  transaction_hash: requestBody.transaction_hash,
                  total_to_beneficiaries: requestBody.total_to_beneficiaries,
                  total_sent: requestBody.total_sent,
                  network: requestBody.network,
                  chain_id: requestBody.chain_id,
                });
                console.log('🌐 API URL:', `${API_URL}/api/payments/batch`);
                console.log('📋 BODY COMPLET envoyé à l\'API:', JSON.stringify(requestBody, null, 2));

                const response = await fetch(`${API_URL}/api/payments/batch`, {
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
                    errorData = { error: errorText };
                  }
                  
                  console.error('❌ Erreur enregistrement:', errorText);
                  console.error('❌ Status:', response.status);
                  console.error('❌ Error data:', errorData);
                  
                  // Afficher un message d'erreur à l'utilisateur
                  setProgressMessage(`⚠️ Paiement effectué mais erreur d'enregistrement (${response.status}): ${errorData?.error || errorText}. Le paiement blockchain a bien été effectué.`);
                  
                  // Ne pas changer le status en error car le paiement blockchain a réussi
                  // Mais on pourrait essayer de réessayer l'enregistrement
                  isSavingRef.current = false;
                  
                  // Optionnel: réessayer après quelques secondes
                  // setTimeout(() => {
                  //   if (!savedTransactionHashRef.current) {
                  //     isSavingRef.current = false;
                  //   }
                  // }, 5000);
                } else {
                  const result = await response.json();
                  console.log('✅ Enregistré dans la DB:', result);
                  console.log('✅ Payment ID:', result.payment?.id);
                  savedTransactionHashRef.current = createTxHash;
                  isSavingRef.current = false;
                  setProgressMessage('✅ Paiement effectué et enregistré avec succès !');
                }
              } catch (apiError) {
                console.error('❌ Erreur API lors de l\'enregistrement:', apiError);
                console.error('❌ Détails:', {
                  message: (apiError as Error)?.message,
                  stack: (apiError as Error)?.stack,
                });
                // Ne pas changer le status en error car le paiement a réussi
                isSavingRef.current = false;
              }
            } else {
              console.warn('⚠️ currentParams ou address manquant pour l\'enregistrement:', {
                hasCurrentParams: !!currentParams,
                hasAddress: !!address,
              });
              isSavingRef.current = false;
            }
            return;
          }
          
          // ✅ Pour les paiements programmés, décoder les événements pour trouver l'adresse du contrat
          // Essayer de décoder BatchPaymentCreatedETH d'abord
          try {
            for (const log of receipt.logs) {
              if (log.address.toLowerCase() === FACTORY_SCHEDULED_ADDRESS.toLowerCase()) {
                // ✅ Essayer BatchPaymentCreatedERC20 en premier si on sait que c'est ERC20
                const isERC20 = currentParams?.tokenSymbol && currentParams.tokenSymbol !== 'ETH';
                
                if (isERC20) {
                  // Pour ERC20, essayer BatchPaymentCreatedERC20 d'abord
                  try {
                    const decodedERC20 = decodeEventLog({
                      abi: paymentFactoryAbi,
                      data: log.data,
                      topics: log.topics as any,
                      eventName: 'BatchPaymentCreatedERC20',
                    }) as any;
                    
                    if (decodedERC20?.args?.paymentContract) {
                      foundAddress = decodedERC20.args.paymentContract as `0x${string}`;
                      console.log('✅ Contrat batch ERC20 trouvé via BatchPaymentCreatedERC20 event:', foundAddress);
                      break;
                    }
                  } catch (e2) {
                    // Ce n'est pas BatchPaymentCreatedERC20, essayer BatchPaymentCreatedETH
                    try {
                      const decodedETH = decodeEventLog({
                        abi: paymentFactoryAbi,
                        data: log.data,
                        topics: log.topics as any,
                        eventName: 'BatchPaymentCreatedETH',
                      }) as any;
                      
                      if (decodedETH?.args?.paymentContract) {
                        foundAddress = decodedETH.args.paymentContract as `0x${string}`;
                        console.log('✅ Contrat batch trouvé via BatchPaymentCreatedETH event:', foundAddress);
                        break;
                      }
                    } catch (e) {
                      // Ce n'est pas un événement batch, continuer
                    }
                  }
                } else {
                  // Pour ETH, essayer BatchPaymentCreatedETH d'abord
                  try {
                    const decodedETH = decodeEventLog({
                      abi: paymentFactoryAbi,
                      data: log.data,
                      topics: log.topics as any,
                      eventName: 'BatchPaymentCreatedETH',
                    }) as any;
                    
                    if (decodedETH?.args?.paymentContract) {
                      foundAddress = decodedETH.args.paymentContract as `0x${string}`;
                      console.log('✅ Contrat batch ETH trouvé via BatchPaymentCreatedETH event:', foundAddress);
                      break;
                    }
                  } catch (e) {
                    // Ce n'est pas BatchPaymentCreatedETH, essayer BatchPaymentCreatedERC20
                    try {
                      const decodedERC20 = decodeEventLog({
                        abi: paymentFactoryAbi,
                        data: log.data,
                        topics: log.topics as any,
                        eventName: 'BatchPaymentCreatedERC20',
                      }) as any;
                      
                      if (decodedERC20?.args?.paymentContract) {
                        foundAddress = decodedERC20.args.paymentContract as `0x${string}`;
                        console.log('✅ Contrat batch trouvé via BatchPaymentCreatedERC20 event:', foundAddress);
                        break;
                      }
                    } catch (e2) {
                      // Ce n'est pas un événement batch, continuer
                    }
                  }
                }
              }
            }
          } catch (decodeError) {
            console.warn('⚠️ Erreur lors du décodage des événements, fallback sur méthode simple:', decodeError);
          }
          
          // ✅ Fallback : si pas trouvé via événements, chercher la première adresse non-factory
          if (!foundAddress) {
            for (const log of receipt.logs) {
              const isScheduledFactory = log.address.toLowerCase() === FACTORY_SCHEDULED_ADDRESS.toLowerCase();
              const isInstantFactory = log.address.toLowerCase() === FACTORY_INSTANT_ADDRESS.toLowerCase();
              if (!isScheduledFactory && !isInstantFactory) {
                foundAddress = log.address as `0x${string}`;
                console.log('✅ Contrat batch trouvé via fallback (première adresse non-factory):', foundAddress);
                break;
              }
            }
          }

          if (foundAddress) {
            setContractAddress(foundAddress);

            // ✅ FIX: Protection contre les enregistrements multiples
            if (savedTransactionHashRef.current === createTxHash) {
              console.log('✅ Paiement déjà enregistré pour cette transaction:', createTxHash);
              setStatus('success');
              setProgressMessage('Paiement batch créé avec succès !');
              return;
            }
            
            // ✅ FIX: Vérifier que currentParams existe
            if (currentParams && address) {
              // ✅ Marquer comme en cours d'enregistrement
              if (isSavingRef.current) {
                console.log('⏸️ Enregistrement déjà en cours pour cette transaction');
                setStatus('success');
                setProgressMessage('Paiement batch créé avec succès !');
                return;
              }
              
              isSavingRef.current = true;
              
              try {
                setProgressMessage('Enregistrement...');
                
                const beneficiariesData = currentParams.beneficiaries.map(b => ({
                  address: b.address,
                  amount: b.amount,
                  name: b.name || '',
                }));

                console.log('ðŸ”¥ APPEL API:', `${API_URL}/api/payments/batch`);
                console.log('ðŸ“¤ Body:', {
                  contract_address: foundAddress,
                  payer_address: address,
                  beneficiaries: beneficiariesData,
                });

                const requestBody = {
                  contract_address: foundAddress,
                  payer_address: address,
                  beneficiaries: beneficiariesData,
                  token_symbol: currentParams.customToken
                    ? currentParams.customToken.symbol
                    : (currentParams.tokenSymbol || 'ETH'),
                  token_address: currentParams.customToken
                    ? currentParams.customToken.address
                    : (() => {
                        const sym = currentParams.tokenSymbol || 'ETH';
                        const t = getWriteToken(chainId, sym);
                        return t.isNative ? null : (t.address as string);
                      })(),
                  total_to_beneficiaries: totalToBeneficiaries?.toString(),
                  protocol_fee: protocolFee?.toString(),
                  total_sent: totalRequired?.toString(),
                  release_time: currentParams.releaseTime,
                  cancellable: currentParams.cancellable || false,
                  network: getNetworkFromChainId(chainId),
                  chain_id: chainId,
                  transaction_hash: createTxHash,
                  // Utilisateur connecté OU invité
                  ...(isAuthenticated && user ? { user_id: user.id } : { guest_email: guestEmail }),
                };
                
                console.log('📤 APPEL API:', `${API_URL}/api/payments/batch`);
                console.log('📋 BODY COMPLET envoyé à l\'API:', JSON.stringify(requestBody, null, 2));
                console.log('🔍 Token Symbol:', requestBody.token_symbol);
                console.log('🔍 Token Address:', requestBody.token_address);
                console.log('🔍 CurrentParams.tokenSymbol:', currentParams.tokenSymbol);

                const response = await fetch(`${API_URL}/api/payments/batch`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody),
                });

                console.log('ðŸ“¥ Response status:', response.status);

                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('âŒ Erreur enregistrement:', errorText);
                } else {
                  const result = await response.json();
                  console.log('âœ… EnregistrÃ©:', result);
                }
              } catch (apiError) {
                console.error('âŒ Erreur API:', apiError);
              }
            }

            setStatus('success');
            setProgressMessage('Paiement batch crÃ©Ã© avec succÃ¨s !');
          } else {
            setStatus('success');
            setProgressMessage('Paiement crÃ©Ã© ! (VÃ©rifiez Basescan)');
          }
        } catch (err) {
          console.error('âŒ Erreur:', err);
          setStatus('success');
          setProgressMessage('Paiement crÃ©Ã© !');
        }
      }
    };

    extractAndSave();
  }, [isConfirmed, createTxHash, publicClient, contractAddress, currentParams, address, totalToBeneficiaries, protocolFee, totalRequired]);

  useEffect(() => {
    if (writeError) {
      setError(writeError);
      setStatus('error');
      setProgressMessage('Transaction annulÃ©e');
    }
    if (confirmError) {
      setError(confirmError);
      setStatus('error');
      setProgressMessage('Erreur de confirmation');
    }
  }, [writeError, confirmError]);

  const reset = () => {
    setStatus('idle');
    setError(null);
    setContractAddress(undefined);
    setProgressMessage('');
    setTotalToBeneficiaries(null);
    setProtocolFee(null);
    setTotalRequired(null);
    setCurrentParams(null); // ✅ Reset aussi currentParams
    setGuestEmail('');
    setNeedsGuestEmail(false);
    // ✅ Reset les refs
    isSavingRef.current = false;
    savedTransactionHashRef.current = undefined;
    resetWrite();
  };

  return {
    status,
    error,
    createTxHash,
    contractAddress,
    createBatchPayment,
    reset,
    progressMessage,
    totalToBeneficiaries,
    protocolFee,
    totalRequired,
    isAuthenticated,
    needsGuestEmail,
    setGuestEmail,
  };
}