// components/Analytics/ExportActions.tsx
'use client';

import { useState } from 'react';
import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';

interface ExportActionsProps {
  stats: MonthlyStats;
  userAddress: string;
}

export function ExportActions({ stats, userAddress }: ExportActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    setIsExporting(true);

    try {
      // Headers CSV
      const headers = [
        'Mois',
        'Transactions',
        'Volume Total (ETH)',
        'Frais Totaux (ETH)',
        'Ratio %',
        'Frais Gaz (ETH)',
        'Frais Protocole (ETH)',
        'Paiements Instantanés',
        'Paiements Programmés',
        'Paiements Récurrents'
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
      alert('Erreur lors de l\'export CSV');
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
      doc.text('Rapport Analytics Mensuel', 14, 28);
      doc.text(`Période : ${stats.displayMonth}`, 14, 34);
      doc.text(`Wallet : ${userAddress}`, 14, 40);
      doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 46);

      // KPI Summary
      const summaryData = [
        ['Transactions', stats.transactionCount.toString()],
        ['Volume Total', `${stats.totalVolumeFormatted} ETH`],
        ['Frais Totaux', `${stats.totalFeesFormatted} ETH`],
        ['Coût Réel', `${stats.feeRatio.toFixed(2)}%`]
      ];

      autoTable(doc, {
        startY: 55,
        head: [['Indicateur', 'Valeur']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 10 }
      });

      // Détail par type
      const typeData = [
        ['💰 Instantanés', stats.breakdown.instant.count, stats.breakdown.instant.volumeFormatted],
        ['⏰ Programmés', stats.breakdown.scheduled.count, stats.breakdown.scheduled.volumeFormatted],
        ['🔄 Récurrents', stats.breakdown.recurring.count, stats.breakdown.recurring.volumeFormatted]
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Type', 'Nombre', 'Volume (ETH)']],
        body: typeData,
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9 }
      });

      // Frais
      const feesData = [
        ['Frais de Gaz', `${stats.costs.gasFeesFormatted} ETH`, `${stats.costs.gasPercentage.toFixed(0)}%`],
        ['Frais Protocole', `${stats.costs.protocolFeesFormatted} ETH`, `${stats.costs.protocolPercentage.toFixed(0)}%`],
        ['TOTAL', `${stats.totalFeesFormatted} ETH`, '100%']
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Type de Frais', 'Montant', 'Part']],
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
          `Page ${i} sur ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Télécharger
      doc.save(`confidance-analytics-${stats.month}.pdf`);

    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez installer jspdf et jspdf-autotable.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📥 Télécharger ce mois</h3>
      
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
            <div className="font-semibold">CSV - Comptabilité</div>
            <div className="text-xs opacity-90">Pour Excel/logiciels compta</div>
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
            <div className="font-semibold">PDF - Justificatif</div>
            <div className="text-xs opacity-90">Pour impression/archives</div>
          </div>
        </button>
      </div>

      {isExporting && (
        <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Export en cours...
        </div>
      )}
    </div>
  );
}
