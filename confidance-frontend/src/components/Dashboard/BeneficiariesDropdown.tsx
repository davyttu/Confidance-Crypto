// components/Dashboard/BeneficiariesDropdown.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Edit2 } from 'lucide-react';
import { Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';

interface BeneficiariesDropdownProps {
  payment: Payment;
  onRename: (address: string) => void;
}

export function BeneficiariesDropdown({ payment, onRename }: BeneficiariesDropdownProps) {
  const { t, i18n } = useTranslation();
  const { getBeneficiaryName } = useBeneficiaries();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gérer l'ouverture/fermeture avec délai pour éviter les fermetures accidentelles
  const handleMouseEnter = () => {
    // Annuler tout timeout de fermeture en cours
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Ajouter un délai avant de fermer pour permettre à l'utilisateur de déplacer sa souris
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200); // 200ms de délai
  };

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
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
  if (additionalCount === 0) {
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

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {mainBeneficiaryName || t('beneficiary.unnamed')}
            </div>
            {/* Badge +X */}
            <div className="relative">
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-semibold cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors">
                +{additionalCount}
              </span>

              {/* Dropdown */}
              {isOpen && (
                <div 
                  className="absolute left-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden transition-all duration-200 ease-out pointer-events-auto"
                >
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      {additionalCount + 1} Bénéficiaire{additionalCount > 0 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {beneficiaries.map((beneficiary, index) => {
                      const name = getBeneficiaryName(beneficiary.address);
                      const isCopied = copiedAddress === beneficiary.address;
                      
                      return (
                        <div
                          key={beneficiary.address}
                          className="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors last:border-b-0 group/item"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {name || `${t('beneficiary.beneficiary')} ${index + 1}`}
                                </div>
                                {beneficiary.isMain && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                                    {t('beneficiary.main')}
                                  </span>
                                )}
                              </div>
                              <div 
                                className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                onClick={() => copyToClipboard(beneficiary.address)}
                                title={t('beneficiary.clickToCopy')}
                              >
                                {beneficiary.address}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 font-medium">
                                {formatAmount(beneficiary.amount, payment.token_symbol || 'ETH')} {payment.token_symbol || 'ETH'}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => copyToClipboard(beneficiary.address)}
                              className="flex-shrink-0 p-2 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group/button"
                              title={isCopied ? t('beneficiary.copied') : t('beneficiary.copyAddress')}
                            >
                              {isCopied ? (
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400 group-hover/button:text-purple-600 dark:group-hover/button:text-purple-400 transition-colors" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
                title="Renommer"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

