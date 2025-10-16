'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { type TokenSymbol, getToken } from '@/config/tokens';
import CurrencySelector from './CurrencySelector';
import DateTimePicker from './DateTimePicker';
import FeeDisplay from './FeeDisplay';
import PaymentProgressModal from './PaymentProgressModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useCreatePayment } from '@/hooks/useCreatePayment';

interface PaymentFormData {
  tokenSymbol: TokenSymbol;
  beneficiary: string;
  amount: string;
  releaseDate: Date | null;
}

export default function PaymentForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  // Hook de création
  const {
    createPayment,
    status: createStatus,
    error: createError,
    approveTxHash,
    createTxHash,
    contractAddress,
    currentStep,
    totalSteps,
    progressMessage,
    reset: resetCreate,
  } = useCreatePayment();

  // État du formulaire
  const [formData, setFormData] = useState<PaymentFormData>({
    tokenSymbol: 'ETH',
    beneficiary: '',
    amount: '',
    releaseDate: null,
  });

  // Erreurs de validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Balance du token sélectionné
  const { balance, formatted: balanceFormatted } = useTokenBalance(
    formData.tokenSymbol
  );

  // Validation adresse Ethereum
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Validation montant
  const validateAmount = (amount: string): string | null => {
    if (!amount || amount === '0') {
      return 'Entrez un montant';
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'Montant invalide';
    }

    // Vérifier si assez de balance (conversion approximative)
    if (balance) {
      const decimals = formData.tokenSymbol === 'ETH' ? 18 : 
                       formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT' ? 6 : 8;
      const amountBigInt = BigInt(Math.floor(amountNum * 10 ** decimals));
      if (amountBigInt > balance) {
        return 'Balance insuffisante';
      }
    }

    return null;
  };

  // Validation date
  const validateDate = (date: Date | null): string | null => {
    if (!date) {
      return 'Choisissez une date';
    }

    const now = new Date();
    const minDate = new Date(now.getTime() + 5 * 60 * 1000); // +5 min

    if (date < minDate) {
      return 'La date doit être au moins 5 minutes dans le futur';
    }

    return null;
  };

  // Handler changement token
  const handleTokenChange = (token: TokenSymbol) => {
    setFormData((prev) => ({ ...prev, tokenSymbol: token }));
    setErrors((prev) => ({ ...prev, amount: '' }));
  };

  // Handler changement bénéficiaire
  const handleBeneficiaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, beneficiary: value }));

    if (value && !isValidAddress(value)) {
      setErrors((prev) => ({ ...prev, beneficiary: 'Adresse invalide' }));
    } else {
      setErrors((prev) => ({ ...prev, beneficiary: '' }));
    }
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

  // Calculer le montant en BigInt pour FeeDisplay
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

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation complète
    const newErrors: Record<string, string> = {};

    if (!isValidAddress(formData.beneficiary)) {
      newErrors.beneficiary = 'Adresse invalide';
    }

    const amountError = validateAmount(formData.amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    const dateError = validateDate(formData.releaseDate);
    if (dateError) {
      newErrors.date = dateError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Calcul du montant en BigInt
    const token = getToken(formData.tokenSymbol);
    const amountBigInt = BigInt(
      Math.floor(parseFloat(formData.amount) * 10 ** token.decimals)
    );

    // Appel du hook de création
    try {
      await createPayment({
        tokenSymbol: formData.tokenSymbol,
        beneficiary: formData.beneficiary as `0x${string}`,
        amount: amountBigInt,
        releaseTime: Math.floor(formData.releaseDate!.getTime() / 1000),
      });
    } catch (err) {
      console.error('Erreur lors de la création:', err);
    }
  };

  // Handler fermeture modal
  const handleCloseModal = () => {
    resetCreate();
  };

  // Handler voir le paiement
  const handleViewPayment = () => {
    if (contractAddress) {
      router.push(`/payment/${contractAddress}`);
    }
  };

  if (!isConnected) {
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
          Connectez votre wallet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Pour créer un paiement programmé, connectez d'abord votre wallet
        </p>
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
        
        {/* Balance */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Balance disponible : <span className="font-medium">{balanceFormatted}</span>
        </div>
      </div>

      {/* Section 2 : Bénéficiaire */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Adresse du bénéficiaire
        </label>
        <input
          type="text"
          value={formData.beneficiary}
          onChange={handleBeneficiaryChange}
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
        {errors.beneficiary && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.beneficiary}
          </p>
        )}
      </div>

      {/* Section 3 : Montant */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Montant à envoyer
        </label>
        <div className="relative">
          <input
            type="number"
            step="any"
            value={formData.amount}
            onChange={handleAmountChange}
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
      </div>

      {/* Section 4 : Date */}
      <div className="glass rounded-2xl p-6">
        <DateTimePicker
          value={formData.releaseDate}
          onChange={handleDateChange}
          error={errors.date}
        />
      </div>

      {/* Section 5 : Récapitulatif frais */}
      {getAmountBigInt() && (
        <FeeDisplay amount={getAmountBigInt()} tokenSymbol={formData.tokenSymbol} />
      )}

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={Object.values(errors).some((e) => e !== '') || createStatus !== 'idle'}
        className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {createStatus !== 'idle' ? 'Création en cours...' : 'Créer le paiement programmé'}
      </button>

      {/* Modal de progression */}
      <PaymentProgressModal
        isOpen={createStatus !== 'idle'}
        status={createStatus}
        currentStep={currentStep}
        totalSteps={totalSteps}
        progressMessage={progressMessage}
        error={createError}
        approveTxHash={approveTxHash}
        createTxHash={createTxHash}
        contractAddress={contractAddress}
        tokenSymbol={formData.tokenSymbol}
        onClose={handleCloseModal}
        onViewPayment={handleViewPayment}
      />
    </form>
  );
}