// src/hooks/useCreateBatchRecurringPayment.ts
// Hook pour créer des paiements récurrents BATCH (plusieurs bénéficiaires)
// Workflow: approve Factory → create N contracts → approve each contract (sequentially) → save DB
// ⚠️ Pour N bénéficiaires : 1 approve Factory + 1 create + N approves contracts = 2+N MetaMask popups

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

const FACTORY_ADDRESS: `0x${string}` = PAYMENT_FACTORY_RECURRING as `0x${string}`;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

const FEE_BASIS_POINTS = 179;
const BASIS_POINTS_DENOMINATOR = 10000;

interface BatchBeneficiary {
  address: string;
  amount: string; // Amount per month for this beneficiary
}

interface CreateBatchRecurringPaymentParams {
  tokenSymbol: TokenSymbol; // USDC or USDT only
  beneficiaries: BatchBeneficiary[];
  firstPaymentTime: number; // Unix timestamp
  totalMonths: number; // 1-12
  dayOfMonth: number; // 1-28
  cancellable?: boolean;
}

type PaymentStatus =
  | 'idle'
  | 'approving_factory'
  | 'creating'
  | 'confirming'
  | 'approving_contracts' // Approving each created contract
  | 'success'
  | 'error';

interface UseCreateBatchRecurringPaymentReturn {
  status: PaymentStatus;
  error: Error | null;

  createTxHash: `0x${string}` | undefined;
  contractAddresses: `0x${string}`[];

  createBatchRecurringPayment: (params: CreateBatchRecurringPaymentParams) => Promise<void>;
  reset: () => void;

  currentStep: number;
  totalSteps: number;
  progressMessage: string;

  isAuthenticated: boolean;
  needsGuestEmail: boolean;
  setGuestEmail: (email: string) => void;
}

function calculateRecurringTotal(monthlyAmount: bigint, totalMonths: number): bigint {
  const monthlyFee = (monthlyAmount * BigInt(FEE_BASIS_POINTS)) / BigInt(BASIS_POINTS_DENOMINATOR);
  const totalPerMonth = monthlyAmount + monthlyFee;
  return totalPerMonth * BigInt(totalMonths);
}

export function useCreateBatchRecurringPayment(): UseCreateBatchRecurringPaymentReturn {
  const { t } = useTranslation();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { user, isAuthenticated } = useAuth();

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddresses, setContractAddresses] = useState<`0x${string}`[]>([]);
  const [currentParams, setCurrentParams] = useState<CreateBatchRecurringPaymentParams | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [capturedPayerAddress, setCapturedPayerAddress] = useState<`0x${string}` | undefined>();

  // Pour gérer les approbations multiples
  const [currentApprovingIndex, setCurrentApprovingIndex] = useState<number>(0);

  const [guestEmail, setGuestEmail] = useState<string>('');
  const [needsGuestEmail, setNeedsGuestEmail] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hook pour écrire la transaction de création
  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // Hook pour approuver la Factory
  const approvalFactoryHook = useTokenApproval({
    tokenSymbol: currentParams?.tokenSymbol || 'USDC',
    spenderAddress: FACTORY_ADDRESS,
    amount: BigInt(1), // Montant minimal pour créer
    releaseTime: Math.floor(Date.now() / 1000),
  });

  // Attendre confirmation de la création
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });

  // Fonction principale
  const createBatchRecurringPayment = async (params: CreateBatchRecurringPaymentParams) => {
    if (!address) {
      setError(new Error(t('dashboard.auth.walletNotConnected.title', { defaultValue: 'Wallet not connected' })));
      return;
    }

    try {
      setError(null);
      setCurrentParams(params);
      setCapturedPayerAddress(address);
      setCurrentApprovingIndex(0);

      // Validation
      if (params.tokenSymbol !== 'USDC' && params.tokenSymbol !== 'USDT') {
        throw new Error('Paiements récurrents disponibles uniquement pour USDC et USDT');
      }

      if (params.beneficiaries.length === 0) {
        throw new Error('Aucun bénéficiaire');
      }

      if (params.beneficiaries.length > 50) {
        throw new Error('Maximum 50 bénéficiaires');
      }

      if (params.totalMonths < 1 || params.totalMonths > 12) {
        throw new Error('Le nombre de mois doit être entre 1 et 12');
      }

      if (params.firstPaymentTime <= Math.floor(Date.now() / 1000)) {
        throw new Error('La première échéance doit être dans le futur');
      }

      if (params.dayOfMonth < 1 || params.dayOfMonth > 28) {
        throw new Error('Le jour du mois doit être entre 1 et 28');
      }

      const tokenData = getToken(params.tokenSymbol);
      if (!tokenData.address) {
        throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
      }

      // Étape 1: Approuver la Factory
      setStatus('approving_factory');
      setProgressMessage(`Approbation de ${tokenData.symbol} pour la création...`);

      console.log('💳 [BATCH RECURRING] Étape 1: Approbation Factory...');

      approvalFactoryHook.approve(BigInt(1), params.tokenSymbol, tokenData.address as `0x${string}`);

    } catch (err) {
      console.error('Erreur createBatchRecurringPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
    }
  };

  // Effect: Après approbation Factory → Créer les contrats
  useEffect(() => {
    const createAfterApproveFactory = async () => {
      if (status === 'approving_factory' && approvalFactoryHook.isApproveSuccess && currentParams && !createTxHash) {
        try {
          console.log('✅ [BATCH RECURRING] Factory approuvée ! Étape 2: Création des contrats...');

          const tokenData = getToken(currentParams.tokenSymbol);
          if (!tokenData.address) {
            throw new Error('Token address manquante');
          }

          setStatus('creating');
          setProgressMessage(`Création de ${currentParams.beneficiaries.length} paiements récurrents...`);

          // Préparer les arrays pour le batch
          const payees: `0x${string}`[] = [];
          const monthlyAmounts: bigint[] = [];

          for (const beneficiary of currentParams.beneficiaries) {
            payees.push(beneficiary.address as `0x${string}`);
            const amount = BigInt(Math.floor(parseFloat(beneficiary.amount) * 10 ** tokenData.decimals));
            monthlyAmounts.push(amount);
          }

          console.log('📋 [BATCH RECURRING] Arguments création:', {
            tokenAddress: tokenData.address,
            payees,
            monthlyAmounts: monthlyAmounts.map(a => a.toString()),
            firstPaymentTime: currentParams.firstPaymentTime,
            totalMonths: currentParams.totalMonths,
            dayOfMonth: currentParams.dayOfMonth,
          });

          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createBatchRecurringPaymentERC20',
            args: [
              tokenData.address as `0x${string}`,
              payees,
              monthlyAmounts,
              BigInt(currentParams.firstPaymentTime), // _startDate dans le contrat
              BigInt(currentParams.totalMonths),
              BigInt(currentParams.dayOfMonth),
            ],
          });

          console.log('📤 [BATCH RECURRING] writeContract appelé');
        } catch (err) {
          console.error('❌ [BATCH RECURRING] Erreur création:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de la création');
        }
      }
    };

    createAfterApproveFactory();
  }, [approvalFactoryHook.isApproveSuccess, currentParams, status, createTxHash, writeContract]);

  // Effect: Passer en mode confirming
  useEffect(() => {
    if (isConfirming && status === 'creating') {
      console.log('⏳ [BATCH RECURRING] Confirmation en cours...');
      setStatus('confirming');
      setProgressMessage('Confirmation de la création...');
    }
  }, [isConfirming, status]);

  // Effect: Extraction des adresses après confirmation
  useEffect(() => {
    const extractAddresses = async () => {
      if (isConfirmed && createTxHash && publicClient && contractAddresses.length === 0 && (status === 'confirming' || status === 'creating')) {
        try {
          console.log('✅ [BATCH RECURRING] Extraction des adresses...');
          setProgressMessage('Récupération des adresses des contrats...');

          const receipt = await publicClient.getTransactionReceipt({ hash: createTxHash });

          const addresses: `0x${string}`[] = [];

          // Parser les events RecurringPaymentCreatedERC20
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
                    const contractAddr = (decoded.args as any).paymentContract as `0x${string}`;
                    addresses.push(contractAddr);
                    console.log('✅ [BATCH RECURRING] Contrat trouvé:', contractAddr);
                  }
                } catch (decodeError) {
                  continue;
                }
              }
            }
          }

          if (addresses.length === 0) {
            throw new Error('Impossible de trouver les adresses des contrats dans les logs');
          }

          console.log(`✅ [BATCH RECURRING] ${addresses.length} contrats créés avec succès`);
          setContractAddresses(addresses);

          // Passer à l'approbation des contrats
          setStatus('approving_contracts');
          setCurrentApprovingIndex(0);
          setProgressMessage(`Approbation du contrat 1/${addresses.length}...`);

        } catch (err) {
          console.error('❌ [BATCH RECURRING] Erreur extraction:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de l\'extraction des adresses');
        }
      }
    };

    extractAddresses();
  }, [isConfirmed, createTxHash, publicClient, contractAddresses.length, status]);

  // Effect: Approuver chaque contrat séquentiellement
  useEffect(() => {
    const approveNextContract = async () => {
      if (
        status === 'approving_contracts' &&
        contractAddresses.length > 0 &&
        currentApprovingIndex < contractAddresses.length &&
        currentParams &&
        publicClient &&
        address
      ) {
        try {
          const contractToApprove = contractAddresses[currentApprovingIndex];
          const beneficiary = currentParams.beneficiaries[currentApprovingIndex];
          const tokenData = getToken(currentParams.tokenSymbol);

          if (!tokenData.address) {
            throw new Error('Token address manquante');
          }

          const monthlyAmount = BigInt(Math.floor(parseFloat(beneficiary.amount) * 10 ** tokenData.decimals));
          const totalRequired = calculateRecurringTotal(monthlyAmount, currentParams.totalMonths);

          console.log(`💳 [BATCH RECURRING] Approbation contrat ${currentApprovingIndex + 1}/${contractAddresses.length}...`, {
            contract: contractToApprove,
            amount: totalRequired.toString(),
          });

          setProgressMessage(`Approbation du contrat ${currentApprovingIndex + 1}/${contractAddresses.length}...`);

          // Approuver le contrat
          const USDC = new (await import('viem')).getContract({
            address: tokenData.address as `0x${string}`,
            abi: erc20Abi,
            client: { public: publicClient },
          });

          // ✅ FIX: Toujours demander l'approbation pour que l'utilisateur voie toutes les fenêtres MetaMask
          // Même si l'allowance est déjà suffisante, on doit toujours demander l'approbation
          // pour garantir 2 + N transactions MetaMask (2 initiales + N pour chaque destinataire)
          console.log(`💳 [BATCH RECURRING] Approbation contrat ${currentApprovingIndex + 1}/${contractAddresses.length} requise...`);

          // Demander l'approbation via wagmi
          const { writeContract: writeApprove } = await import('wagmi/actions');
          const { config } = await import('@/lib/wagmi');

          writeApprove(config, {
            address: tokenData.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contractToApprove, totalRequired],
          }).then(hash => {
            console.log(`📤 [BATCH RECURRING] Approbation ${currentApprovingIndex + 1} envoyée:`, hash);

            // Attendre la confirmation
            publicClient.waitForTransactionReceipt({ hash }).then(() => {
              console.log(`✅ [BATCH RECURRING] Approbation ${currentApprovingIndex + 1} confirmée`);
              setCurrentApprovingIndex(currentApprovingIndex + 1);
            });
          });

        } catch (err) {
          console.error(`❌ [BATCH RECURRING] Erreur approbation contrat ${currentApprovingIndex + 1}:`, err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage(`Erreur lors de l'approbation du contrat ${currentApprovingIndex + 1}`);
        }
      }
    };

    approveNextContract();
  }, [status, contractAddresses, currentApprovingIndex, currentParams, publicClient, address]);

  // Effect: Toutes les approbations terminées → Sauvegarder dans la DB
  useEffect(() => {
    const saveToDatabase = async () => {
      if (
        status === 'approving_contracts' &&
        contractAddresses.length > 0 &&
        currentApprovingIndex === contractAddresses.length &&
        currentParams &&
        capturedPayerAddress
      ) {
        try {
          console.log('✅ [BATCH RECURRING] Toutes les approbations terminées ! Sauvegarde DB...');
          setProgressMessage('Enregistrement dans la base de données...');

          const tokenData = getToken(currentParams.tokenSymbol);

          // Sauvegarder chaque paiement récurrent
          for (let i = 0; i < contractAddresses.length; i++) {
            const beneficiary = currentParams.beneficiaries[i];
            const monthlyAmount = BigInt(Math.floor(parseFloat(beneficiary.amount) * 10 ** tokenData.decimals));

            const response = await fetch(`${API_URL}/api/payments/recurring`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contract_address: contractAddresses[i],
                payer_address: capturedPayerAddress,
                payee_address: beneficiary.address,
                token_symbol: currentParams.tokenSymbol,
                token_address: tokenData?.address || null,
                monthly_amount: monthlyAmount.toString(),
                first_payment_time: currentParams.firstPaymentTime,
                total_months: currentParams.totalMonths,
                day_of_month: currentParams.dayOfMonth,
                cancellable: currentParams.cancellable || false,
                network: getNetworkFromChainId(chainId),
                chain_id: chainId,
                transaction_hash: createTxHash,
                ...(isAuthenticated && user ? { user_id: user.id } : { guest_email: guestEmail }),
              }),
            });

            if (!response.ok) {
              console.error(`❌ Erreur enregistrement contrat ${i + 1}:`, await response.text());
            } else {
              const result = await response.json();
              console.log(`✅ Contrat ${i + 1} enregistré:`, result.recurringPayment?.id);
            }
          }

          console.log('🎉 [BATCH RECURRING] Processus complet terminé avec succès !');
          setStatus('success');
          setProgressMessage(`${contractAddresses.length} paiements récurrents créés avec succès !`);

        } catch (apiError) {
          console.error('❌ Erreur API:', apiError);
          setStatus('success');
          setProgressMessage(`${contractAddresses.length} paiements créés ! (Erreur enregistrement DB)`);
        }
      }
    };

    saveToDatabase();
  }, [status, contractAddresses, currentApprovingIndex, currentParams, capturedPayerAddress, isAuthenticated, user, guestEmail, chainId, createTxHash]);

  // Effect: Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      console.error('❌ [BATCH RECURRING] Erreur writeContract:', writeError);
      setError(writeError as Error);
      setStatus('error');
      setProgressMessage('Transaction annulée ou échouée');
    }
    if (confirmError) {
      console.error('❌ [BATCH RECURRING] Erreur confirmation:', confirmError);
      setError(confirmError as Error);
      setStatus('error');
      setProgressMessage('Erreur de confirmation');
    }
    if (approvalFactoryHook.approveError && status === 'approving_factory') {
      console.error('❌ [BATCH RECURRING] Erreur approbation Factory:', approvalFactoryHook.approveError);

      let errorMessage = 'Erreur lors de l\'approbation de la Factory';
      if (approvalFactoryHook.approveError instanceof Error) {
        const errorMsg = approvalFactoryHook.approveError.message.toLowerCase();
        if (errorMsg.includes('user rejected') || errorMsg.includes('user denied') || errorMsg.includes('user cancelled')) {
          errorMessage = 'Approbation Factory annulée par l\'utilisateur';
        }
      }

      setError(new Error(errorMessage));
      setStatus('error');
      setProgressMessage(errorMessage);
    }
  }, [writeError, confirmError, approvalFactoryHook.approveError, status]);

  // Reset
  const reset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setStatus('idle');
    setError(null);
    setContractAddresses([]);
    setCurrentParams(null);
    setProgressMessage('');
    setCapturedPayerAddress(undefined);
    setCurrentApprovingIndex(0);
    setGuestEmail('');
    setNeedsGuestEmail(false);
    resetWrite();
    approvalFactoryHook.reset();
  };

  // Calculer les steps
  const beneficiariesCount = currentParams?.beneficiaries.length || 0;
  const totalSteps = 2 + beneficiariesCount; // Factory approval + Creation + N contract approvals
  let currentStep = 0;
  if (status === 'approving_factory' || approvalFactoryHook.isApproving) currentStep = 1;
  if (status === 'creating' || status === 'confirming') currentStep = 2;
  if (status === 'approving_contracts') currentStep = 2 + currentApprovingIndex + 1;
  if (status === 'success') currentStep = totalSteps;

  return {
    status,
    error,
    createTxHash,
    contractAddresses,
    createBatchRecurringPayment,
    reset,
    currentStep,
    totalSteps,
    progressMessage,
    isAuthenticated,
    needsGuestEmail,
    setGuestEmail,
  };
}
