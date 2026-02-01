// components/Dashboard/ExportButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';
import { useTransactionExport } from '@/hooks/useTransactionExport';

interface ExportButtonProps {
  payments: Payment[];
  userAddress: string;
  period: string;
  /** Intégré à la fin de la barre de recherche : même hauteur, style discret */
  variant?: 'default' | 'inline';
}

export function ExportButton({ payments, userAddress, period, variant = 'default' }: ExportButtonProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { isExporting, exportToCSV, exportToPDF } = useTransactionExport();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleExportCSV = () => {
    exportToCSV(payments, `confidance-crypto-${period}.csv`);
    setIsOpen(false);
  };

  const handleExportPDF = async () => {
    await exportToPDF(payments, userAddress, period);
    setIsOpen(false);
  };

  if (payments.length === 0) {
    return null; // Ne pas afficher si aucun paiement
  }

  const isInline = variant === 'inline';

  return (
    <div className={isInline ? 'relative flex-shrink-0' : 'relative'}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={
          isInline
            ? 'flex items-center gap-1.5 h-full min-h-[42px] px-3 border-l border-gray-300 rounded-r-lg bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            : 'flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        }
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {!isInline && (
          <span>{isExporting ? (isMounted && translationsReady ? t('dashboard.export.exporting') : 'Export...') : (isMounted && translationsReady ? t('dashboard.export.button') : 'Exporter')}</span>
        )}
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <>
          {/* Overlay pour fermer */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
            <button
              onClick={handleExportCSV}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 rounded-t-lg transition-colors"
            >
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="font-medium">{isMounted && translationsReady ? t('dashboard.export.csv.title') : 'Export CSV'}</p>
                <p className="text-xs text-gray-500">{isMounted && translationsReady ? t('dashboard.export.csv.description') : 'Pour Excel/comptabilité'}</p>
              </div>
            </button>

            <button
              onClick={handleExportPDF}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 rounded-b-lg transition-colors border-t border-gray-100"
            >
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-medium">{isMounted && translationsReady ? t('dashboard.export.pdf.title') : 'Export PDF'}</p>
                <p className="text-xs text-gray-500">{isMounted && translationsReady ? t('dashboard.export.pdf.description') : 'Pour impression/justificatif'}</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
