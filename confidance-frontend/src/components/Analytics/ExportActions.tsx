// components/Analytics/ExportActions.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';

interface ExportActionsProps {
  stats: MonthlyStats;
  userAddress: string;
}

export function ExportActions({ stats, userAddress }: ExportActionsProps) {
  const { t, i18n } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const dateLocale = ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN' } as Record<string, string>)[(i18n.language || 'en').split('-')[0]] || 'en-GB';

  const exportToCSV = () => {
    setIsExporting(true);

    try {
      // Headers CSV
      const headers = [
        t('analytics.export.csv.month'),
        t('analytics.export.csv.transactions'),
        t('analytics.export.csv.totalVolume'),
        t('analytics.export.csv.totalFees'),
        t('analytics.export.csv.ratio'),
        t('analytics.export.csv.gasFees'),
        t('analytics.export.csv.protocolFees'),
        t('analytics.export.csv.instant'),
        t('analytics.export.csv.scheduled'),
        t('analytics.export.csv.recurring')
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
      alert(t('analytics.export.csvError'));
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
      doc.text(t('analytics.export.pdf.title'), 14, 28);
      doc.text(`${t('analytics.export.pdf.period')} : ${stats.displayMonth}`, 14, 34);
      doc.text(`${t('analytics.export.pdf.wallet')} : ${userAddress}`, 14, 40);
      doc.text(`${t('analytics.export.pdf.generatedAt')} : ${new Date().toLocaleDateString(dateLocale)}`, 14, 46);

      // KPI Summary
      const summaryData = [
        [t('analytics.export.pdf.transactions'), stats.transactionCount.toString()],
        [t('analytics.export.pdf.totalVolume'), `${stats.totalVolumeFormatted} ETH`],
        [t('analytics.export.pdf.totalFees'), `${stats.totalFeesFormatted} ETH`],
        [t('analytics.export.pdf.realCost'), `${stats.feeRatio.toFixed(2)}%`]
      ];

      autoTable(doc, {
        startY: 55,
        head: [[t('analytics.export.pdf.indicator'), t('analytics.export.pdf.value')]],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 10 }
      });

      // Détail par type
      const typeData = [
        [`💰 ${t('analytics.export.pdf.instant')}`, stats.breakdown.instant.count, stats.breakdown.instant.volumeFormatted],
        [`⏰ ${t('analytics.export.pdf.scheduled')}`, stats.breakdown.scheduled.count, stats.breakdown.scheduled.volumeFormatted],
        [`🔄 ${t('analytics.export.pdf.recurring')}`, stats.breakdown.recurring.count, stats.breakdown.recurring.volumeFormatted]
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [[t('analytics.export.pdf.type'), t('analytics.export.pdf.count'), t('analytics.export.pdf.volumeEth')]],
        body: typeData,
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9 }
      });

      // Frais
      const feesData = [
        [t('analytics.export.pdf.gasFees'), `${stats.costs.gasFeesFormatted} ETH`, `${stats.costs.gasPercentage.toFixed(0)}%`],
        [t('analytics.export.pdf.protocolFees'), `${stats.costs.protocolFeesFormatted} ETH`, `${stats.costs.protocolPercentage.toFixed(0)}%`],
        ['TOTAL', `${stats.totalFeesFormatted} ETH`, '100%']
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [[t('analytics.export.pdf.feeType'), t('analytics.export.pdf.amount'), t('analytics.export.pdf.share')]],
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
          t('analytics.export.pdf.page', { page: i, total: pageCount }),
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Télécharger
      doc.save(`confidance-analytics-${stats.month}.pdf`);

    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert(t('analytics.export.pdfError'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.export.title')}</h3>
      
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
            <div className="font-semibold">{t('analytics.export.csvTitle')}</div>
            <div className="text-xs opacity-90">{t('analytics.export.csvSubtitle')}</div>
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
            <div className="font-semibold">{t('analytics.export.pdfTitle')}</div>
            <div className="text-xs opacity-90">{t('analytics.export.pdfSubtitle')}</div>
          </div>
        </button>
      </div>

      {isExporting && (
        <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('analytics.export.inProgress')}
        </div>
      )}
    </div>
  );
}
