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
import { useCreateRecurringPayment } from '@/hooks/useCreateRecurringPayment';

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
  const recurringPayment = useCreateRecurringPayment();

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

  // État: paiement récurrent
  const [isRecurringMode, setIsRecurringMode] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState<number>(1);

  // État: type de paiement (annulable ou définitif)
  const [cancellable, setCancellable] = useState(false);

  // Erreurs de validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Balance du token sélectionné
  const { balance, formatted: balanceFormatted } = useTokenBalance(
    formData.tokenSymbol
  );

  // Vérifier si la mensualisation est disponible
  const isRecurringAvailable = formData.tokenSymbol === 'USDT' || formData.tokenSymbol === 'USDC';

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
      return 'Entrez un montant';
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'Montant invalide';
    }

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
    
    // Désactiver la mensualisation si on passe à ETH
    if (token === 'ETH' && isRecurringMode) {
      setIsRecurringMode(false);
    }
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
      if (isRecurringMode) {
        // ✅ MODIFICATION : Extraire le jour du mois de la date sélectionnée
        const dayOfMonth = formData.releaseDate!.getDate(); // Retourne 1-31
        
        await recurringPayment.createRecurringPayment({
          tokenSymbol: formData.tokenSymbol as 'USDC' | 'USDT',
          beneficiary: formData.beneficiary as `0x${string}`,
          monthlyAmount: amountBigInt,
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
        });
      } else {
        await singlePayment.createPayment({
          tokenSymbol: formData.tokenSymbol,
          beneficiary: formData.beneficiary as `0x${string}`,
          amount: amountBigInt,
          releaseTime,
          cancellable,
        });
      }
    } catch (err) {
      console.error('Erreur lors de la création:', err);
    }
  };

  // Handler fermeture modal
  const handleCloseModal = () => {
    if (isRecurringMode) {
      recurringPayment.reset();
    } else if (isBatchMode) {
      batchPayment.reset();
    } else {
      singlePayment.reset();
    }
  };

  // Handler voir le paiement
  const handleViewPayment = () => {
    const contractAddr = isRecurringMode 
      ? recurringPayment.contractAddress 
      : isBatchMode 
      ? batchPayment.contractAddress 
      : singlePayment.contractAddress;
    if (contractAddr) {
      router.push(`/payment/${contractAddr}`);
    }
  };

  const activePayment = isRecurringMode 
    ? recurringPayment 
    : isBatchMode 
    ? batchPayment 
    : singlePayment;

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
          Montant {isBatchMode && `(par bénéficiaire)`} {isRecurringMode && `(mensuel)`}
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
        
        {isBatchMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total : <span className="font-semibold">
              {(parseFloat(formData.amount) * (additionalBeneficiaries.length + 1)).toFixed(4)} {formData.tokenSymbol}
            </span>
            {' '}pour {additionalBeneficiaries.length + 1} bénéficiaires
          </div>
        )}

        {isRecurringMode && formData.amount && parseFloat(formData.amount) > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total sur {recurringMonths} mois : <span className="font-semibold">
              {(parseFloat(formData.amount) * recurringMonths).toFixed(4)} {formData.tokenSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Section 4 : Date */}
      <div className="glass rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          {isRecurringMode ? 'Date et heure de libération (première échéance)' : 'Date et heure de libération'}
        </label>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setHours(date.getHours() + 1);
              handleDateChange(date);
            }}
            className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-sm font-medium"
          >
            1 heure
          </button>

          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setHours(date.getHours() + 6);
              handleDateChange(date);
            }}
            className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-sm font-medium"
          >
            6 heures
          </button>

          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 1);
              handleDateChange(date);
            }}
            className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-sm font-medium"
          >
            1 jour
          </button>

          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 7);
              handleDateChange(date);
            }}
            className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-sm font-medium"
          >
            1 semaine
          </button>

          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setMonth(date.getMonth() + 1);
              handleDateChange(date);
            }}
            className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-sm font-medium"
          >
            1 mois
          </button>

          {/* Bouton Mensualisation */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                if (isRecurringAvailable) {
                  setIsRecurringMode(!isRecurringMode);
                }
              }}
              disabled={!isRecurringAvailable}
              className={`
                px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                ${isRecurringMode 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : isRecurringAvailable
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-400 text-gray-900 dark:text-white'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 opacity-50 cursor-not-allowed'
                }
              `}
            >
              🔄 Mensualisation
            </button>

            {/* Tooltip si ETH sélectionné */}
            {!isRecurringAvailable && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                ⚠️ Fonction uniquement disponible pour USDT/USDC
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>

        {/* Sélecteur nombre de mois si mensualisation active */}
        {isRecurringMode && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl space-y-3 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nombre de mensualités
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
              💡 Le montant sera prélevé chaque mois pendant {recurringMonths} mois. Votre trésorerie reste disponible.
            </p>
          </div>
        )}

        <DateTimePicker
          value={formData.releaseDate}
          onChange={handleDateChange}
          error={errors.date}
          label=""
          hidePresets={true}
        />

        {/* Info jour du mois si mensualisation */}
        {isRecurringMode && formData.releaseDate && (
          <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">📅</span>
              <span className="text-gray-700 dark:text-gray-300">
                Les prélèvements auront lieu le <span className="font-bold text-purple-600 dark:text-purple-400">{formData.releaseDate.getDate()}</span> de chaque mois
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section 4.5 : Type de paiement */}
      <div className="glass rounded-2xl p-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            🔒 Type de paiement
          </label>
          
          <div className="space-y-3">
            <label
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                cancellable
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="paymentType"
                checked={cancellable}
                onChange={() => setCancellable(true)}
                className="mt-1 w-5 h-5 text-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔓</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Annulable (avant la date)
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Vous pourrez annuler le paiement depuis le dashboard avant la date de libération
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                !cancellable
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="paymentType"
                checked={!cancellable}
                onChange={() => setCancellable(false)}
                className="mt-1 w-5 h-5 text-purple-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔒</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Définitif (non annulable)
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Une fois créé, impossible d'annuler. Les fonds seront automatiquement libérés à la date choisie
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Section 5 : Récapitulatif frais */}
      {getAmountBigInt() && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              💰 Récapitulatif
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Frais : 1.79%
            </span>
          </div>

          {/* Affichage spécifique pour paiement récurrent */}
          {isRecurringMode ? (
            <div className="space-y-4">
              {/* Détails par mensualité */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    Bénéficiaire recevra (par mois)
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {parseFloat(formData.amount).toFixed(2)} {formData.tokenSymbol}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    + Frais protocole (1.79%)
                  </span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {(parseFloat(formData.amount) * 0.0179).toFixed(2)} {formData.tokenSymbol}
                  </span>
                </div>

                <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    TOTAL par mensualité
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {(parseFloat(formData.amount) * 1.0179).toFixed(2)} {formData.tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Calcul total */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    Nombre de mois
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    × {recurringMonths}
                  </span>
                </div>

                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    TOTAL à approuver
                  </span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {(parseFloat(formData.amount) * 1.0179 * recurringMonths).toFixed(2)} {formData.tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Dates première et dernière échéance */}
              {formData.releaseDate && (
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">🗓️</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      Première échéance :
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formData.releaseDate.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">📅</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      Dernière échéance :
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {(() => {
                        const lastDate = new Date(formData.releaseDate);
                        lastDate.setMonth(lastDate.getMonth() + recurringMonths - 1);
                        return lastDate.toLocaleDateString('fr-FR', {
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
                    <p className="font-semibold mb-1">Votre trésorerie reste disponible</p>
                    <p>
                      Seuls <span className="font-bold">{(parseFloat(formData.amount) * 1.0179).toFixed(2)} {formData.tokenSymbol}</span> seront 
                      prélevés chaque mois sur votre wallet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Message d'avertissement SKIP */}
              <div className="bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div className="flex-1 space-y-2 text-sm text-orange-900 dark:text-orange-100">
                    <p className="font-bold text-base">Informations importantes :</p>
                    
                    <ul className="space-y-2 list-none">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span>
                          <strong>Assurez-vous d'avoir suffisamment de balance CHAQUE MOIS</strong> sur votre 
                          wallet pour couvrir les prélèvements
                        </span>
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span>
                          <strong>Si un prélèvement échoue</strong> (balance insuffisante), ce mois sera 
                          <strong className="text-red-600 dark:text-red-400"> PERDU</strong> et le système passera 
                          automatiquement au mois suivant
                        </span>
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span>
                          Les <strong>prochaines mensualités continueront normalement</strong> même si un mois a échoué
                        </span>
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 flex-shrink-0">•</span>
                        <span>
                          Seule l'option <strong className="text-blue-600 dark:text-blue-400">"Annulable"</strong> dans 
                          le type de paiement permet de stopper définitivement la suite des mensualités via le dashboard
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
          ? 'Création en cours...' 
          : isRecurringMode
          ? `Créer le paiement récurrent (${recurringMonths} mois)`
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
