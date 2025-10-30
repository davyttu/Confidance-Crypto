// hooks/useTransactionExport.ts
'use client';

import { useState } from 'react';
import { Payment } from './useDashboard';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { formatDate } from '@/lib/utils/dateFormatter';
import { generateCSV, downloadCSV } from '@/lib/utils/csvExporter';
import { generatePDF } from '@/lib/utils/pdfExporter';

interface UseTransactionExportReturn {
  isExporting: boolean;
  error: Error | null;
  exportToCSV: (payments: Payment[], filename?: string) => void;
  exportToPDF: (payments: Payment[], userAddress: string, period: string) => Promise<void>;
}

export function useTransactionExport(): UseTransactionExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const prepareTransactionsForExport = (payments: Payment[]) => {
    return payments.map(payment => ({
      beneficiaryName: payment.payee_address, // Sera remplacé par le nom si dispo
      beneficiaryAddress: payment.payee_address,
      amount: formatAmount(payment.amount),
      tokenSymbol: payment.token_symbol,
      releaseDate: formatDate(payment.release_time),
      status: getStatusLabel(payment.status),
      contractAddress: payment.contract_address,
      txHash: payment.tx_hash || payment.transaction_hash || undefined,
    }));
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending': return 'En cours';
      case 'released': return 'Exécuté';
      case 'cancelled': return 'Annulé';
      case 'failed': return 'Échoué';
      default: return status;
    }
  };

  const exportToCSV = (payments: Payment[], filename?: string) => {
    try {
      setIsExporting(true);
      setError(null);

      const transactions = prepareTransactionsForExport(payments);
      const csvContent = generateCSV(transactions);
      
      const finalFilename = filename || `confidance-crypto-${Date.now()}.csv`;
      downloadCSV(csvContent, finalFilename);
    } catch (err) {
      console.error('Erreur export CSV:', err);
      setError(err as Error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async (
    payments: Payment[],
    userAddress: string,
    period: string
  ) => {
    try {
      setIsExporting(true);
      setError(null);

      const transactions = prepareTransactionsForExport(payments);
      await generatePDF(transactions, userAddress, period);
    } catch (err) {
      console.error('Erreur export PDF:', err);
      setError(err as Error);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    error,
    exportToCSV,
    exportToPDF,
  };
}