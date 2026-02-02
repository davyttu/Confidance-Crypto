'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard, type Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { useTranslation } from 'react-i18next';

const ITEMS_PER_PAGE = 20;

// Convert token amount based on decimals
const formatTokenAmount = (amount: string, tokenSymbol: string) => {
  const rawAmount = parseFloat(amount);
  // USDC and most stablecoins use 6 decimals
  const decimals = tokenSymbol === 'USDC' || tokenSymbol === 'USDT' ? 6 : 18;
  return rawAmount / Math.pow(10, decimals);
};

// Smart decimal display based on amount size
const displayAmount = (amount: number, tokenSymbol: string) => {
  // For stablecoins, always 2 decimals
  if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') {
    return amount.toFixed(2);
  }

  // For ETH and other tokens, show more decimals for small amounts
  if (amount >= 1) return amount.toFixed(4);
  if (amount >= 0.01) return amount.toFixed(6);
  if (amount >= 0.0001) return amount.toFixed(8);
  return amount.toFixed(10);
};

export default function StatementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { address } = useAccount();
  const { isAuthenticated } = useAuth();
  const { payments, isLoading } = useDashboard();
  const { getBeneficiaryName } = useBeneficiaries();

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [wallets, setWallets] = useState<{ wallet_address: string; is_primary?: boolean }[]>([]);
  const [showWalletFilter, setShowWalletFilter] = useState(false);
  const [showMonthlySummary, setShowMonthlySummary] = useState(true);
  const [selectedCrypto, setSelectedCrypto] = useState<'all' | 'USDC' | 'USDT' | 'ETH'>('all');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch wallets
  useEffect(() => {
    const fetchWallets = async () => {
      if (!isAuthenticated) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/users/wallets`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) return;
        const data = await response.json();
        const fetchedWallets = data.wallets || [];
        setWallets(fetchedWallets);

        // Auto-select all wallets on first load
        if (fetchedWallets.length > 0) {
          setSelectedWallets(fetchedWallets.map((w: { wallet_address: string }) => w.wallet_address));
        }
      } catch (error) {
        console.error('Error fetching wallets:', error);
      }
    };

    fetchWallets();
  }, [API_URL, isAuthenticated]);

  // Generate available years and months
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    payments.forEach(payment => {
      const date = new Date(payment.release_time * 1000);
      years.add(date.getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [payments]);

  const availableMonths = useMemo(() => {
    return [
      { value: '1', label: 'Janvier' },
      { value: '2', label: 'Février' },
      { value: '3', label: 'Mars' },
      { value: '4', label: 'Avril' },
      { value: '5', label: 'Mai' },
      { value: '6', label: 'Juin' },
      { value: '7', label: 'Juillet' },
      { value: '8', label: 'Août' },
      { value: '9', label: 'Septembre' },
      { value: '10', label: 'Octobre' },
      { value: '11', label: 'Novembre' },
      { value: '12', label: 'Décembre' },
    ];
  }, []);

  // Calculate monthly summary for selected year with crypto breakdown
  const monthlySummary = useMemo(() => {
    if (selectedYear === 'all') return null;

    const year = parseInt(selectedYear);
    const summary = [];

    for (let month = 1; month <= 12; month++) {
      const monthTransactions = payments.filter(payment => {
        const date = new Date(payment.release_time * 1000);
        if (date.getFullYear() !== year) return false;
        if (date.getMonth() + 1 !== month) return false;

        // Filter by selected wallets
        if (selectedWallets.length > 0) {
          const payer = payment.payer_address?.toLowerCase();
          const payee = payment.payee_address?.toLowerCase();
          const targets = selectedWallets.map(w => w.toLowerCase());
          return targets.includes(payer || '') || targets.includes(payee || '');
        }

        return true;
      });

      // Calculate totals by crypto
      const cryptoTotals: Record<string, { debit: number; credit: number; balance: number }> = {};

      monthTransactions.forEach(payment => {
        const symbol = payment.token_symbol || 'UNKNOWN';
        if (!cryptoTotals[symbol]) {
          cryptoTotals[symbol] = { debit: 0, credit: 0, balance: 0 };
        }

        const amount = formatTokenAmount(payment.amount, payment.token_symbol);
        const isDebit = payment.payer_address?.toLowerCase() === address?.toLowerCase();

        if (isDebit) {
          cryptoTotals[symbol].debit += amount;
        } else {
          cryptoTotals[symbol].credit += amount;
        }
        cryptoTotals[symbol].balance = cryptoTotals[symbol].credit - cryptoTotals[symbol].debit;
      });

      summary.push({
        month,
        monthLabel: availableMonths[month - 1].label,
        cryptoTotals,
        transactionCount: monthTransactions.length,
      });
    }

    return summary;
  }, [payments, selectedYear, selectedWallets, address, availableMonths]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...payments];

    // Filter by wallet (multiple selection)
    if (selectedWallets.length > 0) {
      filtered = filtered.filter(payment => {
        const payer = payment.payer_address?.toLowerCase();
        const payee = payment.payee_address?.toLowerCase();
        const targets = selectedWallets.map(w => w.toLowerCase());
        return targets.includes(payer || '') || targets.includes(payee || '');
      });
    }

    // Filter by year
    if (selectedYear !== 'all') {
      filtered = filtered.filter(payment => {
        const date = new Date(payment.release_time * 1000);
        return date.getFullYear().toString() === selectedYear;
      });
    }

    // Filter by month
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(payment => {
        const date = new Date(payment.release_time * 1000);
        return (date.getMonth() + 1).toString() === selectedMonth;
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => b.release_time - a.release_time);
  }, [payments, selectedWallets, selectedYear, selectedMonth]);

  // Calculate totals by crypto
  const totalsByCrypto = useMemo(() => {
    const cryptoTotals: Record<string, { debit: number; credit: number; balance: number }> = {};

    filteredTransactions.forEach(payment => {
      const symbol = payment.token_symbol || 'UNKNOWN';
      if (!cryptoTotals[symbol]) {
        cryptoTotals[symbol] = { debit: 0, credit: 0, balance: 0 };
      }

      const amount = formatTokenAmount(payment.amount, payment.token_symbol);
      const isDebit = payment.payer_address?.toLowerCase() === address?.toLowerCase();

      if (isDebit) {
        cryptoTotals[symbol].debit += amount;
      } else {
        cryptoTotals[symbol].credit += amount;
      }
      cryptoTotals[symbol].balance = cryptoTotals[symbol].credit - cryptoTotals[symbol].debit;
    });

    return cryptoTotals;
  }, [filteredTransactions, address]);

  // Calculate displayed totals based on selected crypto
  const displayedTotals = useMemo(() => {
    if (selectedCrypto === 'all') {
      return totalsByCrypto;
    }

    const filtered = totalsByCrypto[selectedCrypto];
    return filtered ? { [selectedCrypto]: filtered } : {};
  }, [totalsByCrypto, selectedCrypto]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedYear, selectedWallets]);

  // Wallet selection handlers
  const toggleWallet = (walletAddress: string) => {
    setSelectedWallets(prev => {
      if (prev.includes(walletAddress)) {
        return prev.filter(w => w !== walletAddress);
      } else {
        return [...prev, walletAddress];
      }
    });
  };

  const toggleAllWallets = () => {
    if (selectedWallets.length === wallets.length) {
      setSelectedWallets([]);
    } else {
      setSelectedWallets(wallets.map(w => w.wallet_address));
    }
  };

  const isWalletSelected = (walletAddress: string) => {
    return selectedWallets.includes(walletAddress);
  };

  const allWalletsSelected = wallets.length > 0 && selectedWallets.length === wallets.length;

  // Download monthly statement
  const downloadMonthlyStatement = (month: number) => {
    if (!monthlySummary) return;

    const monthData = monthlySummary[month - 1];
    if (!monthData) return;
    const monthTransactions = payments.filter(payment => {
      const date = new Date(payment.release_time * 1000);
      if (date.getFullYear() !== parseInt(selectedYear)) return false;
      if (date.getMonth() + 1 !== month) return false;

      if (selectedWallets.length > 0) {
        const payer = payment.payer_address?.toLowerCase();
        const payee = payment.payee_address?.toLowerCase();
        const targets = selectedWallets.map(w => w.toLowerCase());
        return targets.includes(payer || '') || targets.includes(payee || '');
      }

      return true;
    }).sort((a, b) => b.release_time - a.release_time);

    // Generate CSV content
    let csvContent = `Relevé de Compte - ${monthData.monthLabel} ${selectedYear}\n`;
    csvContent += `Compte: ${formatWallet(address)}\n\n`;
    csvContent += `Date,Description,Débit,Crédit\n`;

    monthTransactions.forEach(payment => {
      const date = formatDate(payment.release_time);
      const description = getDescription(payment).replace(/,/g, ';');
      const amount = formatTokenAmount(payment.amount, payment.token_symbol);
      const debitAmount = isDebit(payment);

      csvContent += `${date},"${description}",`;
      csvContent += debitAmount ? `${displayAmount(amount, payment.token_symbol)} ${payment.token_symbol},` : `,`;
      csvContent += !debitAmount ? `${displayAmount(amount, payment.token_symbol)} ${payment.token_symbol}` : ``;
      csvContent += `\n`;
    });

    csvContent += `\n`;

    // Add totals by crypto for this month
    const monthCryptoTotals: Record<string, { debit: number; credit: number; balance: number }> = {};
    monthTransactions.forEach(payment => {
      const symbol = payment.token_symbol || 'UNKNOWN';
      if (!monthCryptoTotals[symbol]) {
        monthCryptoTotals[symbol] = { debit: 0, credit: 0, balance: 0 };
      }
      const amount = formatTokenAmount(payment.amount, payment.token_symbol);
      const isDebit = payment.payer_address?.toLowerCase() === address?.toLowerCase();
      if (isDebit) {
        monthCryptoTotals[symbol].debit += amount;
      } else {
        monthCryptoTotals[symbol].credit += amount;
      }
      monthCryptoTotals[symbol].balance = monthCryptoTotals[symbol].credit - monthCryptoTotals[symbol].debit;
    });

    Object.entries(monthCryptoTotals).forEach(([crypto, totals]) => {
      csvContent += `\nTotaux ${crypto}\n`;
      csvContent += `Total Débit,${displayAmount(totals.debit, crypto)} ${crypto}\n`;
      csvContent += `Total Crédit,${displayAmount(totals.credit, crypto)} ${crypto}\n`;
      csvContent += `Solde Net,${displayAmount(totals.balance, crypto)} ${crypto}\n`;
    });

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `releve_${selectedYear}_${month.toString().padStart(2, '0')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download annual summary
  const downloadAnnualSummary = () => {
    if (!monthlySummary) return;

    let csvContent = `Récapitulatif Annuel ${selectedYear}\n`;
    csvContent += `Compte: ${formatWallet(address)}\n\n`;

    // Get all cryptos present in the year
    const allCryptos = new Set<string>();
    monthlySummary.forEach(item => {
      Object.keys(item.cryptoTotals).forEach(crypto => allCryptos.add(crypto));
    });
    const cryptoList = Array.from(allCryptos).sort();

    // Header
    csvContent += `Mois,Transactions`;
    cryptoList.forEach(crypto => {
      csvContent += `,Débit ${crypto},Crédit ${crypto},Solde ${crypto}`;
    });
    csvContent += `\n`;

    // Data rows
    monthlySummary.forEach(item => {
      csvContent += `${item.monthLabel},${item.transactionCount}`;
      cryptoList.forEach(crypto => {
        const totals = item.cryptoTotals[crypto] || { debit: 0, credit: 0, balance: 0 };
        csvContent += `,${displayAmount(totals.debit, crypto)},${displayAmount(totals.credit, crypto)},${displayAmount(totals.balance, crypto)}`;
      });
      csvContent += `\n`;
    });

    // Total row
    const totalTransactions = monthlySummary.reduce((sum, item) => sum + item.transactionCount, 0);
    csvContent += `\nTOTAL ANNÉE,${totalTransactions}`;

    cryptoList.forEach(crypto => {
      let debit = 0, credit = 0, balance = 0;
      monthlySummary.forEach(item => {
        const totals = item.cryptoTotals[crypto];
        if (totals) {
          debit += totals.debit;
          credit += totals.credit;
          balance += totals.balance;
        }
      });
      csvContent += `,${displayAmount(debit, crypto)},${displayAmount(credit, crypto)},${displayAmount(balance, crypto)}`;
    });
    csvContent += `\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `recapitulatif_annuel_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated || !address) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600">Veuillez vous connecter pour accéder à votre relevé.</p>
        </div>
      </div>
    );
  }

  const formatWallet = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDescription = (payment: Payment) => {
    // Use label if available
    if (payment.payment_label || payment.label) {
      return payment.payment_label || payment.label;
    }

    // Use category if available
    const category = payment.payment_category || payment.category || payment.payment_categorie;
    if (category) {
      const categoryLabels: Record<string, string> = {
        housing: 'Logement',
        salary: 'Salaire',
        subscription: 'Abonnement',
        utilities: 'Services publics',
        services: 'Services',
        transfer: 'Transfert',
        other: 'Autre',
      };
      return categoryLabels[category] || category;
    }

    // Fallback : utiliser le nom du bénéficiaire si enregistré, sinon l'adresse tronquée
    const isDebit = payment.payer_address?.toLowerCase() === address?.toLowerCase();
    const beneficiaryName = isDebit ? getBeneficiaryName(payment.payee_address) : getBeneficiaryName(payment.payer_address);
    const displayTarget = beneficiaryName || (isDebit ? formatWallet(payment.payee_address) : formatWallet(payment.payer_address));
    return isDebit ? `Versement à ${displayTarget}` : `Reçu de ${displayTarget}`;
  };

  const isDebit = (payment: Payment) => {
    return payment.payer_address?.toLowerCase() === address?.toLowerCase();
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 pb-4 border-b-2 border-gray-900">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Relevé de Compte</h1>
              <p className="text-sm text-gray-600">
                Compte : {formatWallet(address)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Wallet Filter */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowWalletFilter(!showWalletFilter)}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-700">Portefeuilles</span>
                {selectedWallets.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {selectedWallets.length} sélectionné{selectedWallets.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showWalletFilter ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showWalletFilter && (
              <div className="mt-4 space-y-2">
                {/* Select All button */}
                <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                  <button
                    onClick={toggleAllWallets}
                    className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                      allWalletsSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {allWalletsSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm font-medium text-gray-900">
                    Tous les portefeuilles
                  </span>
                </div>

                {/* Individual wallets */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {wallets.map(wallet => (
                    <div
                      key={wallet.wallet_address}
                      className="flex items-center gap-3 p-2 hover:bg-white rounded transition-colors cursor-pointer"
                      onClick={() => toggleWallet(wallet.wallet_address)}
                    >
                      <div
                        className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                          isWalletSelected(wallet.wallet_address)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {isWalletSelected(wallet.wallet_address) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-mono text-gray-900">
                          {formatWallet(wallet.wallet_address)}
                        </span>
                        {wallet.is_primary && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {wallets.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Aucun portefeuille enregistré
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Date Filters */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-gray-700">Période</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Year filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Année
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">Toutes les années</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Month filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Mois
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={selectedYear === 'all'}
                >
                  <option value="all">Tous les mois</option>
                  {availableMonths.map(month => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Monthly Summary Info Banner */}
        {selectedYear === 'all' && availableYears.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">
                Sélectionnez une année pour accéder au récapitulatif mensuel et télécharger vos relevés
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        ) : selectedWallets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-gray-600 font-medium mb-1">Aucun portefeuille sélectionné</p>
            <p className="text-sm text-gray-500">Veuillez sélectionner au moins un portefeuille pour afficher les transactions</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 rounded-lg">
            <p className="text-gray-600">Aucune transaction pour cette période</p>
          </div>
        ) : (
          <>
            {/* Transaction Table */}
            <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900 text-white text-left">
                    <th className="px-4 py-3 text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-sm font-semibold">Description</th>
                    <th className="px-4 py-3 text-sm font-semibold text-right">Débit</th>
                    <th className="px-4 py-3 text-sm font-semibold text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((payment, index) => {
                    const debitAmount = isDebit(payment);
                    const amount = formatTokenAmount(payment.amount, payment.token_symbol);

                    return (
                      <tr
                        key={`${payment.id}-${index}`}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatDate(payment.release_time)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {getDescription(payment)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {debitAmount ? (
                            <span className="text-red-600">
                              -{displayAmount(amount, payment.token_symbol)} {payment.token_symbol}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {!debitAmount ? (
                            <span className="text-green-600">
                              +{displayAmount(amount, payment.token_symbol)} {payment.token_symbol}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mb-6 px-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>

                <span className="text-sm text-gray-600">
                  Page {currentPage} sur {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Totals */}
            <div className="border-t-2 border-gray-900 pt-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-lg">Solde de la période</h3>

                  {/* Crypto Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Crypto:</span>
                    <select
                      value={selectedCrypto}
                      onChange={(e) => setSelectedCrypto(e.target.value as 'all' | 'USDC' | 'USDT' | 'ETH')}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="all">Toutes</option>
                      {Object.keys(totalsByCrypto).sort().map(crypto => (
                        <option key={crypto} value={crypto}>{crypto}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Display totals for each crypto */}
                <div className="space-y-4">
                  {Object.entries(displayedTotals).map(([crypto, totals]) => (
                    <div key={crypto} className="space-y-3 pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                      {selectedCrypto === 'all' && (
                        <div className="text-sm font-semibold text-gray-700 mb-2">{crypto}</div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Débit</span>
                        <span className="text-lg font-mono text-red-600">
                          -{displayAmount(totals.debit, crypto)} {crypto}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Crédit</span>
                        <span className="text-lg font-mono text-green-600">
                          +{displayAmount(totals.credit, crypto)} {crypto}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                        <span className="font-semibold text-gray-900">Solde Net</span>
                        <span className={`text-xl font-bold font-mono ${
                          totals.balance >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {totals.balance >= 0 ? '+' : ''}{displayAmount(totals.balance, crypto)} {crypto}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  {filteredTransactions.length} transaction(s) sur la période
                </p>
              </div>
            </div>
          </>
        )}

        {/* Récapitulatif Mensuel - en bas de page avant le footer */}
        {monthlySummary && selectedYear !== 'all' && (
          <div className="mt-8 mb-6">
            <div
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-lg shadow-md flex items-center justify-between group cursor-pointer"
              onClick={() => setShowMonthlySummary(!showMonthlySummary)}
            >
              <div className="flex items-center gap-3 flex-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <div className="text-left">
                  <div className="font-bold text-lg">Récapitulatif Mensuel {selectedYear}</div>
                  <div className="text-sm text-blue-100">Vue comptable détaillée par mois</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showMonthlySummary && monthlySummary && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadAnnualSummary(); }}
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    title="Télécharger le récapitulatif annuel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium">Export CSV</span>
                  </button>
                )}
                <svg
                  className={`w-6 h-6 transition-transform ${showMonthlySummary ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {showMonthlySummary && (
              <div className="mt-4 bg-white border-2 border-gray-900 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-900 text-white px-4 py-3">
                  <h3 className="font-bold text-sm">Détail mensuel {selectedYear}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-900 bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-900">Mois</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-900">Transactions</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-900">Débit</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-900">Crédit</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-900">Solde</th>
                        <th className="px-4 py-2 text-center text-xs font-bold text-gray-900">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.map((item) => (
                        <tr
                          key={item.month}
                          className={`border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${
                            selectedMonth === item.month.toString() ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedMonth(item.month.toString())}
                        >
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.monthLabel}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600">
                            {item.transactionCount > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-2 bg-gray-200 rounded-full text-xs font-semibold">
                                {item.transactionCount}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-mono">
                            {Object.keys(item.cryptoTotals).length > 0 ? (
                              <div className="space-y-0.5">
                                {Object.entries(item.cryptoTotals).map(([crypto, totals]) =>
                                  totals.debit > 0 ? (
                                    <div key={crypto} className="text-red-600 text-xs">
                                      -{displayAmount(totals.debit, crypto)} {crypto}
                                    </div>
                                  ) : null
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-mono">
                            {Object.keys(item.cryptoTotals).length > 0 ? (
                              <div className="space-y-0.5">
                                {Object.entries(item.cryptoTotals).map(([crypto, totals]) =>
                                  totals.credit > 0 ? (
                                    <div key={crypto} className="text-green-600 text-xs">
                                      +{displayAmount(totals.credit, crypto)} {crypto}
                                    </div>
                                  ) : null
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-mono font-semibold">
                            {Object.keys(item.cryptoTotals).length > 0 ? (
                              <div className="space-y-0.5">
                                {Object.entries(item.cryptoTotals).map(([crypto, totals]) => (
                                  <div
                                    key={crypto}
                                    className={`text-xs ${totals.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}
                                  >
                                    {totals.balance >= 0 ? '+' : ''}{displayAmount(totals.balance, crypto)} {crypto}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {item.transactionCount > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadMonthlyStatement(item.month);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                                title={`Télécharger le relevé de ${item.monthLabel}`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                CSV
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-900 bg-gray-100">
                      <tr>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL ANNÉE</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                          {monthlySummary.reduce((sum, item) => sum + item.transactionCount, 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                          {Object.keys(
                            monthlySummary.reduce((acc, item) => {
                              Object.entries(item.cryptoTotals).forEach(([crypto, totals]) => {
                                if (!acc[crypto]) acc[crypto] = { debit: 0, credit: 0, balance: 0 };
                                acc[crypto].debit += totals.debit;
                                acc[crypto].credit += totals.credit;
                                acc[crypto].balance += totals.balance;
                              });
                              return acc;
                            }, {} as Record<string, { debit: number; credit: number; balance: number }>)
                          ).length > 0 ? (
                            <div className="space-y-0.5">
                              {Object.entries(
                                monthlySummary.reduce((acc, item) => {
                                  Object.entries(item.cryptoTotals).forEach(([crypto, totals]) => {
                                    if (!acc[crypto]) acc[crypto] = { debit: 0, credit: 0, balance: 0 };
                                    acc[crypto].debit += totals.debit;
                                    acc[crypto].credit += totals.credit;
                                    acc[crypto].balance += totals.balance;
                                  });
                                  return acc;
                                }, {} as Record<string, { debit: number; credit: number; balance: number }>)
                              ).map(([crypto, totals]) =>
                                totals.debit > 0 ? (
                                  <div key={crypto} className="text-red-600 text-xs">
                                    -{displayAmount(totals.debit, crypto)} {crypto}
                                  </div>
                                ) : null
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                          {Object.keys(
                            monthlySummary.reduce((acc, item) => {
                              Object.entries(item.cryptoTotals).forEach(([crypto, totals]) => {
                                if (!acc[crypto]) acc[crypto] = { debit: 0, credit: 0, balance: 0 };
                                acc[crypto].debit += totals.debit;
                                acc[crypto].credit += totals.credit;
                                acc[crypto].balance += totals.balance;
                              });
                              return acc;
                            }, {} as Record<string, { debit: number; credit: number; balance: number }>)
                          ).length > 0 ? (
                            <div className="space-y-0.5">
                              {Object.entries(
                                monthlySummary.reduce((acc, item) => {
                                  Object.entries(item.cryptoTotals).forEach(([crypto, totals]) => {
                                    if (!acc[crypto]) acc[crypto] = { debit: 0, credit: 0, balance: 0 };
                                    acc[crypto].debit += totals.debit;
                                    acc[crypto].credit += totals.credit;
                                    acc[crypto].balance += totals.balance;
                                  });
                                  return acc;
                                }, {} as Record<string, { debit: number; credit: number; balance: number }>)
                              ).map(([crypto, totals]) =>
                                totals.credit > 0 ? (
                                  <div key={crypto} className="text-green-600 text-xs">
                                    +{displayAmount(totals.credit, crypto)} {crypto}
                                  </div>
                                ) : null
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                          <div className="space-y-0.5">
                            {Object.entries(
                              monthlySummary.reduce((acc, item) => {
                                Object.entries(item.cryptoTotals).forEach(([crypto, totals]) => {
                                  if (!acc[crypto]) acc[crypto] = { debit: 0, credit: 0, balance: 0 };
                                  acc[crypto].debit += totals.debit;
                                  acc[crypto].credit += totals.credit;
                                  acc[crypto].balance += totals.balance;
                                });
                                return acc;
                              }, {} as Record<string, { debit: number; credit: number; balance: number }>)
                            ).map(([crypto, totals]) => (
                              <div
                                key={crypto}
                                className={`text-xs ${totals.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}
                              >
                                {totals.balance >= 0 ? '+' : ''}{displayAmount(totals.balance, crypto)} {crypto}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-600">-</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="bg-gray-50 px-4 py-2 text-xs text-gray-600 border-t border-gray-200 flex items-center justify-between">
                  <span>Cliquez sur un mois pour filtrer les transactions</span>
                  <span className="text-gray-500">• CSV : télécharger le relevé détaillé du mois</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
