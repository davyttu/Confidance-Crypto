'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TokenSymbol,
  getToken,
  calculateFees,
  formatTokenAmount,
  getProtocolFeeBps,
} from '@/config/tokens';
import { useAuth } from '@/contexts/AuthContext';

interface FeeDisplayProps {
  amount: bigint | null;
  tokenSymbol: TokenSymbol | string;
  tokenDecimals?: number;
  showDetails?: boolean;
  releaseDate?: Date | null; // Pour détecter les paiements instantanés
}

export default function FeeDisplay({
  amount,
  tokenSymbol,
  tokenDecimals,
  showDetails = true,
  releaseDate,
}: FeeDisplayProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuth();
  const token =
    tokenDecimals !== undefined
      ? { symbol: tokenSymbol, decimals: tokenDecimals, name: '' }
      : getToken(tokenSymbol as TokenSymbol);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!amount || amount === BigInt(0)) {
    return null;
  }

  // Détecter si c'est un paiement instantané (moins de 60 secondes)
  const isInstantPayment = releaseDate 
    ? (releaseDate.getTime() - Date.now()) < 60 * 1000
    : false;

  const isProVerified = user?.accountType === 'professional' && user?.proStatus === 'verified';
  const feeBps = getProtocolFeeBps({ isInstantPayment, isProVerified });
  const feePercent = feeBps / 100;

  const fees = calculateFees(amount, token.decimals, { isInstantPayment, isProVerified });

  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && translationsReady ? t('create.summary.title') : '💰 Récapitulatif'}
        </h3>
      </div>

      {/* Card récapitulatif */}
      <div className="glass rounded-2xl p-6 space-y-4">
        {/* Montant bénéficiaire */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isMounted && translationsReady ? t('create.summary.beneficiaryWillReceive') : 'Bénéficiaire recevra'}
          </span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatTokenAmount(fees.recipientAmount, token.decimals, tokenSymbol)}
          </span>
        </div>

        {showDetails && (
          <>
            {/* Frais protocole */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isInstantPayment ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                  + {isMounted && translationsReady 
                    ? t('create.summary.protocolFees', { percentage: isInstantPayment ? 0 : feePercent })
                    : `Frais protocole (${isInstantPayment ? 0 : feePercent}%)`}
                </span>
                <div className="group relative">
                  <svg
                    className="w-4 h-4 text-gray-400 cursor-help"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-10">
                    {isMounted && translationsReady ? t('create.summary.feesTooltip') : 'Ces frais maintiennent la plateforme et le keeper 24/7'}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
              <span className={`text-sm font-medium ${isInstantPayment ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {formatTokenAmount(fees.protocolFee, token.decimals, tokenSymbol)}
              </span>
            </div>

            {/* Séparateur */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600" />
          </>
        )}

        {/* TOTAL à envoyer */}
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 -m-6 mt-0 p-6 rounded-b-2xl">
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {isMounted && translationsReady ? t('create.summary.totalToSend') : 'TOTAL à envoyer'}
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatTokenAmount(fees.totalAmount, token.decimals, tokenSymbol)}
          </span>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
        <svg
          className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="text-sm text-blue-900 dark:text-blue-300">
          <p className="font-medium mb-1">
            {isMounted && translationsReady ? t('create.summary.secureTitle') : '🔒 Paiement sécurisé et automatique'}
          </p>
          <p className="text-xs">
            {isMounted && translationsReady ? t('create.summary.secureDescription') : 'Vos fonds sont verrouillés dans un smart contract et seront automatiquement libérés à la date choisie. Aucune action manuelle nécessaire.'}
          </p>
        </div>
      </div>
    </div>
  );
}