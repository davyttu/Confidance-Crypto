// components/Dashboard/TransactionRow.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy, ExternalLink, Mail, X, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { BeneficiariesDropdown } from './BeneficiariesDropdown';
import { RecurringPaymentHistory } from './RecurringPaymentHistory';

interface TransactionRowProps {
  payment: Payment;
  onRename: (address: string) => void;
  onCancel: (payment: Payment) => void;
  onEmailClick?: (payment: Payment) => void;
}

export function TransactionRow({ payment, onRename, onCancel, onEmailClick }: TransactionRowProps) {
  const { t, ready: translationsReady } = useTranslation();
  const { getBeneficiaryName } = useBeneficiaries();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Vérifier si c'est un paiement récurrent
  const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';

  const beneficiaryName = getBeneficiaryName(payment.payee_address);
  const displayName = beneficiaryName || `${payment.payee_address.slice(0, 6)}...${payment.payee_address.slice(-4)}`;

  // Formater le montant
  const formatAmount = (amount: string, symbol: string) => {
    const decimals = symbol === 'ETH' ? 18 : 6;
    const amountNum = Number(BigInt(amount)) / Math.pow(10, decimals);
    return amountNum.toLocaleString('fr-FR', {
      minimumFractionDigits: symbol === 'ETH' ? 4 : 2,
      maximumFractionDigits: symbol === 'ETH' ? 4 : 2,
    });
  };

  // Formater la date et l'heure
  const formatDateAndTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    
    // Formater la date (ex: "15 janvier 2026")
    const dateFormatted = date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    // Formater l'heure (ex: "14:30")
    const timeFormatted = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return { date: dateFormatted, time: timeFormatted };
  };

  // Copier dans le presse-papier
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Déterminer le type de paiement avec emoji et texte
  const getPaymentType = () => {
    if (payment.payment_type === 'recurring') {
      return { emoji: '🔄', text: 'Récurrent' };
    }
    if (payment.is_batch) {
      return { emoji: '👥', text: `Batch (${payment.batch_count || 0})` };
    }
    if (payment.is_instant || payment.payment_type === 'instant') {
      return { emoji: '⚡', text: 'Instantané' };
    }
    return { emoji: '🕐', text: 'Programmé' };
  };

  // Statut avec badge
  const getStatusBadge = () => {
    const statusClass = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      released: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    const statusLabels = {
      pending: translationsReady ? t('dashboard.status.pending') : 'En attente',
      released: translationsReady ? t('dashboard.status.released') : 'Libéré',
      cancelled: translationsReady ? t('dashboard.status.cancelled') : 'Annulé',
      failed: translationsReady ? t('dashboard.status.failed') : 'Échoué',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass[payment.status as keyof typeof statusClass] || statusClass.pending}`}>
        {statusLabels[payment.status as keyof typeof statusLabels] || payment.status}
      </span>
    );
  };

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        {/* Bénéficiaire */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {isRecurring && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                title={isExpanded ? 'Masquer l\'historique' : 'Afficher l\'historique'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            )}
            <BeneficiariesDropdown payment={payment} onRename={onRename} />
          </div>
        </td>

      {/* Blockchain */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center">
          <div className="group relative">
            {/* Logo Base officiel */}
            <img 
              src="/blockchains/base.svg" 
              alt="Base" 
              className="w-6 h-6"
              onError={(e) => {
                // Fallback si le logo ne charge pas
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="w-6 h-6 rounded bg-blue-500 flex items-center justify-center"><span class="text-white text-xs font-bold">B</span></div>';
                }
              }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
              Base Mainnet
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        </div>
      </td>

      {/* Montant */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {formatAmount(payment.amount, payment.token_symbol || 'ETH')} {payment.token_symbol || 'ETH'}
        </div>
      </td>

      {/* Type */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="group relative inline-block">
          <span className="text-lg cursor-help" title={getPaymentType().text}>
            {getPaymentType().emoji}
          </span>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            {getPaymentType().text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        </div>
      </td>

      {/* Date de libération */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDateAndTime(payment.release_time).date}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDateAndTime(payment.release_time).time}
          </span>
        </div>
      </td>

      {/* Statut */}
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge()}
      </td>

      {/* Contrat */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
            {payment.contract_address?.slice(0, 8)}...{payment.contract_address?.slice(-6)}
          </span>
          {payment.contract_address && (
            <>
              <button
                onClick={() => copyToClipboard(payment.contract_address!)}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Copier l'adresse"
              >
                <Copy className={`w-4 h-4 ${copied ? 'text-green-600' : ''}`} />
              </button>
              <a
                href={`https://basescan.org/address/${payment.contract_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Voir sur Basescan"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-2">
          {onEmailClick && (
            <button
              onClick={() => onEmailClick(payment)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              title="Envoyer par email"
            >
              <Mail className="w-4 h-4" />
            </button>
          )}
          {payment.status === 'pending' && payment.cancellable && (
            <button
              onClick={() => onCancel(payment)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              title="Annuler"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
    {isRecurring && isExpanded && (
      <tr className="border-b border-gray-200">
        <td colSpan={8} className="p-0">
          <RecurringPaymentHistory payment={payment} />
        </td>
      </tr>
    )}
    </>
  );
}
