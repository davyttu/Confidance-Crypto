// components/Dashboard/CancelPaymentModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { formatDateTime } from '@/lib/utils/dateFormatter';
import { truncateAddress } from '@/lib/utils/addressFormatter';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';

interface CancelPaymentModalProps {
  payment: Payment | null;
  onClose: () => void;
  onConfirm: (payment: Payment) => Promise<void>;
}

export function CancelPaymentModal({ payment, onClose, onConfirm }: CancelPaymentModalProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { getBeneficiaryName } = useBeneficiaries();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!payment) return null;

  const beneficiaryName = getBeneficiaryName(payment.payee_address);
  const displayName = beneficiaryName || truncateAddress(payment.payee_address);

  const handleConfirm = async () => {
    if (!isConfirmed) {
      setError(isMounted && translationsReady ? t('dashboard.cancel.confirmError') : 'Veuillez confirmer en cochant la case');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      await onConfirm(payment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isMounted && translationsReady ? t('dashboard.cancel.error') : 'Erreur lors de l\'annulation'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Annuler le paiement</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="px-6 py-4 space-y-4">
          {/* Détails du paiement */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium mb-3">
              {isMounted && translationsReady ? t('dashboard.cancel.warning') : '⚠️ Vous êtes sur le point d\'annuler ce paiement programmé :'}
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Bénéficiaire :</span>
                <span className="font-medium text-gray-900">{displayName}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">{isMounted && translationsReady ? t('dashboard.cancel.amount') : 'Montant :'}</span>
                <span className="font-medium text-gray-900">
                  {formatAmount(payment.amount)} {payment.token_symbol}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Libération prévue :</span>
                <span className="font-medium text-gray-900">
                  {formatDateTime(payment.release_time)}
                </span>
              </div>
            </div>
          </div>

          {/* Avertissements */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">{isMounted && translationsReady ? t('dashboard.cancel.important') : 'Important :'}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{isMounted && translationsReady ? t('dashboard.cancel.refund') : 'Les fonds seront remboursés sur votre wallet'}</li>
                  <li>{isMounted && translationsReady ? t('dashboard.cancel.irreversible') : 'Cette action est irréversible'}</li>
                  <li>{isMounted && translationsReady ? t('dashboard.cancel.noFees') : 'Aucun frais ne sera prélevé'}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Checkbox de confirmation */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => {
                setIsConfirmed(e.target.checked);
                setError(null);
              }}
              className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Je comprends que cette action est irréversible et je souhaite annuler ce paiement programmé.
            </span>
          </label>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {isMounted && translationsReady ? t('dashboard.cancel.close') : 'Fermer'}
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed || isProcessing}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isMounted && translationsReady ? t('dashboard.cancel.processing') : 'Annulation...'}
              </span>
            ) : (
              (isMounted && translationsReady ? t('dashboard.cancel.confirm') : 'Confirmer l\'annulation')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
