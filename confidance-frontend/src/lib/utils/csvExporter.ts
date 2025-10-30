// lib/utils/csvExporter.ts
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
 * Génère un fichier CSV des transactions
 */
export function generateCSV(transactions: TransactionForExport[]): string {
  const headers = [
    'Bénéficiaire',
    'Adresse',
    'Montant',
    'Token',
    'Date de libération',
    'Statut',
    'Contrat',
    'Transaction Hash',
  ];
  
  const rows = transactions.map(tx => [
    tx.beneficiaryName,
    tx.beneficiaryAddress,
    tx.amount,
    tx.tokenSymbol,
    tx.releaseDate,
    tx.status,
    tx.contractAddress,
    tx.txHash || 'N/A',
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  return csvContent;
}

/**
 * Télécharge un fichier CSV
 */
export function downloadCSV(csvContent: string, filename: string = 'transactions.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}