'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { type TokenSymbol, getToken } from '@/config/tokens';
import CurrencySelector from './CurrencySelector';
import DateTimePicker from './DateTimePicker';
import FeeDisplay from './FeeDisplay';
import PaymentProgressModal from './PaymentProgressModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useCreateBatchPayment } from '@/hooks/useCreateBatchPayment';

interface PaymentFormData {
  tokenSymbol: TokenSymbol;
  beneficiary: string;
  amount: string;
  releaseDate: Date | null;
}

export default function PaymentForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  // Hooks de création
  const singlePayment = useCreatePayment();
  const batchPayment = useCreateBatchPayment();

  // État: paiement simple ou batch?
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [additionalBeneficiaries, setAdditionalBeneficiaries] = useState<string[]>([]);

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

  // 🆕 CORRECTION : Restaurer TOUTES les données au retour de /create-batch
  useEffect(() => {
    // 1. Restaurer les données du formulaire
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
        // Nettoyer après restauration
        localStorage.removeItem('paymentFormData');
      } catch (error) {
        console.error('Erreur restauration formData:', error);
      }
    }

    // 2. Récupérer les bénéficiaires additionnels
    const storedBeneficiaries = localStorage.getItem('additionalBeneficiaries');
    if (storedBeneficiaries) {
      try {
        const addresses = JSON.parse(storedBeneficiaries);
        if (Array.isArray(addresses) && addresses.length > 0) {
          setAdditionalBeneficiaries(addresses);
          setIsBatchMode(true);
        }
        // Nettoyer après récupération
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
      return 'Entrez un montant';
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'Montant invalide';
    }

    // Vérifier si assez de balance
    if (balance) {
      const decimals = formData.tokenSymbol === 'ETH' ? 18 : 
                       formData.tokenSymbol === 'USDC' || formData.tokenSymbol === 'USDT' ? 6 : 8;
      const totalBeneficiaries = isBatchMode ? additionalBeneficiaries.length + 1 : 1;
      const totalAmount = amountNum * totalBeneficiaries;
      const amountBigInt = BigInt(Math.floor(totalAmount * 10 ** decimals));
      
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
    const minDate = new Date(now.getTime() + 5 * 60 * 1000);

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

  // 🆕 Handler redirection vers /create-batch
  const handleAddMultipleBeneficiaries = () => {
    // Sauvegarder TOUTES les données actuelles
    localStorage.setItem('paymentFormData', JSON.stringify({
      tokenSymbol: formData.tokenSymbol,
      beneficiary: formData.beneficiary,
      amount: formData.amount,
      releaseDate: formData.releaseDate?.toISOString(),
    }));

    router.push('/create-batch');
  };

  // 🆕 Handler suppression d'un bénéficiaire additionnel
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

    const token = getToken(formData.tokenSymbol);
    const amountBigInt = BigInt(
      Math.floor(parseFloat(formData.amount) * 10 ** token.decimals)
    );
    const releaseTime = Math.floor(formData.releaseDate!.getTime() / 1000);

    try {
      if (isBatchMode && additionalBeneficiaries.length > 0) {
        // Mode batch: tous les bénéficiaires reçoivent le MÊME montant
        const allBeneficiaries = [
          { address: formData.beneficiary, amount: formData.amount },
          ...additionalBeneficiaries.map(addr => ({ address: addr, amount: formData.amount }))
        ];

        await batchPayment.createBatchPayment({
          beneficiaries: allBeneficiaries,
          releaseTime,
          cancellable: false,
        });
      } else {
        // Mode simple
        await singlePayment.createPayment({
          tokenSymbol: formData.tokenSymbol,
          beneficiary: formData.beneficiary as `0x${string}`,
          amount: amountBigInt,
          releaseTime,
        });
      }
    } catch (err) {
      console.error('Erreur lors de la création:', err);
    }
  };

  // Handler fermeture modal
  const handleCloseModal = () => {
    if (isBatchMode) {
      batchPayment.reset();
    } else {
      singlePayment.reset();
    }
  };

  // Handler voir le paiement
  const handleViewPayment = () => {
    const contractAddr = isBatchMode ? batchPayment.contractAddress : singlePayment.contractAddress;
    if (contractAddr) {
      router.push(`/payment/${contractAddr}`);
    }
  };

  // Déterminer quel hook utiliser pour le modal
  const activePayment = isBatchMode ? batchPayment : singlePayment;

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

      {/* Section 2 : Bénéficiaire(s) */}
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
        
        {/* 🆕 Affichage des bénéficiaires additionnels */}
        {isBatchMode && additionalBeneficiaries.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              👥 Bénéficiaires supplémentaires ({additionalBeneficiaries.length})
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
                    ✕ Supprimer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 🆕 BOUTON AJOUTER BÉNÉFICIAIRES */}
        {!isBatchMode && (
          <button
            type="button"
            onClick={handleAddMultipleBeneficiaries}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors group"
          >
            <svg 
              className="w-4 h-4 transition-transform group-hover:scale-110" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Ajouter plusieurs bénéficiaires</span>
          </button>
        )}
      </div>

      {/* Section 3 : Montant */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Montant {isBatchMode && `(par bénéficiaire)`}
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
        
        {/* 🆕 Info total si batch */}
        {isBatchMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total : <span className="font-semibold">
              {(parseFloat(formData.amount) * (additionalBeneficiaries.length + 1)).toFixed(4)} {formData.tokenSymbol}
            </span>
            {' '}pour {additionalBeneficiaries.length + 1} bénéficiaires
          </div>
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
        <FeeDisplay 
          amount={getAmountBigInt()! * BigInt(isBatchMode ? additionalBeneficiaries.length + 1 : 1)} 
          tokenSymbol={formData.tokenSymbol} 
        />
      )}

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={Object.values(errors).some((e) => e !== '') || activePayment.status !== 'idle'}
        className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {activePayment.status !== 'idle' 
          ? 'Création en cours...' 
          : isBatchMode 
          ? `Créer le paiement multiple (${additionalBeneficiaries.length + 1} bénéficiaires)`
          : 'Créer le paiement programmé'}
      </button>

      {/* Modal de progression */}
      <PaymentProgressModal
        isOpen={activePayment.status !== 'idle'}
        status={activePayment.status}
        currentStep={activePayment.currentStep || 1}
        totalSteps={activePayment.totalSteps || 1}
        progressMessage={activePayment.progressMessage}
        error={activePayment.error}
        approveTxHash={singlePayment.approveTxHash}
        createTxHash={activePayment.createTxHash}
        contractAddress={activePayment.contractAddress}
        tokenSymbol={formData.tokenSymbol}
        onClose={handleCloseModal}
        onViewPayment={handleViewPayment}
      />
    </form>
  );
}
