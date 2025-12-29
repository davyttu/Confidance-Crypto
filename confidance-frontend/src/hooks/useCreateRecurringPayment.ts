// src/hooks/useCreateRecurringPayment.ts
// Hook pour créer des paiements récurrents mensualisés (USDC/USDT uniquement)
// ✅ FIX CRITIQUE : Approve le CONTRAT créé au lieu de la Factory
// Workflow: create → extract address → approve contract → save DB

import { useState, useEffect, useRef } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';

// Factory V2 avec support récurrent (avec dayOfMonth + InstantPayment)
const FACTORY_ADDRESS: `0x${string}` = '0x0BD36382637312095a93354b2e5c71B68f570881';
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

  // Hook pour écrire les transactions (création + approve)
  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // ✅ NOUVEAU: Hook séparé pour l'approbation du contrat
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  // Attendre confirmation de la transaction de création
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });

  // ✅ NOUVEAU: Attendre confirmation de l'approbation
  const {
    isSuccess: isApproveConfirmed,
    error: approveConfirmError,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
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

      // ✅ CHANGEMENT: Directement créer le contrat (pas d'approve de la Factory)
      setStatus('creating');
      setProgressMessage(`Création du paiement récurrent ${tokenData.symbol}...`);
      
      // 🔍 DEBUG: Afficher timestamp actuel et valeurs
      const now = Math.floor(Date.now() / 1000);
      console.log('🔍 DEBUG - Timestamp actuel:', now);
      console.log('🔍 DEBUG - Arguments envoyés:', {
        beneficiary: params.beneficiary,
        tokenAddress: tokenData.address,
        monthlyAmount: params.monthlyAmount.toString(),
        firstPaymentTime: params.firstPaymentTime,
        totalMonths: params.totalMonths,
        dayOfMonth: params.dayOfMonth,
        timeUntilFirst: params.firstPaymentTime - now,
        isFirstPaymentInFuture: params.firstPaymentTime > now
      });

      writeContract({
        abi: paymentFactoryAbi,
        address: FACTORY_ADDRESS,
        functionName: 'createRecurringPaymentERC20',
        args: [
          params.beneficiary,
          tokenData.address as `0x${string}`,
          params.monthlyAmount,
          BigInt(params.firstPaymentTime),
          BigInt(params.totalMonths),
          BigInt(params.dayOfMonth),
        ],
      });

    } catch (err) {
      console.error('Erreur createRecurringPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
    }
  };

  // Effect : Passer en mode confirming quand la transaction est en cours
  useEffect(() => {
    if (isConfirming && status === 'creating') {
      setStatus('confirming');
      setProgressMessage('Confirmation de la transaction...');
    }
  }, [isConfirming, status]);

  // ✅ Effect : Extraction adresse + Approve contrat
  useEffect(() => {
    const extractAndApprove = async () => {
      if (isConfirmed && createTxHash && publicClient && !contractAddress && status === 'confirming') {
        try {
          setProgressMessage('Récupération de l\'adresse du contrat...');

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          console.log('📋 Receipt reçu, extraction de l\'adresse...');

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
                      console.log('✅ Contrat RecurringPayment trouvé via event:', foundAddress);
                      break;
                    }
                  } catch (decodeError) {
                    continue;
                  }
                }
              }
            }
          } catch (err) {
            console.warn('⚠️ Méthode 1 échouée, essai méthode 2...');
          }

          // Méthode 2: Fallback - Premier log non-Factory
          if (!foundAddress) {
            for (const log of receipt.logs) {
              if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
                foundAddress = log.address as `0x${string}`;
                console.log('✅ Contrat RecurringPayment trouvé (fallback):', foundAddress);
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
          console.log('✅ Contrat créé avec succès !');
          console.log('📄 Adresse du contrat:', foundAddress);
          console.log('🔗 Voir le contrat sur Basescan:', contractUrl);
          console.log('🔗 Voir la transaction sur Basescan:', txUrl);

          // ✅ NOUVEAU: Approuver le contrat créé
          if (!currentParams) {
            throw new Error('Paramètres manquants');
          }

          const tokenData = getToken(currentParams.tokenSymbol);
          if (!tokenData.address) {
            throw new Error('Token address manquante');
          }

          setStatus('approving_contract');
          setProgressMessage(`Approbation du contrat pour ${currentParams.totalMonths} mois...`);

          console.log('💳 Approbation du contrat récurrent:', {
            token: tokenData.address,
            spender: foundAddress,
            amount: totalRequired?.toString(),
          });

          // Appel approve sur le token
          writeApprove({
            address: tokenData.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [foundAddress, totalRequired || BigInt(0)],
          });

        } catch (err) {
          console.error('❌ Erreur lors de l\'extraction/approbation:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de l\'approbation du contrat');
          
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    };

    extractAndApprove();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isConfirmed, createTxHash, publicClient, contractAddress, status, currentParams, totalRequired, writeApprove]);

  // ✅ Effect : Enregistrement Supabase après approve confirmé
  useEffect(() => {
    const saveToDatabase = async () => {
      if (isApproveConfirmed && approveTxHash && contractAddress && status === 'approving_contract') {
        try {
          setProgressMessage('Enregistrement dans la base de données...');
          
          const params = currentParams;
          const userAddress = capturedPayerAddress;
          const tokenData = params ? getToken(params.tokenSymbol) : null;

          if (!params || !userAddress) {
            console.error('❌ Paramètres manquants pour enregistrement');
            setStatus('success');
            setProgressMessage('Paiement créé ! (Non enregistré dans la DB)');
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
            console.log('✅ Paiement récurrent enregistré dans Supabase:', result.recurringPayment?.id);
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
  }, [isApproveConfirmed, approveTxHash, contractAddress, status, currentParams, capturedPayerAddress, createTxHash, isAuthenticated, user, guestEmail]);

  // Effect : Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      console.error('❌ Erreur writeContract:', writeError);
      setError(writeError as Error);
      setStatus('error');
      setProgressMessage('Transaction annulée ou échouée. Vérifiez MetaMask.');
      hasCalledWriteContract.current = false;
    }
    if (confirmError) {
      console.error('❌ Erreur confirmation:', confirmError);
      setError(confirmError as Error);
      setStatus('error');
      setProgressMessage('Erreur de confirmation de la transaction');
    }
    if (approveError) {
      console.error('❌ Erreur approve:', approveError);
      setError(approveError as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de l\'approbation du contrat');
    }
    if (approveConfirmError) {
      console.error('❌ Erreur confirmation approve:', approveConfirmError);
      setError(approveConfirmError as Error);
      setStatus('error');
      setProgressMessage('Erreur de confirmation de l\'approbation');
    }
  }, [writeError, confirmError, approveError, approveConfirmError]);

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
    resetWrite();
    resetApprove();
  };

  // Calculer les steps
  const totalSteps = 2; // create + approve
  let currentStep = 0;
  if (status === 'creating' || status === 'confirming') currentStep = 1;
  if (status === 'approving_contract') currentStep = 2;
  if (status === 'success') currentStep = 2;

  return {
    status,
    error,
    createTxHash,
    approveTxHash,
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