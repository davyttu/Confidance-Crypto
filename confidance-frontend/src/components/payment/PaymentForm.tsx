'use client';

import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { type TokenSymbol, getToken, getProtocolFeeBps } from '@/config/tokens';
import CurrencySelector from './CurrencySelector';
import DateTimePicker from './DateTimePicker';
import FeeDisplay from './FeeDisplay';
import PaymentProgressModal from './PaymentProgressModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useCreateBatchPayment } from '@/hooks/useCreateBatchPayment';
import { useCreateRecurringPayment } from '@/hooks/useCreateRecurringPayment';
import { useCreateBatchRecurringPayment } from '@/hooks/useCreateBatchRecurringPayment';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentFormData {
  tokenSymbol: TokenSymbol;
  beneficiary: string;
  amount: string;
  releaseDate: Date | null;
}

type PaymentTiming = 'instant' | 'scheduled' | 'recurring';

interface BeneficiaryHistoryItem {
  address: string;
  name?: string;
}

export default function PaymentForm() {
  const { t, ready: translationsReady, i18n } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const walletConnected = Boolean(address);
  const { user } = useAuth();
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const translate = (
    key: string,
    defaultValue: string,
    options?: Record<string, string | number>
  ) => (translationsReady ? t(key, { defaultValue, ...(options || {}) }) : defaultValue);

  const locale = (() => {
    const language = i18n?.language?.toLowerCase() || 'en';
    const base = language.split('-')[0];
    switch (base) {
      case 'fr':
        return 'fr-FR';
      case 'es':
        return 'es-ES';
      case 'ru':
        return 'ru-RU';
      case 'zh':
        return 'zh-CN';
      default:
        return 'en-US';
    }
  })();

  const handleReconnectWallet = () => {
    disconnect();
    if (openConnectModal) {
      setTimeout(() => openConnectModal(), 50);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setCancellable(true);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('beneficiaryHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return { address: item };
              }
              if (item && typeof item === 'object' && typeof item.address === 'string') {
                return { address: item.address, name: item.name };
              }
              return null;
            })
            .filter((item): item is BeneficiaryHistoryItem => Boolean(item));
          setBeneficiaryHistory(normalized);
        }
      }
      const storedFavorites = localStorage.getItem('beneficiaryFavorites');
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (Array.isArray(parsedFavorites)) {
          setFavoriteAddresses(parsedFavorites.filter((item) => typeof item === 'string'));
        }
      }
    } catch (error) {
      console.error('Error loading beneficiary history:', error);
    }
  }, []);

  // Hooks de création
  const singlePayment = useCreatePayment();
  const batchPayment = useCreateBatchPayment();
  const recurringPayment = useCreateRecurringPayment();
  const batchRecurringPayment = useCreateBatchRecurringPayment();

  // État: paiement simple ou batch?
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [additionalBeneficiaries, setAdditionalBeneficiaries] = useState<string[]>([]);

  // État du formulaire
  const [formData, setFormData] = useState<PaymentFormData>({
    tokenSymbol: 'USDC',
    beneficiary: '',
    amount: '',
    releaseDate: null,
  });

  // État: paiement récurrent
  const [isRecurringMode, setIsRecurringMode] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState<number>(1);

  // État: type de paiement (instant / programmé / récurrent)
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>('instant');

  // ⭐ Option: première mensualité différente
  const [isFirstMonthDifferent, setIsFirstMonthDifferent] = useState(false);
  const [firstMonthAmountInput, setFirstMonthAmountInput] = useState<string>('');

  // État: type de paiement (annulable ou définitif)
  const [cancellable, setCancellable] = useState(true);

  const [beneficiaryHistory, setBeneficiaryHistory] = useState<BeneficiaryHistoryItem[]>([]);
  const [favoriteAddresses, setFavoriteAddresses] = useState<string[]>([]);
  const [showBeneficiaryHistory, setShowBeneficiaryHistory] = useState(false);

  // Erreurs de validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Balance du token sélectionné
  const { balance, formatted: balanceFormatted } = useTokenBalance(
    formData.tokenSymbol
  );

  // Vérifier si la mensualisation est disponible
  const isRecurringAvailable = formData.tokenSymbol === 'USDT' || formData.tokenSymbol === 'USDC';
  
  // Vérifier si les paiements batch sont disponibles (ETH, USDC, USDT)
  const isBatchAvailable = formData.tokenSymbol === 'ETH' || formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT';

  const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
  const recurringFeeBps = getProtocolFeeBps({ isInstantPayment: false, isProVerified });
  const recurringFeeRate = recurringFeeBps / 10000;
  const recurringAmountValue = Number.isFinite(parseFloat(formData.amount)) ? parseFloat(formData.amount) : 0;
  const recurringMonthlyFee = recurringAmountValue * recurringFeeRate;
  const recurringTotalPerMonth = recurringAmountValue + recurringMonthlyFee;
  const recurringTotalToApprove = recurringTotalPerMonth * recurringMonths;
  const [hasSyncedPro, setHasSyncedPro] = useState(false);

  useEffect(() => {
    if (!user?.id || !address || hasSyncedPro) return;
    if (user.proStatus !== 'verified' && user.accountType !== 'professional') return;

    const syncPro = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/pro/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            wallet: address,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.allowlist?.ok) {
            setHasSyncedPro(true);
          }
        }
      } catch (error) {
        console.error('Erreur sync PRO:', error);
      }
    };

    syncPro();
  }, [user?.id, user?.proStatus, user?.accountType, address, API_BASE_URL, hasSyncedPro]);

  // Restaurer les données au retour de /create-batch
  useEffect(() => {
    const storedFormData = localStorage.getItem('paymentFormData');
    if (storedFormData) {
      try {
        const data = JSON.parse(storedFormData);
        setFormData({
          tokenSymbol: data.tokenSymbol || 'ETH',
          beneficiary: data.beneficiary || '',
          amount: data.amount || '',
          releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        });
        localStorage.removeItem('paymentFormData');
      } catch (error) {
        console.error('Erreur restauration formData:', error);
      }
    }

    const storedBeneficiaries = localStorage.getItem('additionalBeneficiaries');
    if (storedBeneficiaries) {
      try {
        const addresses = JSON.parse(storedBeneficiaries);
        if (Array.isArray(addresses) && addresses.length > 0) {
          setAdditionalBeneficiaries(addresses);
          setIsBatchMode(true);
        }
        localStorage.removeItem('additionalBeneficiaries');
      } catch (error) {
        console.error('Erreur parsing additionalBeneficiaries:', error);
      }
    }
  }, []);

  // Validation adresse Ethereum
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Validation montant
  const validateAmount = (amount: string): string | null => {
    if (!amount || amount === '0') {
      return translate('create.validation.amountRequired', 'Enter an amount');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return translate('create.validation.amountInvalid', 'Invalid amount');
    }

    if (balance) {
      const decimals = formData.tokenSymbol === 'ETH' ? 18 : 
                       formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT' ? 6 : 8;
      const totalBeneficiaries = isBatchMode ? additionalBeneficiaries.length + 1 : 1;
      const totalAmount = amountNum * totalBeneficiaries;
      const amountBigInt = BigInt(Math.floor(totalAmount * 10 ** decimals));
      
      if (amountBigInt > balance) {
        return translate('create.validation.insufficientBalance', 'Insufficient balance');
      }
    }

    return null;
  };

  // Validation date
  const validateDate = (date: Date | null): string | null => {
    if (!date) {
      return translate('create.validation.dateRequired', 'Choose a date');
    }

    const now = new Date();
    const diffInSeconds = (date.getTime() - now.getTime()) / 1000;
    
    // Vérifier si la date est dans le passé
    if (diffInSeconds < 0) {
      return translate(
        'create.validation.datePast',
        'This date is in the past. Please choose a future date.'
      );
    }
    
    // Si c'est un paiement instantané (moins d'1 minute), on ne valide pas
    if (diffInSeconds < 60) {
      return null; // Paiement instantané, pas d'erreur
    }

    const minDate = new Date(now.getTime() + 10 * 60 * 1000);

    if (date < minDate) {
      return translate(
        'create.validation.dateMin',
        'The date must be at least 10 minutes in the future'
      );
    }

    return null;
  };

  const handlePaymentTimingChange = (nextTiming: PaymentTiming) => {
    if (nextTiming === 'recurring' && !isRecurringAvailable) {
      return;
    }

    setPaymentTiming(nextTiming);

    if (nextTiming === 'recurring') {
      setIsRecurringMode(true);
      return;
    }

    if (isRecurringMode) {
      setIsRecurringMode(false);
      setIsFirstMonthDifferent(false);
      setFirstMonthAmountInput('');
    }

    if (nextTiming === 'instant') {
      const date = new Date();
      date.setSeconds(date.getSeconds() + 30);
      handleDateChange(date);
    }

    if (nextTiming === 'scheduled') {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 20);
      date.setSeconds(0, 0);
      handleDateChange(date);
    }
  };

  useEffect(() => {
    if (paymentTiming === 'recurring' && !isRecurringMode) {
      setIsRecurringMode(true);
    }
    if (paymentTiming !== 'recurring' && isRecurringMode) {
      setIsRecurringMode(false);
      setIsFirstMonthDifferent(false);
      setFirstMonthAmountInput('');
    }
  }, [paymentTiming, isRecurringMode]);

  useEffect(() => {
    if (paymentTiming === 'instant' && !formData.releaseDate) {
      const date = new Date();
      date.setSeconds(date.getSeconds() + 30);
      setFormData((prev) => ({ ...prev, releaseDate: date }));
    }
  }, [paymentTiming, formData.releaseDate]);

  useEffect(() => {
    if (paymentTiming === 'scheduled' && !formData.releaseDate) {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 20);
      date.setSeconds(0, 0);
      setFormData((prev) => ({ ...prev, releaseDate: date }));
    }
  }, [paymentTiming, formData.releaseDate]);

  // Handler changement token
  const handleTokenChange = (token: TokenSymbol) => {
    setFormData((prev) => ({ ...prev, tokenSymbol: token }));
    setErrors((prev) => ({ ...prev, amount: '' }));
    
    // Désactiver la mensualisation si on passe à ETH
    if (token === 'ETH' && isRecurringMode) {
      setIsRecurringMode(false);
      setPaymentTiming('scheduled');
      setIsFirstMonthDifferent(false);
      setFirstMonthAmountInput('');
    }
  };

  // Handler changement bénéficiaire
  const handleBeneficiaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, beneficiary: value }));

    if (value && !isValidAddress(value)) {
      setErrors((prev) => ({
        ...prev,
        beneficiary: translate('create.validation.invalidAddress', 'Invalid address')
      }));
    } else {
      setErrors((prev) => ({ ...prev, beneficiary: '' }));
    }
  };

  const updateBeneficiaryHistory = (address: string) => {
    const normalized = address.trim();
    if (!normalized) return;
    setBeneficiaryHistory((prev) => {
      const existing = prev.find(
        (item) => item.address.toLowerCase() === normalized.toLowerCase()
      );
      const next = [
        { address: normalized, name: existing?.name },
        ...prev.filter((item) => item.address.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, 5);
      localStorage.setItem('beneficiaryHistory', JSON.stringify(next));
      return next;
    });
  };

  const persistFavorites = (next: string[]) => {
    setFavoriteAddresses(next);
    localStorage.setItem('beneficiaryFavorites', JSON.stringify(next));
  };

  const toggleFavorite = (address: string) => {
    const normalized = address.toLowerCase();
    if (favoriteAddresses.some((item) => item.toLowerCase() === normalized)) {
      persistFavorites(favoriteAddresses.filter((item) => item.toLowerCase() !== normalized));
    } else {
      persistFavorites([address, ...favoriteAddresses]);
    }
  };

  const handleSelectBeneficiary = (address: string) => {
    setFormData((prev) => ({ ...prev, beneficiary: address }));
    setErrors((prev) => ({ ...prev, beneficiary: '' }));
    setShowBeneficiaryHistory(false);
  };

  // Handler changement montant
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, amount: value }));

    const error = validateAmount(value);
    setErrors((prev) => ({ ...prev, amount: error || '' }));
  };

  // Handler changement date
  const handleDateChange = (date: Date) => {
    setFormData((prev) => ({ ...prev, releaseDate: date }));

    const error = validateDate(date);
    setErrors((prev) => ({ ...prev, date: error || '' }));
  };

  // Calculer le montant en BigInt
  const getAmountBigInt = (): bigint | null => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) return null;

    const decimals = formData.tokenSymbol === 'ETH' ? 18 : 
                     formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT' ? 6 : 8;
    
    try {
      return BigInt(Math.floor(parseFloat(formData.amount) * 10 ** decimals));
    } catch {
      return null;
    }
  };

  // Handler redirection vers /create-batch
  const handleAddMultipleBeneficiaries = () => {
    localStorage.setItem('paymentFormData', JSON.stringify({
      tokenSymbol: formData.tokenSymbol,
      beneficiary: formData.beneficiary,
      amount: formData.amount,
      releaseDate: formData.releaseDate?.toISOString(),
    }));

    router.push('/create-batch');
  };

  // Handler suppression d'un bénéficiaire additionnel
  const handleRemoveBeneficiary = (index: number) => {
    const updated = additionalBeneficiaries.filter((_, i) => i !== index);
    setAdditionalBeneficiaries(updated);
    if (updated.length === 0) {
      setIsBatchMode(false);
    }
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🎯🎯🎯 [FORM SUBMIT] handleSubmit appelé');
    console.log('📋 [FORM SUBMIT] formData:', formData);
    console.log('📋 [FORM SUBMIT] isConnected:', isConnected);
    console.log('📋 [FORM SUBMIT] address:', address);

    // Validation complète
    const newErrors: Record<string, string> = {};

    if (!isValidAddress(formData.beneficiary)) {
      newErrors.beneficiary = translate('create.validation.invalidAddress', 'Invalid address');
    }

    const amountError = validateAmount(formData.amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    const dateError = validateDate(formData.releaseDate);
    if (dateError) {
      newErrors.date = dateError;
    }

    // ⭐ Validation: première mensualité différente (uniquement si mensualisation)
    if (isRecurringMode && isFirstMonthDifferent) {
      if (!firstMonthAmountInput || firstMonthAmountInput === '0') {
        newErrors.firstMonthAmount = translate(
          'create.validation.firstMonthRequired',
          'Enter an amount for the first monthly payment'
        );
      } else {
        const firstNum = parseFloat(firstMonthAmountInput);
        const monthlyNum = parseFloat(formData.amount);
        if (isNaN(firstNum) || firstNum <= 0) {
          newErrors.firstMonthAmount = translate(
            'create.validation.firstMonthInvalid',
            'Invalid amount'
          );
        }
        // Si identique au montant mensuel, on n'a pas besoin d'une première mensualité personnalisée
        if (!isNaN(firstNum) && !isNaN(monthlyNum) && firstNum === monthlyNum) {
          // Pas d'erreur, mais le paramètre sera ignoré
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      console.log('❌ [FORM SUBMIT] Erreurs de validation:', newErrors);
      setErrors(newErrors);
      return;
    }

    console.log('✅ [FORM SUBMIT] Validation passée, préparation des données...');

    if (isValidAddress(formData.beneficiary)) {
      updateBeneficiaryHistory(formData.beneficiary);
    }

    const token = getToken(formData.tokenSymbol);
    const amountBigInt = BigInt(
      Math.floor(parseFloat(formData.amount) * 10 ** token.decimals)
    );

    // ⭐ Calcul optionnel: première mensualité personnalisée
    const firstMonthAmountBigInt = (() => {
      if (!isRecurringMode || !isFirstMonthDifferent) return undefined;
      const firstNum = parseFloat(firstMonthAmountInput);
      const monthlyNum = parseFloat(formData.amount);
      if (!firstMonthAmountInput || isNaN(firstNum) || firstNum <= 0) return undefined;
      // Si identique au montant mensuel, on ignore l'option
      if (!isNaN(monthlyNum) && firstNum === monthlyNum) return undefined;
      return BigInt(Math.floor(firstNum * 10 ** token.decimals));
    })();

    const releaseTime = Math.floor(formData.releaseDate!.getTime() / 1000);

    console.log('📋 [FORM SUBMIT] Données préparées:', {
      tokenSymbol: formData.tokenSymbol,
      beneficiary: formData.beneficiary,
      amountBigInt: amountBigInt.toString(),
      releaseTime,
      releaseDate: new Date(releaseTime * 1000).toISOString(),
      cancellable,
      isRecurringMode,
      isBatchMode,
    });

    try {
      if (isRecurringMode && isBatchMode && additionalBeneficiaries.length > 0) {
        // ✅ NOUVEAU : Paiement récurrent BATCH (plusieurs bénéficiaires)
        console.log('📋 [FORM SUBMIT] Mode: Batch Recurring Payment');

        const dayOfMonth = formData.releaseDate!.getDate();
        const allBeneficiaries = [
          { address: formData.beneficiary, amount: formData.amount },
          ...additionalBeneficiaries.map(addr => ({ address: addr, amount: formData.amount }))
        ];

        await batchRecurringPayment.createBatchRecurringPayment({
          tokenSymbol: formData.tokenSymbol as 'USDC' | 'USDT',
          beneficiaries: allBeneficiaries,
          firstMonthAmount: firstMonthAmountBigInt,
          firstPaymentTime: releaseTime,
          totalMonths: recurringMonths,
          dayOfMonth: dayOfMonth,
          cancellable,
        });
      } else if (isRecurringMode) {
        // ✅ Paiement récurrent SINGLE
        console.log('📋 [FORM SUBMIT] Mode: Single Recurring Payment');

        const dayOfMonth = formData.releaseDate!.getDate(); // Retourne 1-31

        await recurringPayment.createRecurringPayment({
          tokenSymbol: formData.tokenSymbol as 'USDC' | 'USDT',
          beneficiary: formData.beneficiary as `0x${string}`,
          monthlyAmount: amountBigInt,
          firstMonthAmount: firstMonthAmountBigInt, // ⭐ optionnel
          firstPaymentTime: releaseTime,
          totalMonths: recurringMonths,
          dayOfMonth: dayOfMonth, // ✅ AJOUTÉ - Jour extrait automatiquement du calendrier
          cancellable,
        });
      } else if (isBatchMode && additionalBeneficiaries.length > 0) {
        const allBeneficiaries = [
          { address: formData.beneficiary, amount: formData.amount },
          ...additionalBeneficiaries.map(addr => ({ address: addr, amount: formData.amount }))
        ];

        await batchPayment.createBatchPayment({
          beneficiaries: allBeneficiaries,
          releaseTime,
          cancellable,
          tokenSymbol: formData.tokenSymbol, // ✅ Ajouter le token symbol
        });
      } else {
        console.log('📤 [FORM SUBMIT] Appel singlePayment.createPayment()...');
        console.log('📋 [FORM SUBMIT] Paramètres:', {
          tokenSymbol: formData.tokenSymbol,
          beneficiary: formData.beneficiary,
          amount: amountBigInt.toString(),
          releaseTime,
          cancellable,
        });
        await singlePayment.createPayment({
          tokenSymbol: formData.tokenSymbol,
          beneficiary: formData.beneficiary as `0x${string}`,
          amount: amountBigInt,
          releaseTime,
          cancellable,
        });
        console.log('✅ [FORM SUBMIT] singlePayment.createPayment() appelé');
      }
    } catch (err) {
      console.error('❌ [FORM SUBMIT] Erreur lors de la création:', err);
      console.error('❌ [FORM SUBMIT] Stack:', (err as Error)?.stack);
    }
  };

  // Handler fermeture modal
  const handleCloseModal = () => {
    if (isRecurringMode && isBatchMode) {
      batchRecurringPayment.reset();
    } else if (isRecurringMode) {
      recurringPayment.reset();
    } else if (isBatchMode) {
      batchPayment.reset();
    } else {
      singlePayment.reset();
    }
  };

  // Handler voir le paiement
  const handleViewPayment = () => {
    // Pour batch recurring, on redirige vers le dashboard (plusieurs contrats)
    if (isRecurringMode && isBatchMode) {
      router.push('/dashboard');
      return;
    }

    const contractAddr = isRecurringMode
      ? recurringPayment.contractAddress
      : isBatchMode
      ? batchPayment.contractAddress
      : singlePayment.contractAddress;
    if (contractAddr) {
      router.push(`/payment/${contractAddr}`);
    }
  };

  const activePayment = (isRecurringMode && isBatchMode)
    ? batchRecurringPayment
    : isRecurringMode
    ? recurringPayment
    : isBatchMode
    ? batchPayment
    : singlePayment;

  const beneficiaryQuery = formData.beneficiary.trim().toLowerCase();
  const favorites = favoriteAddresses
    .map((fav) => {
      const item = beneficiaryHistory.find(
        (entry) => entry.address.toLowerCase() === fav.toLowerCase()
      );
      return item || { address: fav };
    })
    .filter((item) => {
      if (!beneficiaryQuery) return true;
      return (
        item.address.toLowerCase().includes(beneficiaryQuery) ||
        (item.name ? item.name.toLowerCase().includes(beneficiaryQuery) : false)
      );
    });

  const filteredBeneficiaryHistory = beneficiaryHistory
    .filter((item) => {
      if (!beneficiaryQuery) return true;
      return (
        item.address.toLowerCase().includes(beneficiaryQuery) ||
        (item.name ? item.name.toLowerCase().includes(beneficiaryQuery) : false)
      );
    })
    .filter(
      (item) =>
        !favoriteAddresses.some(
          (fav) => fav.toLowerCase() === item.address.toLowerCase()
        )
    )
    .slice(0, 5);

  if (!walletConnected) {
    return (
      <div className="text-center p-12 glass rounded-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {isMounted && translationsReady ? t('common.connectWallet') : 'Connectez votre wallet'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {isMounted && translationsReady ? t('create.wallet.connectFirst') : 'To create a scheduled payment, first connect your wallet'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => openConnectModal?.()}
            type="button"
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            {isMounted && translationsReady ? t('common.connectWallet', { defaultValue: 'Connect Wallet' }) : 'Connect Wallet'}
          </button>
          <button
            onClick={handleReconnectWallet}
            type="button"
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
          >
            {isMounted && translationsReady ? t('common.resetWallet', { defaultValue: 'Reset wallet connection' }) : 'Reset wallet connection'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1 : Choix de la crypto */}
      <div className="glass rounded-2xl p-6">
        <CurrencySelector
          selectedToken={formData.tokenSymbol}
          onSelectToken={handleTokenChange}
        />
        
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {isMounted && translationsReady ? t('create.summary.balance') : 'Available balance'} : <span className="font-medium">{balanceFormatted}</span>
        </div>
      </div>

      {/* Section 2 : Bénéficiaire(s) */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady ? t('create.beneficiary.address') : 'Beneficiary address'}
        </label>
        <div className="relative">
          <input
            type="text"
            value={formData.beneficiary}
            onChange={handleBeneficiaryChange}
            onFocus={() => setShowBeneficiaryHistory(true)}
            onBlur={() => setTimeout(() => setShowBeneficiaryHistory(false), 120)}
            placeholder="0x..."
            className={`
              w-full px-4 py-3 rounded-xl border-2 
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-white
              transition-all
              ${
                errors.beneficiary
                  ? 'border-red-500 focus:border-red-600'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
              }
              focus:outline-none focus:ring-4 focus:ring-primary-500/20
            `}
          />

          <div
            className={`
              mt-2 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700
              bg-white/90 dark:bg-gray-900/90 backdrop-blur
              shadow-sm transition-all duration-200
              ${showBeneficiaryHistory ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
            `}
          >
            <div className="max-h-52 overflow-auto">
              {favorites.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {translate('create.beneficiary.favoritesTitle', 'Favorites')}
                  </div>
                  {favorites.map((item) => {
                    const isFavorite = favoriteAddresses.some(
                      (fav) => fav.toLowerCase() === item.address.toLowerCase()
                    );
                    return (
                      <div
                        key={`fav-${item.address}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectBeneficiary(item.address)}
                          className="flex-1 text-left"
                        >
                          <div className="flex flex-col">
                            {item.name && (
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {item.name}
                              </span>
                            )}
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              {item.address}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => toggleFavorite(item.address)}
                          className="p-1 rounded-full hover:bg-yellow-100/60 dark:hover:bg-yellow-500/10"
                          title={translate('create.beneficiary.toggleFavorite', 'Toggle favorite')}
                        >
                          <svg
                            className={`w-4 h-4 ${
                              isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'
                            }`}
                            viewBox="0 0 24 24"
                            fill={isFavorite ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 17.3l-6.18 3.24 1.18-6.88L1 8.96l6.91-1 3.09-6.26 3.09 6.26 6.91 1-5 4.7 1.18 6.88L12 17.3z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}

              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {translate('create.beneficiary.recentTitle', 'Recent addresses')}
              </div>
              {filteredBeneficiaryHistory.length > 0 ? (
                filteredBeneficiaryHistory.map((item) => {
                  const isFavorite = favoriteAddresses.some(
                    (fav) => fav.toLowerCase() === item.address.toLowerCase()
                  );
                  return (
                    <div
                      key={item.address}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectBeneficiary(item.address)}
                        className="flex-1 text-left"
                      >
                        <div className="flex flex-col">
                          {item.name && (
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                              {item.name}
                            </span>
                          )}
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {item.address}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggleFavorite(item.address)}
                        className="p-1 rounded-full hover:bg-yellow-100/60 dark:hover:bg-yellow-500/10"
                        title={translate('create.beneficiary.toggleFavorite', 'Toggle favorite')}
                      >
                        <svg
                          className={`w-4 h-4 ${
                            isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'
                          }`}
                          viewBox="0 0 24 24"
                          fill={isFavorite ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 17.3l-6.18 3.24 1.18-6.88L1 8.96l6.91-1 3.09-6.26 3.09 6.26 6.91 1-5 4.7 1.18 6.88L12 17.3z" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {translate('create.beneficiary.recentEmpty', 'No recent addresses')}
                </div>
              )}
            </div>
          </div>
        </div>
        {errors.beneficiary && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.beneficiary}
          </p>
        )}
        
        {isBatchMode && additionalBeneficiaries.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              👥 {isMounted && translationsReady
                ? t('create.beneficiary.additional')
                : 'Additional beneficiaries'} ({additionalBeneficiaries.length})
            </h4>
            <div className="space-y-2">
              {additionalBeneficiaries.map((addr, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-mono">
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBeneficiary(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕ {isMounted && translationsReady ? t('create.beneficiary.remove') : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!isBatchMode && (
          <div className="relative group">
            <button
              type="button"
              onClick={handleAddMultipleBeneficiaries}
              disabled={!isBatchAvailable}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed font-medium transition-all duration-200
                ${isBatchAvailable
                  ? 'border-primary-300 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-950/20 hover:bg-primary-100 dark:hover:bg-primary-950/40 hover:border-primary-400 dark:hover:border-primary-500 text-primary-700 dark:text-primary-300 cursor-pointer'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 opacity-60 cursor-not-allowed'
                }
              `}
            >
              <svg 
                className={`w-5 h-5 ${isBatchAvailable ? 'transition-transform group-hover:scale-110 group-hover:rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm">{isMounted && translationsReady ? t('create.beneficiary.addMultiple') : 'Add multiple beneficiaries'}</span>
              {isBatchAvailable && (
                <svg 
                  className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
            
          </div>
        )}
      </div>

      {/* Section 3 : Montant */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady ? t('create.amount.label') : 'Amount'} {isBatchMode && (isMounted && translationsReady ? t('create.amount.perBeneficiary') : '(per beneficiary)')} {isRecurringMode && (isMounted && translationsReady ? t('create.amount.monthly') : '(monthly)')}
        </label>
        <div className="relative">
          <input
            type="number"
            step="any"
            value={formData.amount}
            onChange={handleAmountChange}
            onWheel={(event) => (event.currentTarget as HTMLInputElement).blur()}
            placeholder="0.0"
            className={`
              w-full px-4 py-3 pr-20 rounded-xl border-2 
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-white
              text-lg font-medium
              transition-all
              ${
                errors.amount
                  ? 'border-red-500 focus:border-red-600'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
              }
              focus:outline-none focus:ring-4 focus:ring-primary-500/20
            `}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
            {formData.tokenSymbol}
          </div>
        </div>
        {errors.amount && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.amount}
          </p>
        )}
        
        {isBatchMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isMounted && translationsReady ? t('create.amount.total') : 'Total'} : <span className="font-semibold">
              {(parseFloat(formData.amount) * (additionalBeneficiaries.length + 1)).toFixed(4)} {formData.tokenSymbol}
            </span>
            {' '}{isMounted && translationsReady ? t('create.amount.forBeneficiaries', { count: additionalBeneficiaries.length + 1 }) : `for ${additionalBeneficiaries.length + 1} beneficiaries`}
          </div>
        )}

        {isRecurringMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {translate('create.amount.totalMonths', 'Total over {{months}} months', {
              months: recurringMonths
            })}{' '}
            <span className="font-semibold">
              {(parseFloat(formData.amount) * recurringMonths).toFixed(4)} {formData.tokenSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Section 4 : Timing */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady
            ? t('create.date.paymentTypeLabel', { defaultValue: 'Payment type' })
            : 'Payment type'}
        </label>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handlePaymentTimingChange('instant')}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              paymentTiming === 'instant'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300'
            }`}
          >
            <span className="text-lg">⚡</span>
            {isMounted && translationsReady ? t('links.types.instant', { defaultValue: 'Instant' }) : 'Instant'}
          </button>

          <button
            type="button"
            onClick={() => handlePaymentTimingChange('scheduled')}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              paymentTiming === 'scheduled'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300'
            }`}
          >
            <span className="text-lg">🗓️</span>
            {isMounted && translationsReady ? t('links.types.scheduled', { defaultValue: 'Scheduled' }) : 'Scheduled'}
          </button>

          <div className="relative group">
            <button
              type="button"
              onClick={() => handlePaymentTimingChange('recurring')}
              disabled={!isRecurringAvailable}
              className={`w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                paymentTiming === 'recurring'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : isRecurringAvailable
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="text-lg">🔄</span>
              {isMounted && translationsReady ? t('links.types.recurring', { defaultValue: 'Recurring' }) : 'Recurring'}
            </button>

            {!isRecurringAvailable && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {isMounted && translationsReady ? t('create.date.recurringTooltip') : '⚠️ Feature only available for USDT/USDC'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>

        {paymentTiming !== 'instant' && (
          <>
            {/* Sélecteur nombre de mois si mensualisation active */}
            {isRecurringMode && (
              <>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl space-y-3 mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isMounted && translationsReady ? t('create.date.monthsLabel') : 'Number of monthly payments'}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => setRecurringMonths(month)}
                      className={`
                        py-2 rounded-lg text-sm font-medium transition-all
                        ${recurringMonths === month
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900'
                        }
                      `}
                    >
                      {month}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isMounted && translationsReady
                    ? t('create.date.monthsInfo', { months: recurringMonths })
                    : `💡 The amount will be debited each month for ${recurringMonths} months. Your treasury remains available.`}
                </p>
              </div>

              {/* ⭐ Option: première mensualité différente */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl space-y-3 mb-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {isMounted && translationsReady ? t('create.firstMonth.title') : 'First monthly payment'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isMounted && translationsReady
                        ? t('create.firstMonth.description')
                        : 'By default, it is the same as the following months. Useful for a different first rent or upfront fees.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirstMonthDifferent(false);
                        setFirstMonthAmountInput('');
                        setErrors((prev) => ({ ...prev, firstMonthAmount: '' }));
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        !isFirstMonthDifferent
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                      }`}
                    >
                      {isMounted && translationsReady ? t('create.firstMonth.same') : 'Same'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirstMonthDifferent(true);
                        setFirstMonthAmountInput(formData.amount || '');
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        isFirstMonthDifferent
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                      }`}
                    >
                      {isMounted && translationsReady ? t('create.firstMonth.custom') : 'Custom'}
                    </button>
                  </div>
                </div>

                {isFirstMonthDifferent && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {isMounted && translationsReady ? t('create.firstMonth.amountLabel') : 'First monthly amount'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={firstMonthAmountInput}
                        onChange={(e) => {
                          setFirstMonthAmountInput(e.target.value);
                          setErrors((prev) => ({ ...prev, firstMonthAmount: '' }));
                        }}
                        placeholder="0.0"
                        className={`w-full px-4 py-3 pr-20 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-medium transition-all ${
                          errors.firstMonthAmount
                            ? 'border-red-500 focus:border-red-600'
                            : 'border-indigo-200 dark:border-indigo-800 focus:border-indigo-500'
                        } focus:outline-none focus:ring-4 focus:ring-indigo-500/20`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        {formData.tokenSymbol}
                      </div>
                    </div>
                    {errors.firstMonthAmount && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {errors.firstMonthAmount}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isMounted && translationsReady
                        ? t('create.firstMonth.info')
                        : '💡 If you enter the same amount as the monthly payment, this option will be ignored automatically.'}
                    </p>
                  </div>
                )}
              </div>
              </>
            )}

            <DateTimePicker
              value={formData.releaseDate}
              onChange={handleDateChange}
              error={errors.date}
              label=""
              hidePresets={true}
              disabled={paymentTiming === 'instant'}
            />

            {/* Info jour du mois si mensualisation */}
            {isRecurringMode && formData.releaseDate && (
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">📅</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {isMounted && translationsReady
                      ? t('create.date.dayOfMonth', { day: formData.releaseDate.getDate() })
                      : `Debits will occur on the ${formData.releaseDate.getDate()} of each month`}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 4.5 : Type de paiement */}
      <div className="glass rounded-2xl p-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {isMounted && translationsReady ? t('create.paymentType.label') : '🔒 Payment type'}
          </label>
          
          {/* ✅ Message si paiement instantané */}
          {formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <span className="text-lg">⚡</span>
                <span className="font-medium">
                  {translate('create.paymentType.instantDetected', 'Instant payment detected')}
                </span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 ml-7">
                {translate(
                  'create.paymentType.instantDisabled',
                  'Cancellation options are disabled because the payment will be executed immediately.'
                )}
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            {/* ✅ Option Annulable - grisée si instantané */}
            <label
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                  : cancellable
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 cursor-pointer'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="paymentType"
                checked={cancellable}
                onChange={() => setCancellable(true)}
                disabled={formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60}
                className="mt-1 w-5 h-5 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔓</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.paymentType.cancellable.title') : 'Cancellable (before the date)'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isMounted && translationsReady
                    ? t('create.paymentType.cancellable.description')
                    : 'You will be able to cancel before the release date and recover the amount + protocol fees'}
                </p>
              </div>
            </label>

            {/* ✅ Option Définitif - grisée si instantané */}
            <label
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                  : !cancellable
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 cursor-pointer'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="paymentType"
                checked={!cancellable}
                onChange={() => setCancellable(false)}
                disabled={formData.releaseDate && (formData.releaseDate.getTime() - Date.now()) / 1000 < 60}
                className="mt-1 w-5 h-5 text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔒</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.paymentType.definitive.title') : 'Definitive (non-cancellable)'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isMounted && translationsReady ? t('create.paymentType.definitive.description') : 'Once created, impossible to cancel. Funds will be automatically released on the chosen date'}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Section 5 : Récapitulatif frais */}
      {getAmountBigInt() && (
        <div className="glass rounded-2xl p-6">
          {/* Affichage spécifique pour paiement récurrent */}
          {isRecurringMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isMounted && translationsReady ? t('create.summary.title') : '💰 Summary'}
                </h3>
              </div>
              {/* Détails par mensualité */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {isMounted && translationsReady ? t('create.date.beneficiaryWillReceive') : 'Beneficiary will receive (per month)'}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {recurringAmountValue.toFixed(2)} {formData.tokenSymbol}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    + {isMounted && translationsReady 
                      ? t('create.summary.protocolFees', { percentage: (recurringFeeBps / 100).toString() })
                      : `Protocol fees (${recurringFeeBps / 100}%)`}
                  </span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {recurringMonthlyFee.toFixed(6)} {formData.tokenSymbol}
                  </span>
                </div>

                <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.date.totalPerMonth') : 'TOTAL per monthly payment'}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {recurringTotalPerMonth.toFixed(6)} {formData.tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Calcul total */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {isMounted && translationsReady ? t('create.date.numberOfMonths') : 'Number of months'}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    × {recurringMonths}
                  </span>
                </div>

                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {isMounted && translationsReady ? t('create.date.totalToApprove') : 'TOTAL to approve'}
                  </span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {recurringTotalToApprove.toFixed(6)} {formData.tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Dates première et dernière échéance */}
              {formData.releaseDate && (
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">🗓️</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {isMounted && translationsReady ? t('create.date.firstDueDate') : 'First due date:'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formData.releaseDate.toLocaleDateString(locale, {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">📅</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {isMounted && translationsReady ? t('create.date.lastDueDate') : 'Last due date:'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {(() => {
                        const lastDate = new Date(formData.releaseDate);
                        lastDate.setMonth(lastDate.getMonth() + recurringMonths - 1);
                        return lastDate.toLocaleDateString(locale, {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        });
                      })()}
                    </span>
                  </div>
                </div>
              )}

              {/* Message trésorerie */}
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1 text-sm text-green-800 dark:text-green-200">
                    <p className="font-semibold mb-1">
                      {isMounted && translationsReady ? t('create.date.treasuryRemainsAvailable') : 'Your treasury remains available'}
                    </p>
                    <p>
                      {isMounted && translationsReady ? (
                        <span dangerouslySetInnerHTML={{ __html: t('create.date.onlyAmountDebitedMonthly', { 
                          amount: recurringTotalPerMonth.toFixed(2),
                          token: formData.tokenSymbol,
                          defaultValue: `Only <strong>${recurringTotalPerMonth.toFixed(2)} ${formData.tokenSymbol}</strong> will be debited each month from your wallet.`
                        }) }} />
                      ) : (
                        <>
                          Only <span className="font-bold">{recurringTotalPerMonth.toFixed(2)} {formData.tokenSymbol}</span> will be debited each month from your wallet.
                        </>
                      )}
                    </p>
                    <p className="mt-2">
                      {isMounted && translationsReady
                        ? t('create.date.refundRemainingMonths', { defaultValue: 'If you cancel before execution, remaining months and their protocol fees are refunded.' })
                        : 'If you cancel before execution, remaining months and their protocol fees are refunded.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message d'avertissement SKIP */}
              <div className="bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div className="flex-1 space-y-2 text-sm text-orange-900 dark:text-orange-100">
                    <p className="font-bold text-base">
                      {isMounted && translationsReady
                        ? t('create.date.importantTitle', { defaultValue: 'Important information:' })
                        : 'Important information:'}
                    </p>
                    
                    <ul className="space-y-2 list-none">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.balanceMonthly', {
                                  defaultValue:
                                    'Make sure you have enough balance <strong>EACH MONTH</strong> in your wallet to cover the debits'
                                })
                              : 'Make sure you have enough balance <strong>EACH MONTH</strong> in your wallet to cover the debits'
                          }}
                        />
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.failedMonth', {
                                  defaultValue:
                                    'If a debit fails (insufficient balance), that month is <strong class="text-red-600 dark:text-red-400">LOST</strong> and the system moves to the next month automatically'
                                })
                              : 'If a debit fails (insufficient balance), that month is <strong class="text-red-600 dark:text-red-400">LOST</strong> and the system moves to the next month automatically'
                          }}
                        />
                      </li>

                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.firstMonthFailed', {
                                  defaultValue:
                                    'Important: if the first monthly payment fails, the contract <strong class="text-red-600 dark:text-red-400">stops</strong> and no further monthly payments will be executed.'
                                })
                              : 'Important: if the first monthly payment fails, the contract <strong class="text-red-600 dark:text-red-400">stops</strong> and no further monthly payments will be executed.'
                          }}
                        />
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: isMounted && translationsReady
                              ? t('create.date.important.nextMonthsContinue', {
                                  defaultValue:
                                    'Next monthly payments will continue normally even if one month failed'
                                })
                              : 'Next monthly payments will continue normally even if one month failed'
                          }}
                        />
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span>
                          {isMounted && translationsReady 
                            ? t('create.date.cancellableStopsPayments')
                            : <>Seule l'option <strong className="text-blue-600 dark:text-blue-400">"Annulable"</strong> dans le type de paiement permet de stopper définitivement la suite des mensualités via le dashboard</>}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Affichage normal pour paiement one-time ou batch */
            <FeeDisplay 
              amount={getAmountBigInt()! * BigInt(isBatchMode ? additionalBeneficiaries.length + 1 : 1)} 
              tokenSymbol={formData.tokenSymbol}
              releaseDate={formData.releaseDate}
            />
          )}
        </div>
      )}

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={Object.values(errors).some((e) => e !== '') || activePayment.status !== 'idle'}
        className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {activePayment.status !== 'idle' 
          ? (isMounted && translationsReady ? t('common.loading') : 'Creating...')
          : isRecurringMode
          ? (isMounted && translationsReady ? t('create.submit') + ` (${recurringMonths} ${isMounted && translationsReady ? t('create.date.monthsLabel').toLowerCase() : 'months'})` : `Create recurring payment (${recurringMonths} months)`)
          : isBatchMode 
          ? (isMounted && translationsReady ? t('create.submit') + ` (${additionalBeneficiaries.length + 1} ${isMounted && translationsReady ? t('create.beneficiary.additional').toLowerCase() : 'beneficiaries'})` : `Create batch payment (${additionalBeneficiaries.length + 1} beneficiaries)`)
          : (isMounted && translationsReady ? t('create.submit') : 'Create scheduled payment')}
      </button>

      {/* Modal de progression */}
      <PaymentProgressModal
        isOpen={activePayment.status !== 'idle'}
        status={activePayment.status}
        currentStep={activePayment.currentStep || 1}
        totalSteps={activePayment.totalSteps || 1}
        progressMessage={activePayment.progressMessage}
        error={activePayment.error}
        approveTxHash={(isRecurringMode && isBatchMode)
          ? undefined // Batch recurring n'expose pas l'approveTxHash
          : isRecurringMode
          ? recurringPayment.approveTxHash
          : (isBatchMode ? batchPayment.approveTxHash : singlePayment.approveTxHash)}
        createTxHash={activePayment.createTxHash}
        contractAddress={activePayment.contractAddress}
        tokenSymbol={formData.tokenSymbol}
        onClose={handleCloseModal}
        onViewPayment={handleViewPayment}
      />
    </form>
  );
}
