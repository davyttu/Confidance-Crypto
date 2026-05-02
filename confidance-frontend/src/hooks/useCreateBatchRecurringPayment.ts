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
import { type TokenSymbol, getToken, getProtocolFeeBps, isZeroAddress } from '@/config/tokens';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';
import { getRecurringFactoryAddress } from '@/lib/contracts/addresses';
import { fetchRecurringFeeTotalsFromFactory } from '@/lib/contracts/recurringFeePreview';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenApproval } from '@/hooks/useTokenApproval';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const getNetworkFromChainId = (chainId: number): string => {
  switch (chainId) {
    case 8453:
      return 'base_mainnet';
    case 84532:
      return 'base_sepolia';
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

const BASIS_POINTS_DENOMINATOR = 10000;

const getFriendlyCreateErrorMessage = (error: Error, t: (key: string, options?: Record<string, string>) => string) => {
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
    errorMsgLower.includes('insufficient balance') ||
    errorMsgLower.includes('balance') ||
    errorMsgLower.includes('gas * price + value')
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
    return t('create.modal.errorCreatingWithDetails', {
      defaultValue: 'Transaction failed. {{details}}',
      details: candidates[0],
    });
  }
  return t('create.modal.errorCreating', { defaultValue: 'Error during creation' });
};

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
  firstMonthAmount?: bigint; // ⭐ ADD
  label?: string;
  category?: string;
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
  approvalTotalPerContract: bigint | null;
  firstMonthAmount: bigint | null; // Montant du premier mois si personnalisé
  monthlyAmount: bigint | null; // Montant mensuel récurrent

  createBatchRecurringPayment: (params: CreateBatchRecurringPaymentParams) => Promise<void>;
  reset: () => void;

  currentStep: number;
  totalSteps: number;
  progressMessage: string;

  isAuthenticated: boolean;
  needsGuestEmail: boolean;
  setGuestEmail: (email: string) => void;
}

function calculateRecurringTotal(
  monthlyAmount: bigint,
  totalMonths: number,
  feeBps: number,
  firstMonthAmount?: bigint
): bigint {
  const monthlyFee = (monthlyAmount * BigInt(feeBps)) / BigInt(BASIS_POINTS_DENOMINATOR);
  const totalPerMonth = monthlyAmount + monthlyFee;

  // ⭐ ADD: première mensualité différente
  if (firstMonthAmount && firstMonthAmount > 0n && firstMonthAmount !== monthlyAmount) {
    const firstFee = (firstMonthAmount * BigInt(feeBps)) / BigInt(BASIS_POINTS_DENOMINATOR);
    const firstTotal = firstMonthAmount + firstFee;
    const remaining = totalMonths > 1 ? BigInt(totalMonths - 1) : 0n;
    return firstTotal + (totalPerMonth * remaining);
  }

  return totalPerMonth * BigInt(totalMonths);
}

export function useCreateBatchRecurringPayment(): UseCreateBatchRecurringPaymentReturn {
  const { t } = useTranslation();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { user, isAuthenticated } = useAuth();
  const factoryAddress = getRecurringFactoryAddress(chainId);

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddresses, setContractAddresses] = useState<`0x${string}`[]>([]);
  const [approvalTotalPerContract, setApprovalTotalPerContract] = useState<bigint | null>(null);
  const [currentParams, setCurrentParams] = useState<CreateBatchRecurringPaymentParams | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [capturedPayerAddress, setCapturedPayerAddress] = useState<`0x${string}` | undefined>();
  const [firstMonthAmount, setFirstMonthAmount] = useState<bigint | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState<bigint | null>(null);

  // Pour gérer les approbations multiples
  const [currentApprovingIndex, setCurrentApprovingIndex] = useState<number>(0);
  // État pour suivre si une transaction d'approbation est en attente de confirmation
  const [isApprovalPending, setIsApprovalPending] = useState<boolean>(false);

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

  useEffect(() => {
    if (!createTxHash || !currentParams?.beneficiaries?.length) return;
    if (typeof window === 'undefined') return;
    try {
      const storageKey = 'batchRecurringMainByTx';
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const next =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? { ...parsed }
          : {};
      next[createTxHash] = currentParams.beneficiaries[0].address;
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (error) {
      console.warn('⚠️ Unable to cache batch recurring main beneficiary:', error);
    }
  }, [createTxHash, currentParams]);

  // Hook pour approuver la Factory
  const approvalFactoryHook = useTokenApproval({
    tokenSymbol: currentParams?.tokenSymbol || 'USDC',
    spenderAddress: factoryAddress,
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
      if (!tokenData.address || tokenData.address === 'NATIVE' || isZeroAddress(tokenData.address)) {
        throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
      }

      const perBeneficiaryAmount = BigInt(
        Math.floor(parseFloat(params.beneficiaries[0]?.amount || '0') * 10 ** tokenData.decimals)
      );
      const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
      const feeBpsFallback = getProtocolFeeBps({ isInstantPayment: false, isProVerified });

      if (!publicClient) {
        throw new Error('Client blockchain indisponible');
      }

      const fromChain = await fetchRecurringFeeTotalsFromFactory(
        publicClient,
        factoryAddress,
        address,
        perBeneficiaryAmount,
        params.totalMonths,
        params.firstMonthAmount && params.firstMonthAmount > 0n ? params.firstMonthAmount : undefined
      );

      const monthlyFee = fromChain
        ? fromChain.monthlyFee
        : (perBeneficiaryAmount * BigInt(feeBpsFallback)) / BigInt(BASIS_POINTS_DENOMINATOR);
      const totalPerMonth = fromChain
        ? fromChain.totalPerMonth
        : perBeneficiaryAmount + monthlyFee;
      const totalPerContract = fromChain
        ? fromChain.totalRequired
        : calculateRecurringTotal(
            perBeneficiaryAmount,
            params.totalMonths,
            feeBpsFallback,
            params.firstMonthAmount
          );
      setApprovalTotalPerContract(totalPerContract);

      // Étape 1: Approuver la Factory
      setStatus('approving_factory');
      setProgressMessage(
        t('create.modal.approvingFactoryForCreation', {
          defaultValue: 'Approving {{token}} for creation...',
          token: tokenData.symbol,
        })
      );

      console.log('💳 [BATCH RECURRING] Étape 1: Approbation Factory...', {
        totalPerMonth: totalPerMonth.toString(),
        totalPerContract: totalPerContract.toString(),
      });

      approvalFactoryHook.approve(totalPerMonth, params.tokenSymbol, tokenData.address as `0x${string}`);

    } catch (err) {
      console.error('Erreur createBatchRecurringPayment:', err);
      const friendlyMessage = getFriendlyCreateErrorMessage(err as Error, t);
      setError(new Error(friendlyMessage));
      setStatus('error');
      setProgressMessage(friendlyMessage);
    }
  };

  // Effect: Après approbation Factory → Créer les contrats
  useEffect(() => {
    const createAfterApproveFactory = async () => {
      if (status === 'approving_factory' && approvalFactoryHook.isApproveSuccess && currentParams && !createTxHash) {
        try {
          console.log('✅ [BATCH RECURRING] Factory approuvée ! Étape 2: Création des contrats...');

          const tokenData = getToken(currentParams.tokenSymbol);
          if (!tokenData.address || tokenData.address === 'NATIVE' || isZeroAddress(tokenData.address)) {
            throw new Error('Token address manquante');
          }

          setStatus('creating');
          setProgressMessage(
            t('create.modal.creatingRecurringBatchCount', {
              defaultValue: 'Creating {{count}} recurring payments...',
              count: currentParams.beneficiaries.length,
            })
          );

          // Préparer les arrays pour le batch
          const payees: `0x${string}`[] = [];
          const monthlyAmounts: bigint[] = [];
          const firstMonthAmounts: bigint[] = [];

          for (const beneficiary of currentParams.beneficiaries) {
            payees.push(beneficiary.address as `0x${string}`);
            const amount = BigInt(Math.floor(parseFloat(beneficiary.amount) * 10 ** tokenData.decimals));
            monthlyAmounts.push(amount);
            // ✅ FIX: Ajouter le montant du premier mois pour chaque destinataire
            firstMonthAmounts.push(currentParams.firstMonthAmount || 0n);
          }

          // ✅ Utiliser V2 si firstMonthAmount est défini
          const useV2 = currentParams.firstMonthAmount && currentParams.firstMonthAmount > 0n;

          console.log('📋 [BATCH RECURRING] Arguments création:', {
            tokenAddress: tokenData.address,
            payees,
            monthlyAmounts: monthlyAmounts.map(a => a.toString()),
            firstMonthAmounts: useV2 ? firstMonthAmounts.map(a => a.toString()) : 'N/A',
            firstPaymentTime: currentParams.firstPaymentTime,
            totalMonths: currentParams.totalMonths,
            dayOfMonth: currentParams.dayOfMonth,
            useV2,
          });

          writeContract({
            abi: paymentFactoryAbi,
            address: factoryAddress,
            functionName: useV2 ? 'createBatchRecurringPaymentERC20_V2' : 'createBatchRecurringPaymentERC20',
            args: useV2
              ? [
                  tokenData.address as `0x${string}`,
                  payees,
                  monthlyAmounts,
                  firstMonthAmounts,
                  BigInt(currentParams.firstPaymentTime),
                  BigInt(currentParams.totalMonths),
                  BigInt(currentParams.dayOfMonth),
                ]
              : [
                  tokenData.address as `0x${string}`,
                  payees,
                  monthlyAmounts,
                  BigInt(currentParams.firstPaymentTime),
                  BigInt(currentParams.totalMonths),
                  BigInt(currentParams.dayOfMonth),
                ],
          });

          console.log('📤 [BATCH RECURRING] writeContract appelé');
        } catch (err) {
          console.error('❌ [BATCH RECURRING] Erreur création:', err);
          const friendlyMessage = getFriendlyCreateErrorMessage(err as Error, t);
          setError(new Error(friendlyMessage));
          setStatus('error');
          setProgressMessage(friendlyMessage);
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
      setProgressMessage(t('create.modal.confirmingCreation', { defaultValue: 'Confirming creation...' }));
    }
  }, [isConfirming, status]);

  // Effect: Extraction des adresses après confirmation
  useEffect(() => {
    const extractAddresses = async () => {
      if (isConfirmed && createTxHash && publicClient && contractAddresses.length === 0 && (status === 'confirming' || status === 'creating')) {
        try {
          console.log('✅ [BATCH RECURRING] Extraction des adresses...');
          setProgressMessage(t('create.modal.retrievingContractAddress', { defaultValue: 'Retrieving contract addresses...' }));

          const receipt = await publicClient.getTransactionReceipt({ hash: createTxHash });

          const addresses: `0x${string}`[] = [];

          // Parser les events RecurringPaymentCreatedERC20
          const recurringPaymentCreatedEvent = paymentFactoryAbi.find(
            (item) => item.type === 'event' && item.name === 'RecurringPaymentCreatedERC20'
          );

          if (recurringPaymentCreatedEvent) {
            for (const log of receipt.logs) {
              if (log.address.toLowerCase() === factoryAddress.toLowerCase()) {
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
          setProgressMessage(
            t('create.modal.approvingContractStep', {
              defaultValue: 'Approving contract {{current}}/{{total}}...',
              current: 1,
              total: addresses.length,
            })
          );

        } catch (err) {
          console.error('❌ [BATCH RECURRING] Erreur extraction:', err);
          const friendlyMessage = getFriendlyCreateErrorMessage(err as Error, t);
          setError(new Error(friendlyMessage));
          setStatus('error');
          setProgressMessage(friendlyMessage);
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

          const monthlyAmountValue = BigInt(Math.floor(parseFloat(beneficiary.amount) * 10 ** tokenData.decimals));
          const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
          const feeBpsFallback = getProtocolFeeBps({ isInstantPayment: false, isProVerified });

          const fromChain = await fetchRecurringFeeTotalsFromFactory(
            publicClient,
            factoryAddress,
            address,
            monthlyAmountValue,
            currentParams.totalMonths,
            currentParams.firstMonthAmount && currentParams.firstMonthAmount > 0n
              ? currentParams.firstMonthAmount
              : undefined
          );
          const totalRequired = fromChain
            ? fromChain.totalRequired
            : calculateRecurringTotal(
                monthlyAmountValue,
                currentParams.totalMonths,
                feeBpsFallback,
                currentParams.firstMonthAmount
              );

          console.log(`💳 [BATCH RECURRING] Approbation contrat ${currentApprovingIndex + 1}/${contractAddresses.length}...`, {
            contract: contractToApprove,
            amount: totalRequired.toString(),
          });

          setProgressMessage(
            t('create.modal.approvingContractStep', {
              defaultValue: 'Approving contract {{current}}/{{total}}...',
              current: currentApprovingIndex + 1,
              total: contractAddresses.length,
            })
          );
          setApprovalTotalPerContract(totalRequired);
          // ✅ Stocker les montants pour l'affichage du résumé
          setFirstMonthAmount(currentParams.firstMonthAmount && currentParams.firstMonthAmount > 0n && currentParams.firstMonthAmount !== monthlyAmountValue ? currentParams.firstMonthAmount : null);
          setMonthlyAmount(monthlyAmountValue);

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

          setIsApprovalPending(true);
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
              setIsApprovalPending(false);
              setCurrentApprovingIndex(currentApprovingIndex + 1);
            });
          }).catch((err) => {
            setIsApprovalPending(false);
            throw err;
          });

        } catch (err) {
          console.error(`❌ [BATCH RECURRING] Erreur approbation contrat ${currentApprovingIndex + 1}:`, err);
          const friendlyMessage = getFriendlyCreateErrorMessage(err as Error, t);
          setError(new Error(friendlyMessage));
          setStatus('error');
          setProgressMessage(friendlyMessage);
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
          setProgressMessage(t('create.modal.savingToDatabase', { defaultValue: 'Saving to database...' }));

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
                first_month_amount: currentParams.firstMonthAmount && currentParams.firstMonthAmount > 0n && currentParams.firstMonthAmount !== monthlyAmount ? currentParams.firstMonthAmount.toString() : null,
                is_first_month_custom: !!(currentParams.firstMonthAmount && currentParams.firstMonthAmount > 0n && currentParams.firstMonthAmount !== monthlyAmount),
                first_payment_time: currentParams.firstPaymentTime,
                total_months: currentParams.totalMonths,
                day_of_month: currentParams.dayOfMonth,
                cancellable: currentParams.cancellable || false,
                network: getNetworkFromChainId(chainId),
                chain_id: chainId,
                transaction_hash: createTxHash,
                payment_label: currentParams.label || '',
                payment_category: currentParams.category || '',
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
      const friendlyMessage = getFriendlyCreateErrorMessage(writeError as Error, t);
      setError(new Error(friendlyMessage));
      setStatus('error');
      setProgressMessage(friendlyMessage);
    }
    if (confirmError) {
      console.error('❌ [BATCH RECURRING] Erreur confirmation:', confirmError);
      const friendlyMessage = getFriendlyCreateErrorMessage(confirmError as Error, t);
      setError(new Error(friendlyMessage));
      setStatus('error');
      setProgressMessage(friendlyMessage);
    }
    if (approvalFactoryHook.approveError && status === 'approving_factory') {
      console.error('❌ [BATCH RECURRING] Erreur approbation Factory:', approvalFactoryHook.approveError);

      let errorMessage = 'Erreur lors de l\'approbation de la Factory';
      if (approvalFactoryHook.approveError instanceof Error) {
        const errorMsg = approvalFactoryHook.approveError.message.toLowerCase();
        if (errorMsg.includes('user rejected') || errorMsg.includes('user denied') || errorMsg.includes('user cancelled')) {
          errorMessage = t('create.modal.factoryApprovalCancelled', {
            defaultValue: 'Factory approval cancelled by user in MetaMask',
          });
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
    setApprovalTotalPerContract(null);
    setCapturedPayerAddress(undefined);
    setCurrentApprovingIndex(0);
    setIsApprovalPending(false);
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
  // ✅ FIX: currentStep doit refléter le contrat en cours d'approbation, pas le suivant
  // Quand on approuve le contrat à l'index N, on est à l'étape 2 + N + 1
  // Mais on ne doit incrémenter que quand la transaction est confirmée, pas quand elle est envoyée
  if (status === 'approving_contracts') {
    // currentApprovingIndex est l'index du contrat qu'on est en train d'approuver
    // On est donc à l'étape 2 (création) + 1 (premier contrat) + currentApprovingIndex
    currentStep = 2 + currentApprovingIndex + 1;
    // Mais on ne doit pas aller au-delà du total
    if (currentStep > totalSteps) currentStep = totalSteps;
  }
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
    approvalTotalPerContract,
    firstMonthAmount,
    monthlyAmount,
    isAuthenticated,
    needsGuestEmail,
    setGuestEmail,
  };
}
