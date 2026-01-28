// src/app/dashboard/links/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Trash2 } from 'lucide-react';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import { CATEGORY_ICONS, CATEGORY_LABELS, type PaymentCategory } from '@/types/payment-identity';

export default function DashboardLinksPage() {
  const { t, ready, i18n } = useTranslation();
  const { address, isConnected } = useAccount();
  const { listLinks, deleteLink, isLoading } = usePaymentLinks();
  const [links, setLinks] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | PaymentCategory>('all');
  const [linkToDelete, setLinkToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const currentLang = (i18n?.language?.split('-')[0] || 'en') as 'en' | 'fr' | 'es' | 'ru' | 'zh';
  const categories: PaymentCategory[] = [
    'housing',
    'salary',
    'subscription',
    'utilities',
    'services',
    'transfer',
    'other',
  ];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    listLinks(address)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [address, listLinks]);

  const handleConfirmDelete = async () => {
    if (!linkToDelete || !address) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLink(linkToDelete.id, address);
      setLinks((prev) => prev.filter((item) => item.id !== linkToDelete.id));
      setLinkToDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete link';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const filteredLinks = useMemo(() => {
    if (selectedCategory === 'all') return links;
    return links.filter((link) => {
      const rawCategory = link.payment_categorie || link.payment_category || null;
      return rawCategory === selectedCategory;
    });
  }, [links, selectedCategory]);

  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    released: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  const monthSeconds =
    process.env.NEXT_PUBLIC_CHAIN === 'base_sepolia' ? 300 : 2592000;
  const deriveStatus = (link: any) => {
    const baseStatus = link.status as string;
    if (baseStatus === 'cancelled' || baseStatus === 'expired') return baseStatus;
    const now = Math.floor(Date.now() / 1000);
    if (link.payment_type === 'instant') {
      if (baseStatus === 'paid') return 'paid';
      return link.payer_address ? 'paid' : baseStatus;
    }
    if (link.payment_type === 'scheduled') {
      if (typeof link.execute_at === 'number' && link.execute_at <= now) {
        return 'released';
      }
      return baseStatus;
    }
    if (link.payment_type === 'recurring') {
      if (typeof link.start_at === 'number' && link.periods) {
        const endAt = link.start_at + (Number(link.periods) * monthSeconds);
        if (now >= endAt) return 'completed';
      }
      return baseStatus;
    }
    return baseStatus;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-2xl font-bold">
            {isMounted && ready ? t('wallet.connectionRequired') : 'Connexion requise'}
          </h2>
          <p className="text-gray-600">
            {isMounted && ready ? t('wallet.connectToAccess') : 'Connectez votre wallet pour accéder à cette page'}
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {ready ? t('links.dashboard.title') : 'Mes liens de paiement'}
          </h1>
        </div>
        <div className="mb-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {ready
              ? t('links.dashboard.hint', {
                  defaultValue:
                    'Once a payment is validated, you can find it directly in your dashboard.',
                })
              : 'Once a payment is validated, you can find it directly in your dashboard.'}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {isLoading ? (
            <div className="text-gray-600">{ready ? t('dashboard.loading') : 'Chargement...'}</div>
          ) : links.length === 0 ? (
            <div className="text-gray-600">{ready ? t('links.dashboard.empty') : 'Aucun lien de paiement'}</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">
                  {ready ? t('links.dashboard.filter.label') : 'Filter by category'}:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {ready ? t('links.dashboard.filter.all') : 'All'}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedCategory === cat
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <span>{CATEGORY_ICONS[cat]}</span>
                    <span>{CATEGORY_LABELS[cat][currentLang]}</span>
                  </button>
                ))}
              </div>

              {filteredLinks.length === 0 ? (
                <div className="text-gray-600">{ready ? t('links.dashboard.empty') : 'Aucun lien de paiement'}</div>
              ) : (
                filteredLinks.map((link) => {
                const shareUrl = `${baseUrl}/pay/${link.id}`;
                const displayStatus = deriveStatus(link);
                const rawCategory = link.payment_categorie || link.payment_category || null;
                const categoryKey =
                  rawCategory && rawCategory in CATEGORY_LABELS
                    ? (rawCategory as PaymentCategory)
                    : null;
                const categoryLabel = categoryKey
                  ? CATEGORY_LABELS[categoryKey][currentLang]
                  : rawCategory;
                const categoryIcon = categoryKey ? CATEGORY_ICONS[categoryKey] : '🏷️';
                return (
                  <div key={link.id} className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">
                        {ready ? t('links.dashboard.status') : 'Statut'}:{' '}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            statusStyles[displayStatus] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {ready
                            ? t(`links.status.${displayStatus}`, {
                                defaultValue: String(displayStatus).toUpperCase(),
                              })
                            : String(displayStatus).toUpperCase()}
                        </span>
                      </div>
                      {(link.payment_label || categoryLabel) && (
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <div className="text-base font-semibold text-gray-900">
                            {link.payment_label || (ready ? t('links.dashboard.unnamed') : 'Unnamed payment')}
                          </div>
                          {categoryLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2.5 py-1 text-xs font-medium">
                              <span>{categoryIcon}</span>
                              <span>{categoryLabel}</span>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-lg font-semibold text-gray-900">
                        {link.amount} {link.token_symbol} · {link.payment_type}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ready ? t('links.dashboard.created') : 'Créé le'}{' '}
                        {new Date(link.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="w-64 max-w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(shareUrl)}
                        className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm"
                      >
                        {ready ? t('links.dashboard.copy') : 'Copier'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkToDelete(link)}
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"
                        title={ready ? t('links.dashboard.delete') : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              }))}
            </div>
          )}
        </div>
      </div>
      {linkToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLinkToDelete(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {ready ? t('links.dashboard.deleteTitle') : 'Delete payment link'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {ready
                ? t('links.dashboard.deleteDescription')
                : 'This link will be removed from your history. This action cannot be undone.'}
            </p>
            {deleteError && (
              <p className="mt-3 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkToDelete(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700"
              >
                {ready ? t('links.dashboard.deleteCancel') : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-60"
              >
                {isDeleting
                  ? (ready ? t('links.dashboard.deleting') : 'Deleting...')
                  : (ready ? t('links.dashboard.deleteConfirm') : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
