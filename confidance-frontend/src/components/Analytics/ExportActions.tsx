// components/Analytics/ExportActions.tsx
'use client';

import { useState } from 'react';
import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';
import { useTranslationReady } from '@/hooks/useTranslationReady';

interface ExportActionsProps {
  stats: MonthlyStats;
  userAddress: string;
}

export function ExportActions({ stats, userAddress }: ExportActionsProps) {
  const { t, i18n } = useTranslationReady();
  const [isExporting, setIsExporting] = useState(false);
  const locale = i18n.language || 'en';

  const exportToCSV = () => {
    setIsExporting(true);

    try {
      // Headers CSV
      const headers = [
        t('analytics.export.csv.month', { defaultValue: 'Month' }),
        t('analytics.export.csv.transactions', { defaultValue: 'Transactions' }),
        t('analytics.export.csv.totalVolume', { defaultValue: 'Total Volume (ETH)' }),
        t('analytics.export.csv.totalFees', { defaultValue: 'Total Fees (ETH)' }),
        t('analytics.export.csv.ratio', { defaultValue: 'Ratio %' }),
        t('analytics.export.csv.gasFees', { defaultValue: 'Gas Fees (ETH)' }),
        t('analytics.export.csv.protocolFees', { defaultValue: 'Protocol Fees (ETH)' }),
        t('analytics.export.csv.instant', { defaultValue: 'Instant Payments' }),
        t('analytics.export.csv.scheduled', { defaultValue: 'Scheduled Payments' }),
        t('analytics.export.csv.recurring', { defaultValue: 'Recurring Payments' })
      ];

      // Données
      const row = [
        stats.displayMonth,
        stats.transactionCount.toString(),
        stats.totalVolumeFormatted,
        stats.totalFeesFormatted,
        stats.feeRatio.toFixed(2),
        stats.costs.gasFeesFormatted,
        stats.costs.protocolFeesFormatted,
        stats.breakdown.instant.count.toString(),
        stats.breakdown.scheduled.count.toString(),
        stats.breakdown.recurring.count.toString()
      ];

      // Créer CSV
      const csvContent = [
        headers.join(','),
        row.map(cell => `"${cell}"`).join(',')
      ].join('\n');

      // Télécharger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `confidance-analytics-${stats.month}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Erreur export CSV:', error);
      alert(t('analytics.export.csvError', { defaultValue: 'Error exporting CSV' }));
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);

    try {
      // Import dynamique de jsPDF
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();

      // En-tête
      doc.setFontSize(18);
      doc.text('Confidance Crypto', 14, 20);
      
      doc.setFontSize(11);
      doc.text(t('analytics.export.pdf.title', { defaultValue: 'Monthly Analytics Report' }), 14, 28);
      doc.text(`${t('analytics.export.pdf.period', { defaultValue: 'Period' })}: ${stats.displayMonth}`, 14, 34);
      doc.text(`${t('analytics.export.pdf.wallet', { defaultValue: 'Wallet' })}: ${userAddress}`, 14, 40);
      doc.text(
        `${t('analytics.export.pdf.generatedAt', { defaultValue: 'Generated on' })}: ${new Date().toLocaleDateString(locale)}`,
        14,
        46
      );

      // KPI Summary
      const summaryData = [
        [t('analytics.kpi.transactions', { defaultValue: 'Transactions' }), stats.transactionCount.toString()],
        [t('analytics.kpi.totalVolume', { defaultValue: 'Total Volume' }), `${stats.totalVolumeFormatted} ETH`],
        [t('analytics.kpi.totalFees', { defaultValue: 'Total Fees' }), `${stats.totalFeesFormatted} ETH`],
        [t('analytics.kpi.realCost', { defaultValue: 'Real Cost' }), `${stats.feeRatio.toFixed(2)}%`]
      ];

      autoTable(doc, {
        startY: 55,
        head: [[
          t('analytics.export.pdf.indicator', { defaultValue: 'Indicator' }),
          t('analytics.export.pdf.value', { defaultValue: 'Value' })
        ]],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 10 }
      });

      // Détail par type
      const typeData = [
        [`💰 ${t('analytics.types.instant', { defaultValue: 'Instant Payments' })}`, stats.breakdown.instant.count, stats.breakdown.instant.volumeFormatted],
        [`⏰ ${t('analytics.types.scheduled', { defaultValue: 'Scheduled Payments' })}`, stats.breakdown.scheduled.count, stats.breakdown.scheduled.volumeFormatted],
        [`🔄 ${t('analytics.types.recurring', { defaultValue: 'Recurring Payments' })}`, stats.breakdown.recurring.count, stats.breakdown.recurring.volumeFormatted]
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [[
          t('analytics.export.pdf.type', { defaultValue: 'Type' }),
          t('analytics.export.pdf.count', { defaultValue: 'Count' }),
          t('analytics.export.pdf.volumeEth', { defaultValue: 'Volume (ETH)' })
        ]],
        body: typeData,
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9 }
      });

      // Frais
      const feesData = [
        [t('analytics.fees.gas', { defaultValue: 'Gas Fees (Base Network)' }), `${stats.costs.gasFeesFormatted} ETH`, `${stats.costs.gasPercentage.toFixed(0)}%`],
        [t('analytics.fees.protocol', { defaultValue: 'Confidance Protocol Fees (1.79%)' }), `${stats.costs.protocolFeesFormatted} ETH`, `${stats.costs.protocolPercentage.toFixed(0)}%`],
        [t('analytics.table.total', { defaultValue: 'TOTAL' }), `${stats.totalFeesFormatted} ETH`, '100%']
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [[
          t('analytics.export.pdf.feeType', { defaultValue: 'Fee Type' }),
          t('analytics.export.pdf.amount', { defaultValue: 'Amount' }),
          t('analytics.export.pdf.share', { defaultValue: 'Share' })
        ]],
        body: feesData,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9 }
      });

      // Pied de page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          t('analytics.export.pdf.page', { defaultValue: 'Page {{page}} of {{total}}', page: i, total: pageCount }),
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Télécharger
      doc.save(`confidance-analytics-${stats.month}.pdf`);

    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert(t('analytics.export.pdfError', { defaultValue: 'Error exporting PDF. Please install jspdf and jspdf-autotable.' }));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('analytics.export.title', { defaultValue: '📥 Download this month' })}
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={exportToCSV}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-left">
            <div className="font-semibold">
              {t('analytics.export.csvTitle', { defaultValue: 'CSV - Accounting' })}
            </div>
            <div className="text-xs opacity-90">
              {t('analytics.export.csvSubtitle', { defaultValue: 'For Excel/accounting tools' })}
            </div>
          </div>
        </button>

        <button
          onClick={exportToPDF}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div className="text-left">
            <div className="font-semibold">
              {t('analytics.export.pdfTitle', { defaultValue: 'PDF - Statement' })}
            </div>
            <div className="text-xs opacity-90">
              {t('analytics.export.pdfSubtitle', { defaultValue: 'For printing/archives' })}
            </div>
          </div>
        </button>
      </div>

      {isExporting && (
        <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('analytics.export.inProgress', { defaultValue: 'Export in progress...' })}
        </div>
      )}
    </div>
  );
}
