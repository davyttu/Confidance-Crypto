// src/app/dashboard/links/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';

export default function DashboardLinksPage() {
  const { t, ready } = useTranslation();
  const { address, isConnected } = useAccount();
  const { listLinks, isLoading } = usePaymentLinks();
  const [links, setLinks] = useState<any[]>([]);

  useEffect(() => {
    if (!address) return;
    listLinks(address)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [address, listLinks]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-2xl font-bold">
            {ready ? t('wallet.connectionRequired') : 'Connexion requise'}
          </h2>
          <p className="text-gray-600">
            {ready ? t('wallet.connectToAccess') : 'Connectez votre wallet pour accéder à cette page'}
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

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {isLoading ? (
            <div className="text-gray-600">{ready ? t('dashboard.loading') : 'Chargement...'}</div>
          ) : links.length === 0 ? (
            <div className="text-gray-600">{ready ? t('links.dashboard.empty') : 'Aucun lien de paiement'}</div>
          ) : (
            <div className="space-y-4">
              {links.map((link) => {
                const shareUrl = `${baseUrl}/pay/${link.id}`;
                return (
                  <div key={link.id} className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">
                        {ready ? t('links.dashboard.status') : 'Statut'}: <span className="font-semibold">{ready ? t(`links.status.${link.status}`) : link.status}</span>
                      </div>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
