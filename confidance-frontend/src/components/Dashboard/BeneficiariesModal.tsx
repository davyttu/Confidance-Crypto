// components/Dashboard/BeneficiariesModal.tsx
'use client';

import { createPortal } from 'react-dom';
import { Payment, BatchBeneficiary } from '@/hooks/useDashboard';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { truncateAddress, copyToClipboard } from '@/lib/utils/addressFormatter';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { useState, useEffect } from 'react';

interface BeneficiariesModalProps {
  payment: Payment;
  onClose: () => void;
}

export function BeneficiariesModal({ payment, onClose }: BeneficiariesModalProps) {
  const { getBeneficiaryName } = useBeneficiaries();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const beneficiaries = payment.batch_beneficiaries || [];
  const totalAmount = BigInt(payment.amount) * BigInt(beneficiaries.length);

  // Helper pour convertir amount en BigInt (gère string et number)
  // Si amount est une string avec décimales, on assume qu'elle est déjà en wei (format de la DB)
  const getAmountAsBigInt = (amount: string | number | bigint): bigint => {
    if (typeof amount === 'bigint') return amount;
    if (typeof amount === 'number') return BigInt(Math.floor(amount));
    // Si c'est une string, essayer de la convertir
    // D'abord essayer directement BigInt (si c'est déjà en wei sans décimales)
    try {
      // Si la string contient un point, c'est probablement un nombre décimal
      if (amount.includes('.')) {
        // Convertir en wei (18 décimales pour ETH, 6 pour USDC/USDT)
        const decimals = payment.token_symbol === 'USDC' || payment.token_symbol === 'USDT' ? 6 : 18;
        const num = parseFloat(amount);
        if (isNaN(num)) return BigInt(0);
        // Multiplier par 10^decimals pour convertir en wei
        const multiplier = BigInt(10 ** decimals);
        // Utiliser une conversion précise pour éviter les erreurs de floating point
        const parts = amount.split('.');
        const integerPart = parts[0] || '0';
        const decimalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
        return BigInt(integerPart) * multiplier + BigInt(decimalPart);
      }
      // Sinon, c'est probablement déjà en wei
      return BigInt(amount);
    } catch {
      return BigInt(0);
    }
  };

  const handleCopyAddress = async (address: string, index: number) => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              💰 {payment.batch_count} Bénéficiaires
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatAmount(payment.amount)} {payment.token_symbol} chacun
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Liste des bénéficiaires */}
        <div className="overflow-y-auto max-h-96">
          {beneficiaries.map((beneficiary, index) => {
            const savedName = getBeneficiaryName(beneficiary.address);
            const displayName = savedName || beneficiary.name || truncateAddress(beneficiary.address);

            return (
              <div
                key={index}
                className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  {/* Info bénéficiaire */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 dark:text-blue-300 font-semibold">
                        {displayName[0].toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {displayName}
                      </h3>
                      <button
                        onClick={() => handleCopyAddress(beneficiary.address, index)}
                        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <span className="font-mono">{truncateAddress(beneficiary.address)}</span>
                        {copiedIndex === index ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Montant */}
                  <div className="text-right ml-4">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatAmount(getAmountAsBigInt(beneficiary.amount), payment.token_symbol === 'USDC' || payment.token_symbol === 'USDT' ? 6 : 18)} {payment.token_symbol}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total envoyé
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatAmount(totalAmount.toString())} {payment.token_symbol}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>📄 Contrat</span>
            <a
              href={`https://basescan.org/address/${payment.contract_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {truncateAddress(payment.contract_address)}
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}