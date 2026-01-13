// src/hooks/useCreateRecurringPayment.ts
// Hook pour créer des paiements récurrents mensualisés (USDC/USDT uniquement)
// ✅ FIX CRITIQUE : Approve le CONTRAT créé au lieu de la Factory
// Workflow: create → extract address → approve contract → save DB

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { decodeEventLog, erc20Abi } from 'viem';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';
import { PAYMENT_FACTORY_RECURRING } from '@/lib/contracts/addresses';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenApproval } from '@/hooks/useTokenApproval';

// ✅ Utiliser la nouvelle factory Recurring pour les recurring payments
const FACTORY_ADDRESS: `0x${string}` = PAYMENT_FACTORY_RECURRING as `0x${string}`;
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


// Fees protocole
const FEE_BASIS_POINTS = 179;
const BASIS_POINTS_DENOMINATOR = 10000;

interface CreateRecurringPaymentParams {
  tokenSymbol: TokenSymbol; // USDC ou USDT uniquement
  beneficiary: `0x${string}`;
  monthlyAmount: bigint; // Montant EXACT par mois
  firstPaymentTime: number; // Timestamp Unix première échéance
  totalMonths: number; // 1-12
  dayOfMonth: number; // Jour du mois (1-28)
  cancellable?: boolean; // Optionnel (non implémenté dans le contrat actuel)
}

type PaymentStatus =
  | 'idle'
  | 'approving_factory'  // Transaction approve de la Factory
  | 'creating'           // Transaction createRecurringPaymentERC20
  | 'confirming'         // Attente confirmation création
  | 'approving_contract' // Transaction approve du contrat créé ✅ NOUVEAU
  | 'success'
  | 'error';

interface UseCreateRecurringPaymentReturn {
  // État
  status: PaymentStatus;
  error: Error | null;
  
  // Transactions
  createTxHash: `0x${string}` | undefined;
  approveTxHash: `0x${string}` | undefined; // ✅ Hash approve du contrat
  contractAddress: `0x${string}` | undefined;

  // Actions
  createRecurringPayment: (params: CreateRecurringPaymentParams) => Promise<void>;
  reset: () => void;

  // Progress (pour UI)
  currentStep: number; // 1 (create) ou 2 (approve)
  totalSteps: number; // Toujours 2
  progressMessage: string;
  
  // Infos calculs
  monthlyFee: bigint | null;
  totalPerMonth: bigint | null;
  totalRequired: bigint | null;

  // Guest email
  isAuthenticated: boolean;
  needsGuestEmail: boolean;
  setGuestEmail: (email: string) => void;
}

/**
 * Calcule le montant total à approuver
 */
function calculateRecurringTotal(monthlyAmount: bigint, totalMonths: number): {
  monthlyFee: bigint;
  totalPerMonth: bigint;
  totalRequired: bigint;
} {
  const monthlyFee = (monthlyAmount * BigInt(FEE_BASIS_POINTS)) / BigInt(BASIS_POINTS_DENOMINATOR);
  const totalPerMonth = monthlyAmount + monthlyFee;
  const totalRequired = totalPerMonth * BigInt(totalMonths);

  return { monthlyFee, totalPerMonth, totalRequired };
}

export function useCreateRecurringPayment(): UseCreateRecurringPaymentReturn {
  const { t } = useTranslation();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { user, isAuthenticated } = useAuth();

  // État local
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>();
  const [currentParams, setCurrentParams] = useState<CreateRecurringPaymentParams | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [capturedPayerAddress, setCapturedPayerAddress] = useState<`0x${string}` | undefined>();

  // Guest email
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [needsGuestEmail, setNeedsGuestEmail] = useState(false);

  // Infos calculs
  const [monthlyFee, setMonthlyFee] = useState<bigint | null>(null);
  const [totalPerMonth, setTotalPerMonth] = useState<bigint | null>(null);
  const [totalRequired, setTotalRequired] = useState<bigint | null>(null);

  // Protection contre double appel
  const hasCalledWriteContract = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentApproveTxHash = useRef<`0x${string}` | undefined>(undefined);

  // Hook pour écrire les transactions (création uniquement)
  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // ✅ FIX CRITIQUE : Deux approbations nécessaires
  // 1. Approuver la Factory (pour qu'elle puisse créer le contrat)
  // 2. Approuver le contrat créé (pour qu'il puisse faire les transferts mensuels)
  const token = currentParams ? getToken(currentParams.tokenSymbol) : null;
  const amountForApproval = totalRequired || BigInt(1);

  // Hook pour approuver la Factory (étape 1)
  const approvalFactoryHook = useTokenApproval({
    tokenSymbol: currentParams?.tokenSymbol || 'USDC',
    spenderAddress: FACTORY_ADDRESS,
    amount: BigInt(1), // Montant minimal pour la Factory (juste pour créer)
    releaseTime: Math.floor(Date.now() / 1000),
  });

  // Hook pour approuver le contrat créé (étape 3) - spenderAddress sera mis à jour après création
  const approvalContractHook = useTokenApproval({
    tokenSymbol: currentParams?.tokenSymbol || 'USDC',
    spenderAddress: contractAddress, // ✅ Approuver le contrat créé
    amount: amountForApproval,
    releaseTime: Math.floor(Date.now() / 1000),
  });

  // Attendre confirmation de la transaction de création
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });

  // Fonction principale de création
  const createRecurringPayment = async (params: CreateRecurringPaymentParams) => {
    if (!address) {
      setError(new Error('Wallet non connecté'));
      return;
    }

    try {
      setError(null);
      setCurrentParams(params);
      setCapturedPayerAddress(address);
      hasCalledWriteContract.current = false;

      // Validation : Tokens supportés (USDC/USDT uniquement)
      if (params.tokenSymbol !== 'USDC' && params.tokenSymbol !== 'USDT') {
        throw new Error('Paiements récurrents disponibles uniquement pour USDC et USDT');
      }

      const tokenData = getToken(params.tokenSymbol);
      
      if (!tokenData.address) {
        throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
      }

      // Validation : Nombre de mois (1-12)
      if (params.totalMonths < 1 || params.totalMonths > 12) {
        throw new Error('Le nombre de mois doit être entre 1 et 12');
      }

      // Validation : Date future
      if (params.firstPaymentTime <= Math.floor(Date.now() / 1000)) {
        throw new Error('La première échéance doit être dans le futur');
      }

      // Validation : Jour du mois (1-28)
      if (params.dayOfMonth < 1 || params.dayOfMonth > 28) {
        throw new Error('Le jour du mois doit être entre 1 et 28');
      }

      // Calculer le total requis
      const { 
        monthlyFee: fee, 
        totalPerMonth: perMonth, 
        totalRequired: total 
      } = calculateRecurringTotal(params.monthlyAmount, params.totalMonths);

      setMonthlyFee(fee);
      setTotalPerMonth(perMonth);
      setTotalRequired(total);

      console.log('💰 Calcul paiement récurrent:', {
        monthlyAmount: params.monthlyAmount.toString(),
        monthlyFee: fee.toString(),
        totalPerMonth: perMonth.toString(),
        totalMonths: params.totalMonths,
        totalRequired: total.toString()
      });

      // ✅ FIX : Workflow identique aux Scheduled Payments : Approbation → Création
      // Vérifier d'abord si l'allowance est déjà suffisante
      if (!publicClient || !address) {
        throw new Error('Client blockchain ou adresse non disponible');
      }

      // ✅ FIX : TOUJOURS demander l'approbation pour les paiements récurrents
      // Même si l'allowance pour la Factory est suffisante, on doit toujours demander l'approbation
      // car l'utilisateur doit voir la fenêtre MetaMask pour l'approbation
      // Note: Le contrat créé vérifiera allowance(payer, address(this)), donc il faudra peut-être
      // approuver le contrat créé après sa création, mais pour l'instant on suit le workflow Scheduled
      console.log('🔍 [RECURRING] Vérification allowance existante (pour info uniquement):', {
        factoryAddress: FACTORY_ADDRESS,
        note: 'On demandera toujours l\'approbation pour que l\'utilisateur voie la fenêtre MetaMask',
      });
      
      try {
        const currentAllowance = await publicClient.readContract({
          address: tokenData.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, FACTORY_ADDRESS],
        }) as bigint;

        console.log('🔍 [RECURRING] Allowance existante pour Factory:', {
          currentAllowance: currentAllowance.toString(),
          required: total.toString(),
          isSufficient: currentAllowance >= total,
          note: 'On demandera quand même l\'approbation pour afficher MetaMask',
        });
      } catch (allowanceErr) {
        console.warn('⚠️ [RECURRING] Erreur lors de la vérification de l\'allowance (on continue):', allowanceErr);
      }

      // ✅ FIX CRITIQUE : D'abord approuver la Factory (montant minimal)
      setStatus('approving_factory');
      setProgressMessage(`Approbation de ${tokenData.symbol} pour la création...`);

      console.log('💳 [RECURRING] Étape 1/3: Approbation de la Factory...', {
        token: tokenData.address,
        spender: FACTORY_ADDRESS,
        amount: BigInt(1).toString(),
        note: 'Approbation minimale pour que la Factory puisse créer le contrat',
      });

      // Vérifier que le hook est bien initialisé
      if (!approvalFactoryHook || typeof approvalFactoryHook.approve !== 'function') {
        console.error('❌ [RECURRING] approvalFactoryHook non disponible');
        throw new Error('Hook d\'approbation Factory non disponible');
      }

      // Approuver la Factory avec montant minimal
      console.log('📤 [RECURRING] Appel approvalFactoryHook.approve()...');

      try {
        approvalFactoryHook.approve(BigInt(1), params.tokenSymbol, tokenData.address as `0x${string}`);
        console.log('✅ [RECURRING] approvalFactoryHook.approve() appelé avec succès');
      } catch (approveErr) {
        console.error('❌ [RECURRING] Erreur lors de l\'appel approvalFactoryHook.approve():', approveErr);
        throw approveErr;
      }

    } catch (err) {
      console.error('Erreur createRecurringPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
    }
  };

  // ✅ Effect : Logs pour l'approbation Factory
  useEffect(() => {
    console.log('🔍 [RECURRING] État approbation Factory:', {
      approveTxHash: approvalFactoryHook.approveTxHash || 'NON DISPONIBLE',
      isApproveSuccess: approvalFactoryHook.isApproveSuccess,
      isApproving: approvalFactoryHook.isApproving,
      approveError: approvalFactoryHook.approveError?.message || 'Aucune erreur',
      status,
    });

    if (approvalFactoryHook.approveTxHash) {
      console.log('✅ [RECURRING] Hash d\'approbation Factory reçu:', approvalFactoryHook.approveTxHash);
      console.log('🔗 [RECURRING] Voir sur Basescan:', `https://basescan.org/tx/${approvalFactoryHook.approveTxHash}`);
    }

    if (approvalFactoryHook.isApproveSuccess && approvalFactoryHook.approveTxHash) {
      console.log('✅✅✅ [RECURRING] Approbation Factory confirmée !', {
        txHash: approvalFactoryHook.approveTxHash,
        blockNumber: approvalFactoryHook.approveReceipt?.blockNumber,
      });
    }
  }, [approvalFactoryHook.approveTxHash, approvalFactoryHook.isApproveSuccess, approvalFactoryHook.isApproving, approvalFactoryHook.approveError, approvalFactoryHook.approveReceipt, status]);

  // ✅ Effect : Logs pour l'approbation du contrat créé
  useEffect(() => {
    if (status === 'approving_contract') {
      console.log('🔍 [RECURRING] État approbation Contrat créé:', {
        contractAddress,
        approveTxHash: approvalContractHook.approveTxHash || 'NON DISPONIBLE',
        isApproveSuccess: approvalContractHook.isApproveSuccess,
        isApproving: approvalContractHook.isApproving,
        approveError: approvalContractHook.approveError?.message || 'Aucune erreur',
      });

      if (approvalContractHook.approveTxHash) {
        console.log('✅ [RECURRING] Hash d\'approbation Contrat reçu:', approvalContractHook.approveTxHash);
        console.log('🔗 [RECURRING] Voir sur Basescan:', `https://basescan.org/tx/${approvalContractHook.approveTxHash}`);
      }

      if (approvalContractHook.isApproveSuccess) {
        console.log('✅✅✅ [RECURRING] Approbation Contrat confirmée !', {
          txHash: approvalContractHook.approveTxHash,
          blockNumber: approvalContractHook.approveReceipt?.blockNumber,
        });
      }
    }
  }, [status, contractAddress, approvalContractHook.approveTxHash, approvalContractHook.isApproveSuccess, approvalContractHook.isApproving, approvalContractHook.approveError, approvalContractHook.approveReceipt]);

  // ✅ Effect : Après confirmation de l'approbation Factory, créer le contrat
  useEffect(() => {
    const createAfterApproveFactory = async () => {
      console.log('🔍 [RECURRING] Vérification conditions création après approbation Factory:', {
        status,
        isApproveSuccess: approvalFactoryHook.isApproveSuccess,
        hasCurrentParams: !!currentParams,
        hasCreateTxHash: !!createTxHash,
        approveError: approvalFactoryHook.approveError?.message,
        shouldProceed: status === 'approving_factory' && approvalFactoryHook.isApproveSuccess && currentParams && !createTxHash
      });

      // ✅ Créer le contrat après approbation Factory
      if (status === 'approving_factory' && approvalFactoryHook.isApproveSuccess && currentParams && !createTxHash) {
        try {
          console.log('✅✅✅ [RECURRING] Approbation Factory confirmée ! Étape 2/3: Création du contrat...');

          const tokenData = getToken(currentParams.tokenSymbol);
          if (!tokenData.address) {
            throw new Error('Token address manquante');
          }

          setStatus('creating');
          setProgressMessage(`Création du paiement récurrent ${tokenData.symbol}...`);

          const now = Math.floor(Date.now() / 1000);
          console.log('🔍 [RECURRING] Arguments création:', {
            beneficiary: currentParams.beneficiary,
            tokenAddress: tokenData.address,
            monthlyAmount: currentParams.monthlyAmount.toString(),
            firstPaymentTime: currentParams.firstPaymentTime,
            totalMonths: currentParams.totalMonths,
            dayOfMonth: currentParams.dayOfMonth,
            timeUntilFirst: currentParams.firstPaymentTime - now,
          });

          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createRecurringPaymentERC20',
            args: [
              currentParams.beneficiary,
              tokenData.address as `0x${string}`,
              currentParams.monthlyAmount,
              BigInt(currentParams.firstPaymentTime),
              BigInt(currentParams.totalMonths),
              BigInt(currentParams.dayOfMonth),
            ],
          });

          console.log('📤 [RECURRING] writeContract appelé pour la création...');
        } catch (err) {
          console.error('❌ [RECURRING] Erreur lors de la création après approbation Factory:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de la création du contrat');
        }
      }
    };

    createAfterApproveFactory();
  }, [approvalFactoryHook.isApproveSuccess, currentParams, status, createTxHash, writeContract]);

  // ✅ Note : Le fallback n'est plus nécessaire car nous avons maintenant 2 hooks d'approbation séparés
  // qui gèrent chacun leur propre transaction de manière indépendante

  // Effect : Passer en mode confirming quand la transaction de création est en cours
  useEffect(() => {
    if (isConfirming && status === 'creating') {
      console.log('⏳ [RECURRING] Transaction de création en attente de confirmation...', { createTxHash });
      setStatus('confirming');
      setProgressMessage('Confirmation de la création...');
    }
  }, [isConfirming, status, createTxHash]);

  // ✅ AJOUT : Log quand la transaction de création est confirmée
  useEffect(() => {
    if (isConfirmed && createTxHash) {
      console.log('✅✅✅ [RECURRING] Transaction de création confirmée !', { createTxHash, status, contractAddress });
    }
  }, [isConfirmed, createTxHash, status, contractAddress]);

  // ✅ Effect : Extraction adresse après création confirmée
  useEffect(() => {
    const extractAddress = async () => {
      console.log('🔍 [RECURRING] Vérification conditions extraction:', {
        isConfirmed,
        createTxHash,
        hasPublicClient: !!publicClient,
        contractAddress,
        status,
        shouldProceed: isConfirmed && createTxHash && publicClient && !contractAddress && (status === 'confirming' || status === 'creating')
      });
      
      // ✅ FIX : Accepter aussi le statut 'creating' au cas où le statut n'a pas encore été mis à jour
      if (isConfirmed && createTxHash && publicClient && !contractAddress && (status === 'confirming' || status === 'creating')) {
        try {
          console.log('✅ [RECURRING] Conditions remplies, extraction de l\'adresse...');
          setProgressMessage('Récupération de l\'adresse du contrat...');

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          console.log('📋 [RECURRING] Receipt reçu, extraction de l\'adresse...');

          let foundAddress: `0x${string}` | undefined;

          // Méthode 1: Décoder les events
          try {
            const recurringPaymentCreatedEvent = paymentFactoryAbi.find(
              (item) => item.type === 'event' && item.name === 'RecurringPaymentCreatedERC20'
            );

            if (recurringPaymentCreatedEvent) {
              for (const log of receipt.logs) {
                if (log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
                  try {
                    const decoded = decodeEventLog({
                      abi: [recurringPaymentCreatedEvent],
                      data: log.data,
                      topics: log.topics,
                    });

                    if (decoded.eventName === 'RecurringPaymentCreatedERC20') {
                      foundAddress = (decoded.args as any).paymentContract as `0x${string}`;
                      console.log('✅ [RECURRING] Contrat RecurringPayment trouvé via event:', foundAddress);
                      break;
                    }
                  } catch (decodeError) {
                    continue;
                  }
                }
              }
            }
          } catch (err) {
            console.warn('⚠️ [RECURRING] Méthode 1 échouée, essai méthode 2...');
          }

          // Méthode 2: Fallback - Premier log non-Factory
          if (!foundAddress) {
            for (const log of receipt.logs) {
              if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
                foundAddress = log.address as `0x${string}`;
                console.log('✅ [RECURRING] Contrat RecurringPayment trouvé (fallback):', foundAddress);
                break;
              }
            }
          }

          if (!foundAddress) {
            throw new Error('Impossible de trouver l\'adresse du contrat dans les logs');
          }

          setContractAddress(foundAddress);

          const contractUrl = `https://basescan.org/address/${foundAddress}`;
          const txUrl = `https://basescan.org/tx/${createTxHash}`;
          console.log('✅✅✅ [RECURRING] Contrat créé avec succès !');
          console.log('📄 [RECURRING] Adresse du contrat:', foundAddress);
          console.log('🔗 [RECURRING] Voir le contrat sur Basescan:', contractUrl);
          console.log('🔗 [RECURRING] Voir la transaction sur Basescan:', txUrl);

          // ✅ FIX CRITIQUE : Passer immédiatement à l'approbation du contrat créé
          setStatus('approving_contract');
          setProgressMessage('Approbation du contrat pour les paiements mensuels...');
          console.log('⏳ [RECURRING] Étape 3/3: Approbation du contrat créé...');

        } catch (err) {
          console.error('❌ [RECURRING] Erreur lors de l\'extraction:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de l\'extraction de l\'adresse');

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    };

    extractAddress();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isConfirmed, createTxHash, publicClient, contractAddress, status]);

  // ✅ NOUVEAU Effect : Approuver le contrat créé après extraction de l'adresse
  useEffect(() => {
    const approveCreatedContract = async () => {
      console.log('🔍 [RECURRING] Vérification conditions approbation contrat créé:', {
        status,
        contractAddress,
        hasCurrentParams: !!currentParams,
        isApproveSuccess: approvalContractHook.isApproveSuccess,
        isApproving: approvalContractHook.isApproving,
        approveTxHash: approvalContractHook.approveTxHash,
        shouldProceed: status === 'approving_contract' && contractAddress && currentParams && !approvalContractHook.isApproving && !approvalContractHook.isApproveSuccess
      });

      if (status === 'approving_contract' && contractAddress && currentParams && !approvalContractHook.isApproving && !approvalContractHook.isApproveSuccess) {
        try {
          const tokenData = getToken(currentParams.tokenSymbol);
          if (!tokenData.address) {
            throw new Error('Token address manquante');
          }

          if (!totalRequired) {
            throw new Error('Total requis non calculé');
          }

          console.log('💳 [RECURRING] Étape 3/3: Approbation du contrat créé...', {
            contractAddress,
            tokenSymbol: currentParams.tokenSymbol,
            tokenAddress: tokenData.address,
            amount: totalRequired.toString(),
            amountFormatted: `${(Number(totalRequired) / (10 ** tokenData.decimals)).toFixed(6)} ${tokenData.symbol}`,
            totalMonths: currentParams.totalMonths,
          });

          console.log('📤 [RECURRING] Appel approvalContractHook.approve()...');

          // Approuver le contrat créé avec le montant total requis
          approvalContractHook.approve(totalRequired, currentParams.tokenSymbol, tokenData.address as `0x${string}`);

          console.log('✅ [RECURRING] approvalContractHook.approve() appelé avec succès');
        } catch (err) {
          console.error('❌ [RECURRING] Erreur lors de l\'approbation du contrat créé:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de l\'approbation du contrat');
        }
      }
    };

    approveCreatedContract();
  }, [status, contractAddress, currentParams, totalRequired, approvalContractHook.isApproving, approvalContractHook.isApproveSuccess]);

  // ✅ Effect : Enregistrement Supabase après création ET les 2 approbations confirmées
  useEffect(() => {
    const saveToDatabase = async () => {
      console.log('🔍 [RECURRING] Vérification conditions sauvegarde DB:', {
        isConfirmed,
        createTxHash,
        contractAddress,
        isContractApproveSuccess: approvalContractHook.isApproveSuccess,
        status,
        shouldProceed: isConfirmed && createTxHash && contractAddress && approvalContractHook.isApproveSuccess && status === 'approving_contract'
      });

      // ✅ FIX CRITIQUE : Sauvegarder seulement après que le contrat créé ait été approuvé
      if (isConfirmed && createTxHash && contractAddress && approvalContractHook.isApproveSuccess && status === 'approving_contract') {
        try {
          console.log('✅✅✅ [RECURRING] Toutes les étapes confirmées ! Sauvegarde dans la DB...');
          console.log('📋 [RECURRING] Récapitulatif:');
          console.log('   ✅ Étape 1: Factory approuvée');
          console.log('   ✅ Étape 2: Contrat créé');
          console.log('   ✅ Étape 3: Contrat approuvé');
          console.log('   📤 Étape 4: Sauvegarde DB...');

          setProgressMessage('Enregistrement dans la base de données...');

          const params = currentParams;
          const userAddress = capturedPayerAddress;
          const tokenData = params ? getToken(params.tokenSymbol) : null;

          if (!params || !userAddress) {
            console.error('❌ Paramètres manquants pour enregistrement');
            setStatus('success');
            setProgressMessage(t('create.modal.paymentCreatedNotSaved', {
              defaultValue: 'Paiement créé ! (Non enregistré dans la DB)'
            }));
            return;
          }

          console.log('📤 Envoi à l\'API:', {
            contract_address: contractAddress,
            payer_address: userAddress,
            payee_address: params.beneficiary,
            token_symbol: params.tokenSymbol,
            monthly_amount: params.monthlyAmount.toString(),
            total_months: params.totalMonths,
            day_of_month: params.dayOfMonth,
            first_payment_time: params.firstPaymentTime,
          });

          const response = await fetch(`${API_URL}/api/payments/recurring`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contract_address: contractAddress,
              payer_address: userAddress,
              payee_address: params.beneficiary,
              token_symbol: params.tokenSymbol,
              token_address: tokenData?.address || null,
              monthly_amount: params.monthlyAmount.toString(),
              first_payment_time: params.firstPaymentTime,
              total_months: params.totalMonths,
              day_of_month: params.dayOfMonth,
              cancellable: params.cancellable || false,
              network: getNetworkFromChainId(chainId),
              chain_id: chainId,
              transaction_hash: createTxHash,
              ...(isAuthenticated && user ? { user_id: user.id } : { guest_email: guestEmail }),
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erreur enregistrement Supabase:', errorText);
            setStatus('success');
            setProgressMessage('Paiement récurrent créé ! (Erreur enregistrement DB)');
          } else {
            const result = await response.json();
            console.log('✅✅✅ Paiement récurrent enregistré dans Supabase:', result.recurringPayment?.id);
            console.log('🎉 [RECURRING] Processus complet terminé avec succès !');
            setStatus('success');
            setProgressMessage('Paiement récurrent créé avec succès !');
          }
        } catch (apiError) {
          console.error('❌ Erreur API Supabase:', apiError);
          setStatus('success');
          setProgressMessage('Paiement récurrent créé ! (Erreur enregistrement DB)');
        }

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    saveToDatabase();
  }, [isConfirmed, createTxHash, contractAddress, approvalContractHook.isApproveSuccess, status, currentParams, capturedPayerAddress, isAuthenticated, user, guestEmail]);

  // Effect : Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      console.error('❌ [RECURRING] Erreur writeContract (création):', writeError);
      setError(writeError as Error);
      setStatus('error');
      setProgressMessage('Transaction annulée ou échouée. Vérifiez MetaMask.');
      hasCalledWriteContract.current = false;
    }
    if (confirmError) {
      console.error('❌ [RECURRING] Erreur confirmation création:', confirmError);
      setError(confirmError as Error);
      setStatus('error');
      setProgressMessage('Erreur de confirmation de la transaction de création');
    }
    // ✅ Détecter erreurs d'approbation Factory
    if (approvalFactoryHook.approveError && status === 'approving_factory') {
      console.error('❌ [RECURRING] Erreur approbation Factory:', approvalFactoryHook.approveError);

      let errorMessage = 'Erreur lors de l\'approbation de la Factory';
      if (approvalFactoryHook.approveError instanceof Error) {
        const errorMsg = approvalFactoryHook.approveError.message.toLowerCase();
        if (errorMsg.includes('user rejected') || errorMsg.includes('user denied') || errorMsg.includes('user cancelled')) {
          errorMessage = 'Approbation Factory annulée par l\'utilisateur dans MetaMask';
        } else if (errorMsg.includes('insufficient funds') || errorMsg.includes('balance')) {
          errorMessage = 'Fonds insuffisants pour payer les frais de transaction (gas)';
        } else {
          errorMessage = `Erreur: ${approvalFactoryHook.approveError.message}`;
        }
      }

      setError(new Error(errorMessage));
      setStatus('error');
      setProgressMessage(errorMessage);
    }
    // ✅ Détecter erreurs d'approbation du contrat créé
    if (approvalContractHook.approveError && status === 'approving_contract') {
      console.error('❌ [RECURRING] Erreur approbation Contrat:', approvalContractHook.approveError);

      let errorMessage = 'Erreur lors de l\'approbation du contrat';
      if (approvalContractHook.approveError instanceof Error) {
        const errorMsg = approvalContractHook.approveError.message.toLowerCase();
        if (errorMsg.includes('user rejected') || errorMsg.includes('user denied') || errorMsg.includes('user cancelled')) {
          errorMessage = 'Approbation du contrat annulée par l\'utilisateur dans MetaMask';
        } else if (errorMsg.includes('insufficient funds') || errorMsg.includes('balance')) {
          errorMessage = 'Fonds insuffisants pour payer les frais de transaction (gas)';
        } else {
          errorMessage = `Erreur: ${approvalContractHook.approveError.message}`;
        }
      }

      setError(new Error(errorMessage));
      setStatus('error');
      setProgressMessage(errorMessage);
    }
  }, [writeError, confirmError, approvalFactoryHook.approveError, approvalContractHook.approveError, status]);

  // Reset
  const reset = () => {
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
    setMonthlyFee(null);
    setTotalPerMonth(null);
    setTotalRequired(null);
    setGuestEmail('');
    setNeedsGuestEmail(false);
    hasCalledWriteContract.current = false;
    currentApproveTxHash.current = undefined;
    resetWrite();
    approvalFactoryHook.reset();
    approvalContractHook.reset();
  };

  // ✅ Calculer les steps (ordre: Approbation Factory → Création → Approbation Contrat)
  const totalSteps = 3;
  let currentStep = 0;
  if (status === 'approving_factory' || approvalFactoryHook.isApproving) currentStep = 1; // Étape 1: Approbation Factory
  if (status === 'creating' || status === 'confirming') currentStep = 2; // Étape 2: Création
  if (status === 'approving_contract' || approvalContractHook.isApproving) currentStep = 3; // Étape 3: Approbation Contrat
  if (status === 'success') currentStep = 3;

  return {
    status,
    error,
    createTxHash,
    approveTxHash: approvalContractHook.approveTxHash, // ✅ Retourner le hash d'approbation du contrat (le plus important)
    contractAddress,
    createRecurringPayment,
    reset,
    currentStep,
    totalSteps,
    progressMessage,
    monthlyFee,
    totalPerMonth,
    totalRequired,
    isAuthenticated,
    needsGuestEmail,
    setGuestEmail,
  };
}