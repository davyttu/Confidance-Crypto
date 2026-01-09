// components/Dashboard/TransactionTable.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';
import { TransactionRow } from './TransactionRow';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { EmailTransactionModal } from './EmailTransactionModal';

interface TransactionTableProps {
  payments: Payment[];
  onRename: (address: string) => void;
  onCancel: (payment: Payment) => void;
}

type SortField = 'beneficiary' | 'amount' | 'date' | 'status';
type SortDirection = 'asc' | 'desc';

export function TransactionTable({ payments, onRename, onCancel }: TransactionTableProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { getBeneficiaryName } = useBeneficiaries();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // State pour gérer le modal email
  const [emailModalPayment, setEmailModalPayment] = useState<Payment | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filtrer et trier les paiements
  const processedPayments = useMemo(() => {
    let filtered = payments;

    // Recherche
    if (searchTerm) {
      filtered = payments.filter(payment => {
        const beneficiaryName = getBeneficiaryName(payment.payee_address);
        const searchLower = searchTerm.toLowerCase();
        
        return (
          payment.payee_address.toLowerCase().includes(searchLower) ||
          (beneficiaryName && beneficiaryName.toLowerCase().includes(searchLower)) ||
          payment.contract_address.toLowerCase().includes(searchLower)
        );
      });
    }

    // Tri
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'beneficiary':
          const nameA = getBeneficiaryName(a.payee_address) || a.payee_address;
          const nameB = getBeneficiaryName(b.payee_address) || b.payee_address;
          comparison = nameA.localeCompare(nameB);
          break;

        case 'amount':
          comparison = Number(BigInt(a.amount) - BigInt(b.amount));
          break;

        case 'date':
          comparison = a.release_time - b.release_time;
          break;

        case 'status':
          const statusOrder = { pending: 1, released: 2, cancelled: 3, failed: 4 };
          comparison = statusOrder[a.status as keyof typeof statusOrder] - 
                      statusOrder[b.status as keyof typeof statusOrder];
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [payments, searchTerm, sortField, sortDirection, getBeneficiaryName]);

  // Pagination
  const totalPages = Math.ceil(processedPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayments = processedPayments.slice(startIndex, endIndex);

  // Gérer le tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Icône de tri
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Barre de recherche */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder={isMounted && translationsReady ? t('dashboard.table.search') : 'Rechercher par nom ou adresse...'}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Bénéficiaire */}
              <th
                onClick={() => handleSort('beneficiary')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.beneficiary') : 'Bénéficiaire'}
                  <SortIcon field="beneficiary" />
                </div>
              </th>
              
              {/* 🆕 BLOCKCHAIN */}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Blockchain
              </th>
              
              {/* Montant */}
              <th
                onClick={() => handleSort('amount')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.amount') : 'Montant'}
                  <SortIcon field="amount" />
                </div>
              </th>
              
              {/* 🆕 TYPE */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              
              {/* Date de libération */}
              <th
                onClick={() => handleSort('date')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.releaseDate') : 'Date de libération'}
                  <SortIcon field="date" />
                </div>
              </th>
              
              {/* Statut */}
              <th
                onClick={() => handleSort('status')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.status') : 'Statut'}
                  <SortIcon field="status" />
                </div>
              </th>
              
              {/* Contrat */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isMounted && translationsReady ? t('dashboard.table.contract') : 'Contrat'}
              </th>
              
              {/* Actions */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody>
            {currentPayments.map((payment) => (
              <TransactionRow
                key={payment.id}
                payment={payment}
                onRename={onRename}
                onCancel={onCancel}
                onEmailClick={(payment) => setEmailModalPayment(payment)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {isMounted && translationsReady ? t('dashboard.table.pagination', { start: startIndex + 1, end: Math.min(endIndex, processedPayments.length), total: processedPayments.length }) : `Affichage de ${startIndex + 1} à ${Math.min(endIndex, processedPayments.length)} sur ${processedPayments.length} paiements`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMounted && translationsReady ? t('dashboard.table.previous') : 'Précédent'}
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMounted && translationsReady ? t('dashboard.table.next') : 'Suivant'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Email */}
      {emailModalPayment && (
        <EmailTransactionModal
          payment={emailModalPayment}
          onClose={() => setEmailModalPayment(null)}
        />
      )}
    </div>
  );
}