'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { type Payment } from '@/hooks/useDashboard';
import { useMonthlyAnalytics } from '@/hooks/useMonthlyAnalytics';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { usePaymentTransactions } from '@/hooks/usePaymentTransactions';
import { useAuth } from '@/hooks/useAuth';
import { KPICards } from '@/components/Analytics/KPICards';
import { TransactionTypeTable } from '@/components/Analytics/TransactionTypeTable';
import { FeesBreakdown } from '@/components/Analytics/FeesBreakdown';
import { MonthlyComparison } from '@/components/Analytics/MonthlyComparison';
import { ExportActions } from '@/components/Analytics/ExportActions';

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const { priceUsd } = useEthUsdPrice();
  const { user, isAuthenticated } = useAuth();
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<Error | null>(null);
  const { transactions } = usePaymentTransactions(
    walletAddresses.length > 0 ? walletAddresses : address
  );
  const isProVerified = (user as any)?.proStatus === 'verified';
  const { monthlyData, currentMonth } = useMonthlyAnalytics(
    payments,
    priceUsd,
    transactions,
    isProVerified
  );
  useEffect(() => {
    const loadPayments = async () => {
      if (!address) {
        setPayments([]);
        setPaymentsLoading(false);
        return;
      }

      setPaymentsLoading(true);
      setPaymentsError(null);

      try {
        let addresses: string[] = [];
        if (isAuthenticated) {
          const token = localStorage.getItem('token');
          if (token) {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/wallets`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.ok) {
              const data = await response.json();
              addresses = (data.wallets || []).map((wallet: { wallet_address: string }) => wallet.wallet_address);
            }
          }
        }

        if (address) {
          addresses = Array.from(new Set([...addresses, address]));
        }

        setWalletAddresses(addresses);

        const responses = await Promise.all(
          addresses.map(async (wallet) => {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/${wallet}`
            );
            if (!res.ok) return [];
            const data = await res.json();
            return data.payments || [];
          })
        );

        const merged = responses.flat();
        const deduped = new Map<string, Payment>();
        merged.forEach((payment: Payment) => {
          const key =
            payment.id ||
            payment.contract_address ||
            payment.transaction_hash ||
            `${payment.payer_address}:${payment.payee_address}:${payment.release_time}:${payment.amount}`;
          if (!deduped.has(key)) {
            deduped.set(key, payment);
          }
        });

        setPayments(Array.from(deduped.values()));
      } catch (err) {
        console.error('Erreur chargement paiements analytics:', err);
        setPaymentsError(err as Error);
      } finally {
        setPaymentsLoading(false);
      }
    };

    loadPayments();
  }, [address, isAuthenticated]);
  
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyData.forEach((month) => {
      const year = Number(month.month.split('-')[0]);
      if (!Number.isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyData]);

  const monthsForSelectedYear = useMemo(() => {
    if (!selectedYear) return [];
    return monthlyData
      .filter((month) => Number(month.month.split('-')[0]) === selectedYear)
      .map((month) => Number(month.month.split('-')[1]))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => b - a);
  }, [monthlyData, selectedYear]);

  const selectedMonthKey = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null;
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  const activeMonth = selectedMonthKey
    ? monthlyData.find((month) => month.month === selectedMonthKey) || currentMonth
    : currentMonth;

  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (!selectedYear || monthsForSelectedYear.length === 0) return;
    if (!selectedMonth || !monthsForSelectedYear.includes(selectedMonth)) {
      setSelectedMonth(monthsForSelectedYear[0]);
    }
  }, [monthsForSelectedYear, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!currentMonth || selectedYear || selectedMonth) return;
    const [year, month] = currentMonth.month.split('-').map(Number);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
      setSelectedYear(year);
      setSelectedMonth(month);
    }
  }, [currentMonth, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!selectedYear || !selectedMonth) return;
    const storageKey = `analytics-period:${user?.id || address || 'guest'}`;
    const payload = { analytics_year: selectedYear, analytics_month: String(selectedMonth).padStart(2, '0') };
    localStorage.setItem(storageKey, JSON.stringify(payload));

    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('Erreur sauvegarde préférences analytics:', err);
    });
  }, [selectedYear, selectedMonth, user?.id, address]);

  useEffect(() => {
    const storageKey = `analytics-period:${user?.id || address || 'guest'}`;
    const fromLocal = localStorage.getItem(storageKey);
    if (fromLocal) {
      try {
        const parsed = JSON.parse(fromLocal);
        if (parsed?.analytics_year) setSelectedYear(Number(parsed.analytics_year));
        if (parsed?.analytics_month) setSelectedMonth(Number(parsed.analytics_month));
      } catch (err) {
        console.error('Erreur lecture préférences analytics (local):', err);
      }
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/preferences`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.preferences) return;
        const year = Number(data.preferences.analytics_year);
        const month = Number(data.preferences.analytics_month);
        if (!Number.isNaN(year)) setSelectedYear(year);
        if (!Number.isNaN(month)) setSelectedMonth(month);
      })
      .catch((err) => console.error('Erreur lecture préférences analytics (remote):', err));
  }, [user?.id, address]);

  // État vide - wallet non connecté
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Connectez votre wallet
            </h3>
            <p className="text-gray-600">
              Pour accéder à vos analytics, connectez d'abord votre wallet
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (paymentsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="grid grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Erreur
  if (paymentsError) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800">Erreur lors du chargement des données : {paymentsError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Pas de données
  if (!currentMonth || monthlyData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Analytics Mensuels</h1>
              <p className="text-gray-600">
                Analysez votre activité globale sur la plateforme
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled
              >
                <option value="" disabled>Mois</option>
              </select>
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled
              >
                <option value="" disabled>Année</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Aucune donnée disponible
            </h3>
            <p className="text-gray-600">
              Créez vos premiers paiements pour voir vos analytics
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* En-tête + Sélecteurs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Analytics Mensuels</h1>
            <p className="text-gray-600">
              Analysez votre activité globale sur la plateforme
            </p>
          </div>
          {monthlyData.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!selectedYear || monthsForSelectedYear.length === 0}
              >
                <option value="" disabled>Mois</option>
                {monthsForSelectedYear.map((month) => (
                  <option key={month} value={month}>
                    {new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2024, month - 1, 1))}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="" disabled>Année</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section A : KPI Cards */}
        <KPICards stats={activeMonth} />

        {/* Section C : Tableau par type */}
        <TransactionTypeTable stats={activeMonth} />

        {/* Section D : Décomposition frais */}
        <FeesBreakdown stats={activeMonth} />

        {/* Section E : Comparaison mensuelle */}
        {monthlyData.length > 1 && (
          <MonthlyComparison monthlyData={monthlyData} />
        )}

        {/* Section F : Export */}
        <ExportActions stats={activeMonth} userAddress={address || ''} />

      </div>
    </div>
  );
}
