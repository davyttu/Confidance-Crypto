// lib/utils/pdfExporter.ts
// Note: Nécessite l'installation de jspdf et jspdf-autotable
// npm install jspdf jspdf-autotable
// npm install --save-dev @types/jspdf

interface TransactionForExport {
  beneficiaryName: string;
  beneficiaryAddress: string;
  amount: string;
  tokenSymbol: string;
  releaseDate: string;
  status: string;
  contractAddress: string;
  txHash?: string;
}

/**
 * Génère un PDF des transactions
 * @requires jspdf et jspdf-autotable
 */
export async function generatePDF(
  transactions: TransactionForExport[],
  userAddress: string,
  period: string
): Promise<void> {
  // Import dynamique pour réduire le bundle
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  
  const doc = new jsPDF();
  
  // En-tête
  doc.setFontSize(18);
  doc.text('Confidance Crypto', 14, 20);
  
  doc.setFontSize(11);
  doc.text('Historique des paiements programmés', 14, 28);
  doc.text(`Période : ${period}`, 14, 34);
  doc.text(`Wallet : ${userAddress}`, 14, 40);
  doc.text(`Date d'export : ${new Date().toLocaleDateString('fr-FR')}`, 14, 46);
  
  // Tableau
  autoTable(doc, {
    startY: 55,
    head: [['Bénéficiaire', 'Montant', 'Date', 'Statut', 'Contrat']],
    body: transactions.map(tx => [
      tx.beneficiaryName,
      `${tx.amount} ${tx.tokenSymbol}`,
      tx.releaseDate,
      tx.status,
      tx.contractAddress.slice(0, 10) + '...' + tx.contractAddress.slice(-8),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [66, 66, 66] },
    styles: { fontSize: 9 },
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
  
  // Téléchargement
  doc.save(`confidance-crypto-${period}-${Date.now()}.pdf`);
}