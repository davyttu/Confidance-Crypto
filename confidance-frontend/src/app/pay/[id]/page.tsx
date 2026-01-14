// src/app/pay/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'viem';
import { useTranslation } from 'react-i18next';
import { CHAINS } from '@/config/chains';
import { getToken } from '@/config/tokens';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useCreateRecurringPayment } from '@/hooks/useCreateRecurringPayment';

type LinkFrequency = 'monthly' | 'weekly' | null;

export default function PayLinkPage({ params }: { params: { id: string } }) {
  const { t, ready } = useTranslation();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { fetchLink, updateLinkStatus } = usePaymentLinks();
  const { createPayment, status: createStatus, error: createError, reset: resetCreate } = useCreatePayment();
  const {
    createRecurringPayment,
    status: recurringStatus,
    error: recurringError,
    reset: resetRecurring,
  } = useCreateRecurringPayment();

  const [link, setLink] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const linkId = params.id;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchLink(linkId);
        if (isMounted) {
          setLink(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(ready ? t('links.pay.errors.notFound') : 'Payment link not found');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchLink, linkId, ready, t]);

  const networkName = link?.chain_id ? (CHAINS[link.chain_id]?.name || `Chain ${link.chain_id}`) : '-';
  const isChainMismatch = link?.chain_id && chainId && link.chain_id !== chainId;
  const isUnsupportedChain = link?.chain_id && link.chain_id !== 8453;
  const isWeekly = link?.frequency === 'weekly';

  const formattedAmount = useMemo(() => {
    if (!link?.amount) return '-';
    return `${link.amount} ${link.token_symbol}`;
  }, [link]);

  const handlePay = async () => {
    if (!link || !address) return;
    setError(null);
    resetCreate();
    resetRecurring();

    if (isUnsupportedChain) {
      setError(ready ? t('links.pay.errors.chainUnsupported') : 'Network not supported yet');
      return;
    }

    if (link.payment_type === 'recurring') {
      if (link.token_symbol !== 'USDC' && link.token_symbol !== 'USDT') {
        setError(ready ? t('links.pay.errors.recurringToken') : 'Recurring requires USDC or USDT');
        return;
      }
      if (isWeekly) {
        setError(ready ? t('links.pay.errors.weeklyUnsupported') : 'Weekly recurring not supported');
        return;
      }
      if (!link.start_at || !link.periods) {
        setError(ready ? t('links.pay.errors.recurringMissing') : 'Missing recurring info');
        return;
      }

      const token = getToken(link.token_symbol);
      const amount = parseUnits(link.amount, token.decimals);
      const startDate = new Date(link.start_at * 1000);
      const dayOfMonth = startDate.getUTCDate();
      const totalMonths = Math.min(Number(link.periods), 12);

      await createRecurringPayment({
        tokenSymbol: link.token_symbol,
        beneficiary: link.creator_address,
        monthlyAmount: amount,
        firstPaymentTime: link.start_at,
        totalMonths,
        dayOfMonth,
      });
      return;
    }

    if (link.payment_type === 'scheduled' && !link.execute_at) {
      setError(ready ? t('links.pay.errors.executeMissing') : 'Missing execution date');
      return;
    }

    const token = getToken(link.token_symbol);
    const amount = parseUnits(link.amount, token.decimals);
    const releaseTime = link.payment_type === 'scheduled'
      ? Number(link.execute_at)
      : Math.floor(Date.now() / 1000) + 30;

    await createPayment({
      tokenSymbol: link.token_symbol,
      beneficiary: link.creator_address,
      amount,
      releaseTime,
      cancellable: false,
    });
  };

  useEffect(() => {
    const hasSuccess =
      createStatus === 'success' || recurringStatus === 'success';
    if (!hasSuccess || !link || !address) return;

    const nextStatus = link.payment_type === 'instant' ? 'paid' : 'active';
    updateLinkStatus(link.id, nextStatus, address).catch(() => undefined);
  }, [createStatus, recurringStatus, link, address, updateLinkStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8">
          {ready ? t('links.pay.loading') : 'Loading payment link...'}
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-red-600">{error || 'Payment link not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {ready ? t('links.pay.title') : 'Pay a link'}
          </h1>
          <p className="text-gray-600 mb-8">
            {ready ? t('links.pay.subtitle') : 'Review the payment details and pay securely.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">{ready ? t('links.pay.summary.amount') : 'Amount'}</p>
              <p className="text-lg font-semibold">{formattedAmount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">{ready ? t('links.pay.summary.type') : 'Type'}</p>
              <p className="text-lg font-semibold">{link.payment_type}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">{ready ? t('links.pay.summary.network') : 'Network'}</p>
              <p className="text-lg font-semibold">{networkName}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">{ready ? t('links.pay.summary.beneficiary') : 'Beneficiary'}</p>
              <p className="text-sm text-gray-700 break-all">{link.creator_address}</p>
            </div>
          </div>

          {link.description && (
            <div className="rounded-xl border border-gray-200 p-4 mb-6">
              <p className="text-xs uppercase text-gray-500 mb-1">{ready ? t('links.pay.summary.description') : 'Description'}</p>
              <p className="text-sm text-gray-700">{link.description}</p>
            </div>
          )}

          {isChainMismatch && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mb-6">
              {ready ? t('links.pay.errors.chainMismatch', { network: networkName }) : `Please switch to ${networkName}`}
            </div>
          )}

          {isUnsupportedChain && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
              {ready ? t('links.pay.errors.chainUnsupported') : 'This network is not supported yet.'}
            </div>
          )}

          {isWeekly && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mb-6">
              {ready ? t('links.pay.errors.weeklyUnsupported') : 'Weekly recurring not supported yet.'}
            </div>
          )}

          {!isConnected && (
            <div className="mb-6">
              <ConnectButton />
            </div>
          )}

          {createError && (
            <div className="text-sm text-red-600 mb-4">{createError.message}</div>
          )}
          {recurringError && (
            <div className="text-sm text-red-600 mb-4">{recurringError.message}</div>
          )}

          <button
            onClick={handlePay}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white font-semibold hover:opacity-95 transition disabled:opacity-60"
            disabled={!isConnected || isChainMismatch || isUnsupportedChain || isWeekly || createStatus === 'creating' || recurringStatus === 'creating'}
          >
            {ready ? t('links.pay.cta') : 'Pay now'}
          </button>
        </div>
      </div>
    </div>
  );
}
