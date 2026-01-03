// components/Dashboard/TransactionRow.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { formatDate } from '@/lib/utils/dateFormatter';
import { truncateAddress, copyToClipboard } from '@/lib/utils/addressFormatter';

interface TransactionRowProps {
  payment: Payment;
  onRename: (address: string) => void;
  onCancel: (payment: Payment) => void;
}

// ✅ AJOUTÉ: Fonction helper pour déterminer les decimals selon le token
const getTokenDecimals = (tokenSymbol: string): number => {
  if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') return 6;
  return 18; // ETH et autres tokens par défaut
};

export function TransactionRow({ payment, onRename, onCancel }: TransactionRowProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { getBeneficiaryName } = useBeneficiaries();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const beneficiaryName = getBeneficiaryName(payment.payee_address);
  const displayName = beneficiaryName || truncateAddress(payment.payee_address);

  // Badge de statut
  const getStatusBadge = (status: string) => {
    const badgeConfig = {
      pending: { color: 'bg-orange-100 text-orange-800', key: 'dashboard.status.pending', fallback: 'En cours' },
      released: { color: 'bg-green-100 text-green-800', key: 'dashboard.status.released', fallback: 'Exécuté' },
      cancelled: { color: 'bg-gray-100 text-gray-800', key: 'dashboard.status.cancelled', fallback: 'Annulé' },
      failed: { color: 'bg-red-100 text-red-800', key: 'dashboard.status.failed', fallback: 'Échoué' },
    };

    const config = badgeConfig[status as keyof typeof badgeConfig] || badgeConfig.pending;
    const label = isMounted && translationsReady ? t(config.key) : config.fallback;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {label}
      </span>
    );
  };

  // Copier l'adresse du contrat
  const handleCopyContract = async () => {
    const success = await copyToClipboard(payment.contract_address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Vérifier si annulable
  const canCancel = payment.cancellable && 
                    payment.status === 'pending' && 
                    payment.release_time > Math.floor(Date.now() / 1000);

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200">
      {/* Bénéficiaire */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-sm">
              {displayName[0].toUpperCase()}
            </span>
          </div>
          <div>
            <button
              onClick={() => onRename(payment.payee_address)}
              className="font-medium text-gray-900 hover:text-blue-600 transition-colors text-left"
              title={isMounted && translationsReady ? t('dashboard.table.clickToRename') : 'Cliquer pour renommer'}
            >
              {displayName}
            </button>
            {beneficiaryName && (
              <p className="text-xs text-gray-500">{truncateAddress(payment.payee_address)}</p>
            )}
          </div>
        </div>
      </td>

      {/* Montant - ✅ MODIFIÉ: Ajout du paramètre decimals */}
      <td className="px-6 py-4">
        <div className="font-semibold text-gray-900">
          {formatAmount(payment.amount, getTokenDecimals(payment.token_symbol))} {payment.token_symbol}
        </div>
      </td>

      {/* Date de libération */}
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {formatDate(payment.release_time)}
        </div>
        {payment.released_at && (
          <div className="text-xs text-gray-500">
            {isMounted && translationsReady 
              ? t('dashboard.table.releasedOn', { date: new Date(payment.released_at).toLocaleDateString() })
              : `Libéré le ${new Date(payment.released_at).toLocaleDateString('fr-FR')}`}
          </div>
        )}
      </td>

      {/* Statut */}
      <td className="px-6 py-4">
        {getStatusBadge(payment.status)}
      </td>

      {/* Contrat */}
      <td className="px-6 py-4">
        <button
          onClick={handleCopyContract}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors group"
          title={isMounted && translationsReady ? t('dashboard.table.copyAddress') : "Copier l'adresse"}
        >
          <span className="font-mono">{truncateAddress(payment.contract_address, 8, 6)}</span>
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {/* Voir sur Basescan */}
          <a
            href={`https://basescan.org/address/${payment.contract_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={isMounted && translationsReady ? t('dashboard.table.viewOnBasescan') : 'Voir sur Basescan'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* Bouton annuler */}
          {canCancel && (
            <button
              onClick={() => onCancel(payment)}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title={isMounted && translationsReady ? t('dashboard.table.cancelPayment') : 'Annuler le paiement'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
