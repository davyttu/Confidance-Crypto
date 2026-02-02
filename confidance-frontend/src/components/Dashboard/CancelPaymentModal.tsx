// components/Dashboard/CancelPaymentModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';
import { formatAmount, sumAmounts } from '@/lib/utils/amountFormatter';
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

  const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
  const batchChildren = payment.__batchChildren || [];
  const batchBeneficiaries = payment.batch_beneficiaries || [];

  const resolvedBeneficiaries = (() => {
    if (batchChildren.length > 0) {
      return batchChildren.map((child) => ({
        address: child.payee_address,
        amount: child.monthly_amount || child.amount,
        firstMonthAmount: child.first_month_amount || payment.first_month_amount,
        isFirstMonthCustom: child.is_first_month_custom ?? payment.is_first_month_custom,
        totalMonths: child.total_months ?? payment.total_months,
      }));
    }
    if (batchBeneficiaries.length > 0) {
      return batchBeneficiaries.map((beneficiary) => ({
        address: beneficiary.address,
        amount: beneficiary.amount,
        firstMonthAmount: payment.first_month_amount,
        isFirstMonthCustom: payment.is_first_month_custom,
        totalMonths: payment.total_months,
      }));
    }
    return [{
      address: payment.payee_address,
      amount: payment.monthly_amount || payment.amount,
      firstMonthAmount: payment.first_month_amount,
      isFirstMonthCustom: payment.is_first_month_custom,
      totalMonths: payment.total_months,
    }];
  })();

  const beneficiaryNames = resolvedBeneficiaries.map((beneficiary) => {
    const name = getBeneficiaryName(beneficiary.address);
    return name || truncateAddress(beneficiary.address);
  });

  const totalMonths =
    isRecurring
      ? Number(
          payment.total_months ||
          Math.max(
            0,
            ...resolvedBeneficiaries.map((beneficiary) => Number(beneficiary.totalMonths || 0))
          )
        )
      : 1;

  const computeTotalForBeneficiary = (beneficiary: {
    amount?: string | null;
    firstMonthAmount?: string | null;
    isFirstMonthCustom?: boolean | null;
  }) => {
    const monthlyAmount = beneficiary.amount ? BigInt(beneficiary.amount) : 0n;
    if (!isRecurring || totalMonths <= 0) {
      return monthlyAmount;
    }
    const isFirstMonthCustom =
      beneficiary.isFirstMonthCustom === true || beneficiary.isFirstMonthCustom === 'true';
    const firstMonthAmount = beneficiary.firstMonthAmount ? BigInt(beneficiary.firstMonthAmount) : 0n;
    if (isFirstMonthCustom && firstMonthAmount > 0n && firstMonthAmount !== monthlyAmount) {
      return firstMonthAmount + (monthlyAmount * BigInt(Math.max(totalMonths - 1, 0)));
    }
    return monthlyAmount * BigInt(totalMonths);
  };

  const totalAmount = resolvedBeneficiaries.reduce((sum, beneficiary) => {
    return sum + computeTotalForBeneficiary(beneficiary);
  }, 0n);
  const displayAmount = formatAmount(
    totalAmount,
    payment.token_symbol === 'USDC' || payment.token_symbol === 'USDT' ? 6 : 18
  );
  const requiresMultipleCancels = isRecurring && resolvedBeneficiaries.length > 1;

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
            <h2 className="text-xl font-bold text-gray-900">
              {isMounted && translationsReady ? t('dashboard.cancel.title') : 'Cancel payment'}
            </h2>
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
              {isMounted && translationsReady
                ? (isRecurring ? t('dashboard.cancel.warningRecurring') : t('dashboard.cancel.warning'))
                : (isRecurring ? '⚠️ Vous êtes sur le point d\'annuler ce paiement récurrent :' : '⚠️ Vous êtes sur le point d\'annuler ce paiement programmé :')}
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {resolvedBeneficiaries.length > 1
                    ? (isMounted && translationsReady ? t('dashboard.cancel.beneficiaries', { defaultValue: 'Beneficiaries:' }) : 'Beneficiaries:')
                    : (isMounted && translationsReady ? t('dashboard.cancel.beneficiary', { defaultValue: 'Beneficiary:' }) : 'Beneficiary:')}
                </span>
                <span className="font-medium text-gray-900 text-right">
                  {resolvedBeneficiaries.length > 1
                    ? beneficiaryNames.join(', ')
                    : beneficiaryNames[0]}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {isRecurring
                    ? (isMounted && translationsReady ? t('dashboard.cancel.totalAmountRecurring', { defaultValue: 'Total amount (all months):' }) : 'Total amount (all months):')
                    : (isMounted && translationsReady ? t('dashboard.cancel.amount', { defaultValue: 'Amount:' }) : 'Amount:')}
                </span>
                <span className="font-medium text-gray-900">
                  {displayAmount} {payment.token_symbol}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {isMounted && translationsReady ? t('dashboard.cancel.releaseDate') : 'Scheduled release:'}
                </span>
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
                <p className="font-medium mb-1">
                  {isMounted && translationsReady ? t('dashboard.cancel.important') : 'Important:'}
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {!isRecurring && (
                    <>
                      <li>{isMounted && translationsReady ? t('dashboard.cancel.refund') : 'Funds and protocol fees will be refunded to your wallet (pro rata for batch)'}</li>
                      <li>{isMounted && translationsReady ? t('dashboard.cancel.noFees') : 'Protocol fees are refunded on cancellation'}</li>
                    </>
                  )}
                  {isRecurring && (
                    <li>
                      {isMounted && translationsReady
                        ? t('dashboard.cancel.recurringNoRefund', { defaultValue: 'No funds are locked; cancelling stops future installments.' })
                        : 'No funds are locked; cancelling stops future installments.'}
                    </li>
                  )}
                  <li>{isMounted && translationsReady ? t('dashboard.cancel.irreversible') : 'This action is irreversible'}</li>
                  {requiresMultipleCancels && (
                    <>
                      <li className="font-medium text-amber-800">
                        {isMounted && translationsReady
                          ? t('dashboard.cancel.batchParentWarning', {
                              defaultValue: 'This cancellation will cancel all future installments for each beneficiary. To stop only one beneficiary, cancel only that beneficiary\'s row (child row) in the transaction details.',
                            })
                          : 'Cette annulation annulera toutes les échéances futures pour chaque destinataire. Pour n\'arrêter qu\'un seul destinataire, annulez uniquement la ligne de ce destinataire (ligne enfant) dans le détail des transactions.'}
                      </li>
                      <li>
                        {isMounted && translationsReady
                          ? t('dashboard.cancel.batchRecurringNotice', {
                              count: resolvedBeneficiaries.length,
                              defaultValue: `You will need to confirm ${resolvedBeneficiaries.length} cancellation transactions in your wallet.`,
                            })
                          : `Vous devrez confirmer ${resolvedBeneficiaries.length} annulations dans votre wallet.`}
                      </li>
                    </>
                  )}
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
              {isMounted && translationsReady
                ? (isRecurring ? t('dashboard.cancel.confirmTextRecurring') : t('dashboard.cancel.confirmText'))
                : (isRecurring ? 'I understand that this action is irreversible and I wish to cancel this recurring payment.' : 'I understand that this action is irreversible and I wish to cancel this scheduled payment.')}
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
