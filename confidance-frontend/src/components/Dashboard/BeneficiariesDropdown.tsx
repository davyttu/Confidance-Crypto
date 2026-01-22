// components/Dashboard/BeneficiariesDropdown.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Edit2, ChevronDown, X } from 'lucide-react';
import { Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';

interface BeneficiariesDropdownProps {
  payment: Payment;
  onRename: (address: string) => void;
  showBatchControls?: boolean;
}

export function BeneficiariesDropdown({
  payment,
  onRename,
  showBatchControls = true,
}: BeneficiariesDropdownProps) {
  const { t, i18n } = useTranslation();
  const { getBeneficiaryName } = useBeneficiaries();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      const clickedPopup = popupRef.current && popupRef.current.contains(target);
      if (!clickedDropdown && !clickedPopup) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Obtenir tous les bénéficiaires (principal + batch)
  const getAllBeneficiaries = (): Array<{ address: string; amount: string | number; isMain: boolean }> => {
    const beneficiaries: Array<{ address: string; amount: string | number; isMain: boolean }> = [];

    // Pour les paiements batch, utiliser les montants depuis batch_beneficiaries
    if (payment.is_batch && payment.batch_beneficiaries && payment.batch_beneficiaries.length > 0) {
      payment.batch_beneficiaries.forEach((batchBeneficiary, index) => {
        // Le premier bénéficiaire est considéré comme principal
        const isMain = batchBeneficiary.address.toLowerCase() === payment.payee_address.toLowerCase() || index === 0;
        beneficiaries.push({
          address: batchBeneficiary.address,
          amount: batchBeneficiary.amount, // ✅ Utiliser le montant individuel depuis batch_beneficiaries
          isMain: isMain,
        });
      });
    } else {
      // Pour les paiements simples, utiliser le bénéficiaire principal
      beneficiaries.push({
        address: payment.payee_address,
        amount: payment.amount,
        isMain: true,
      });
    }

    return beneficiaries;
  };

  const beneficiaries = getAllBeneficiaries();
  const additionalCount = beneficiaries.length - 1; // Nombre de bénéficiaires supplémentaires

  // Copier dans le presse-papier
  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Si un seul bénéficiaire, pas besoin du dropdown
  if (additionalCount === 0 || !showBatchControls) {
    const beneficiaryName = getBeneficiaryName(payment.payee_address);
    const isCopied = copiedAddress === payment.payee_address;
    return (
      <div className="flex items-center gap-2">
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {beneficiaryName || t('beneficiary.unnamed')}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {payment.payee_address.slice(0, 6)}...{payment.payee_address.slice(-4)}
          </div>
        </div>
        <button
          onClick={() => copyToClipboard(payment.payee_address)}
          className="flex-shrink-0 p-2 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          title={isCopied ? t('beneficiary.copied') : t('beneficiary.copyAddress')}
        >
          {isCopied ? (
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors" />
          )}
        </button>
        {!beneficiaryName && (
          <button
            onClick={() => onRename(payment.payee_address)}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title={t('beneficiary.rename')}
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Formater le montant avec la locale actuelle
  const formatAmount = (amount: string | number, symbol: string) => {
    // Mapper les langues i18n vers les locales de formatage
    const localeMap: Record<string, string> = {
      'fr': 'fr-FR',
      'en': 'en-GB',
      'es': 'es-ES',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
    };
    const currentLang = i18n.language || 'fr';
    const baseLang = currentLang.split('-')[0];
    const locale = localeMap[baseLang] || localeMap['en'];
    
    // Si c'est déjà un nombre, le retourner formaté
    if (typeof amount === 'number') {
      return amount.toLocaleString(locale, {
        minimumFractionDigits: symbol === 'ETH' ? 4 : 2,
        maximumFractionDigits: symbol === 'ETH' ? 4 : 2,
      });
    }

    // Vérifier si c'est un nombre décimal (contient un point ou une virgule)
    const isDecimal = amount.includes('.') || amount.includes(',');
    
    if (isDecimal) {
      // C'est déjà un nombre décimal formaté, le retourner tel quel
      const numValue = parseFloat(amount.replace(',', '.'));
      return numValue.toLocaleString(locale, {
        minimumFractionDigits: symbol === 'ETH' ? 4 : 2,
        maximumFractionDigits: symbol === 'ETH' ? 4 : 2,
      });
    }

    // Sinon, c'est probablement un BigInt (chaîne représentant un entier)
    try {
      const decimals = symbol === 'ETH' ? 18 : 6;
      const amountNum = Number(BigInt(amount)) / Math.pow(10, decimals);
      return amountNum.toLocaleString(locale, {
        minimumFractionDigits: symbol === 'ETH' ? 4 : 2,
        maximumFractionDigits: symbol === 'ETH' ? 4 : 2,
      });
    } catch (error) {
      // Si la conversion BigInt échoue, essayer de parser comme nombre
      const numValue = parseFloat(amount);
      return isNaN(numValue) ? '0' : numValue.toLocaleString(locale, {
        minimumFractionDigits: symbol === 'ETH' ? 4 : 2,
        maximumFractionDigits: symbol === 'ETH' ? 4 : 2,
      });
    }
  };

  const mainBeneficiary = beneficiaries[0];
  const mainBeneficiaryName = getBeneficiaryName(mainBeneficiary.address);

  const popup =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setIsOpen(false)}
          >
            <div
              ref={popupRef}
              className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 dark:border-gray-700 dark:from-purple-900/20 dark:to-blue-900/20">
                <div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {t('beneficiary.beneficiaries', { defaultValue: 'Beneficiaries' })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    {beneficiaries.length}{' '}
                    {beneficiaries.length === 1
                      ? t('beneficiary.beneficiary', { defaultValue: 'Beneficiary' })
                      : t('beneficiary.beneficiaries', { defaultValue: 'Beneficiaries' })}
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                  aria-label={t('create.modal.close', { defaultValue: 'Close' })}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {beneficiaries.map((beneficiary, index) => {
                  const name = getBeneficiaryName(beneficiary.address);
                  const isCopied = copiedAddress === beneficiary.address;

                  return (
                    <div
                      key={`${beneficiary.address}-${index}`}
                      className="border-b border-gray-100 p-3 last:border-b-0 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                              {name || `${t('beneficiary.beneficiary')} ${index + 1}`}
                            </div>
                            {beneficiary.isMain && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {t('beneficiary.main')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-mono">
                              {beneficiary.address}
                            </span>
                            <button
                              onClick={() => copyToClipboard(beneficiary.address)}
                              className="rounded-md p-1 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                              title={isCopied ? t('beneficiary.copied') : t('beneficiary.copyAddress')}
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-gray-400 transition-colors hover:text-purple-600 dark:hover:text-purple-400" />
                              )}
                            </button>
                          </div>
                          <div className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {formatAmount(beneficiary.amount, payment.token_symbol || 'ETH')} {payment.token_symbol || 'ETH'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="flex items-start justify-between gap-3" ref={dropdownRef}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {mainBeneficiaryName || t('beneficiary.unnamed')}
            </div>
            {showBatchControls && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                +{additionalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {payment.payee_address.slice(0, 6)}...{payment.payee_address.slice(-4)}
            </div>
            <button
              onClick={() => copyToClipboard(payment.payee_address)}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              title={copiedAddress === payment.payee_address ? t('beneficiary.copied') : t('beneficiary.copyAddress')}
            >
              {copiedAddress === payment.payee_address ? (
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors" />
              )}
            </button>
            {!mainBeneficiaryName && (
              <button
                onClick={() => onRename(payment.payee_address)}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title={t('beneficiary.rename')}
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {showBatchControls && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex-shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            title={t('beneficiary.viewAll', { defaultValue: 'View beneficiaries' })}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
      {showBatchControls ? popup : null}
    </>
  );
}

