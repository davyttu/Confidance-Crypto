// src/app/links/new/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { CHAINS } from '@/config/chains';
import { TOKEN_LIST, getToken, type Token, type TokenSymbol } from '@/config/tokens';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import {
  PaymentCategory,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
} from '@/types/payment-identity';

type PaymentType = 'instant' | 'scheduled' | 'recurring';
type Frequency = 'monthly' | 'weekly';

function TokenIcon({ token }: { token: Token }) {
  if (!token.icon) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-white text-xs font-semibold"
        style={{ backgroundColor: token.color }}
      >
        {token.symbol.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={token.icon}
      alt={token.name}
      className="w-full h-full object-contain"
    />
  );
}

export default function NewPaymentLinkPage() {
  const { t, ready, i18n } = useTranslation();
  const { address } = useAccount();
  const { createLink, isLoading } = usePaymentLinks();

  const [isClient, setIsClient] = useState(false);
  const [paymentLabel, setPaymentLabel] = useState('');
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory | null>('other');
  const [isPaymentIdentityDisabled, setIsPaymentIdentityDisabled] = useState(false);
  const [amount, setAmount] = useState('2');
  const [token, setToken] = useState<'ETH' | 'USDC' | 'USDT'>('USDT');
  const [paymentType, setPaymentType] = useState<PaymentType>('instant');
  const [chainId, setChainId] = useState<number>(8453);
  const [description, setDescription] = useState('');
  const [executeAt, setExecuteAt] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [periods, setPeriods] = useState<number>(6);
  const [isFirstMonthCustom, setIsFirstMonthCustom] = useState(false);
  const [firstMonthAmount, setFirstMonthAmount] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isTranslationReady = ready && isClient;
  const selectedToken = getToken(token as TokenSymbol);
  const selectedChain = CHAINS[chainId];
  const chainIconById: Record<number, string> = {
    8453: '/blockchains/base.svg',
    42161: '/blockchains/arbitrum.svg',
    43114: '/blockchains/avalanche.svg',
    137: '/blockchains/polygon.svg',
    84532: '/globe.svg',
  };
  const selectedChainIcon = chainIconById[chainId] || '/globe.svg';
  const currentLang = (isTranslationReady ? i18n?.language?.split('-')[0] : 'en') as 'en' | 'fr' | 'es' | 'ru' | 'zh';
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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (paymentType === 'recurring' && frequency !== 'monthly') {
      setFrequency('monthly');
    }
    if (paymentType !== 'recurring' || frequency !== 'monthly') {
      setIsFirstMonthCustom(false);
      setFirstMonthAmount('');
    }
  }, [paymentType, frequency]);

  const shareUrl = useMemo(() => {
    if (!createdId) return '';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!baseUrl) return '';
    return `${baseUrl}/pay/${createdId}`;
  }, [createdId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaymentIdentityToggle = () => {
    if (isPaymentIdentityDisabled) {
      setIsPaymentIdentityDisabled(false);
      setPaymentCategory('other');
      return;
    }

    setIsPaymentIdentityDisabled(true);
    setPaymentLabel('');
    setPaymentCategory(null);
  };

  const handleSubmit = async () => {
    if (!address) {
      setError(ready ? t('links.create.errors.connectWallet') : 'Connect your wallet first');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError(ready ? t('links.create.errors.amount') : 'Invalid amount');
      return;
    }
    if (paymentLabel.length > 100) {
      setError(ready ? t('links.create.errors.labelTooLong') : 'Label is too long');
      return;
    }

    if (paymentType === 'scheduled' && !executeAt) {
      setError(ready ? t('links.create.errors.executeAt') : 'Execution date required');
      return;
    }

    if (paymentType === 'recurring') {
      if (!periods || periods < 1) {
        setError(ready ? t('links.create.errors.periods') : 'Periods required');
        return;
      }
      if (frequency === 'monthly' && isFirstMonthCustom) {
        if (!firstMonthAmount || Number(firstMonthAmount) <= 0) {
          setError(ready ? t('links.create.errors.firstMonthAmount') : 'Invalid first month amount');
          return;
        }
      }
    }
    setError(null);

    const executeAtTs = executeAt ? Math.floor(new Date(executeAt).getTime() / 1000) : null;
    const frequencyToSend = paymentType === 'recurring' ? 'monthly' : null;

    try {
      const paymentLink = await createLink({
        creator: address,
        amount,
        first_month_amount: paymentType === 'recurring' && frequencyToSend === 'monthly' && isFirstMonthCustom
          ? firstMonthAmount
          : null,
        is_first_month_custom: paymentType === 'recurring' && frequencyToSend === 'monthly' && isFirstMonthCustom,
        token,
        payment_type: paymentType,
        frequency: frequencyToSend,
        periods: paymentType === 'recurring' ? periods : null,
        start_at: null,
        execute_at: paymentType === 'scheduled' ? executeAtTs : null,
        chain_id: chainId,
        description: description || null,
        payment_label: paymentLabel.trim() || null,
        payment_categorie: paymentCategory ?? null,
        payment_category: paymentCategory ?? null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      setCreatedId(paymentLink.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      setError(
        message
          || (isTranslationReady ? t('links.create.errors.create') : 'Failed to generate link')
      );
    }
  };

  // Icônes des types de paiement
  const getPaymentTypeIcon = (type: PaymentType) => {
    switch (type) {
      case 'instant':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'scheduled':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'recurring':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header compact */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full mb-4 shadow-lg">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {isTranslationReady ? t('links.create.badge') : 'Payment Link Generator'}
            </span>
          </div>
          
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            {isTranslationReady ? t('links.create.title') : 'Create a payment link'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isTranslationReady ? t('links.create.subtitle') : 'Generate a shareable link and get paid directly in crypto'}
          </p>
        </div>

        {/* Formulaire compact - Card unique */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-6">
          
          {/* Payment label & category */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span className="text-base">🏷️</span>
              {isTranslationReady
                ? t('links.create.sections.identity', { defaultValue: 'Payment identity' })
                : 'Payment identity'}
              <button
                type="button"
                onClick={handlePaymentIdentityToggle}
                className="ml-1 h-4 w-4 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex items-center justify-center"
                aria-label={isPaymentIdentityDisabled ? 'Enable payment identity' : 'Disable payment identity'}
                title={isPaymentIdentityDisabled ? 'Enable payment identity' : 'Disable payment identity'}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </h3>

            <div className={`space-y-3 ${isPaymentIdentityDisabled ? 'opacity-60' : ''}`}>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {isTranslationReady ? t('links.create.fields.label') : 'Label'}
                  <span className="text-gray-400"> {isTranslationReady ? t('links.create.fields.optional') : '(optional)'}</span>
                </label>
                <input
                  type="text"
                  value={paymentLabel}
                  onChange={(e) => setPaymentLabel(e.target.value)}
                  maxLength={100}
                  disabled={isPaymentIdentityDisabled}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-medium transition-all disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  placeholder={isTranslationReady ? t('links.create.placeholders.label') : 'e.g., Netflix subscription'}
                />
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  <span>
                    {isTranslationReady
                      ? t('links.create.hint.label', { defaultValue: 'Give your link a clear title.' })
                      : 'Give your link a clear title.'}
                  </span>
                  <span>{paymentLabel.length}/100</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {isTranslationReady ? t('links.create.fields.category') : 'Category'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {categories.map((cat) => {
                    const isSelected = paymentCategory === cat;
                    const colors = CATEGORY_COLORS[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPaymentCategory(cat)}
                        disabled={isPaymentIdentityDisabled}
                        className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                          isPaymentIdentityDisabled
                            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                            : isSelected
                              ? `${colors.bg} ${colors.border} ${colors.text} font-semibold`
                              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-300'
                        }`}
                      >
                        <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                        <span className="text-[11px] truncate">
                          {CATEGORY_LABELS[cat][currentLang]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Amount & Token */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isTranslationReady ? t('links.create.sections.amountToken', { defaultValue: 'Amount & Token' }) : 'Amount & Token'}
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Amount */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {isTranslationReady ? t('links.create.fields.amount') : 'Amount'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-semibold transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Token */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {isTranslationReady ? t('links.create.fields.token') : 'Token'}
                </label>
                <div className="relative">
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full overflow-hidden bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                    <TokenIcon token={selectedToken} />
                  </div>
                  <select
                    value={token}
                    onChange={(e) => setToken(e.target.value as 'ETH' | 'USDC' | 'USDT')}
                    className="w-full px-3 py-2 pl-10 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-semibold transition-all cursor-pointer"
                  >
                    <option value="ETH">ETH</option>
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Network */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {isTranslationReady ? t('links.create.sections.network', { defaultValue: 'Network' }) : 'Network'}
            </h3>
            
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full overflow-hidden bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                <img
                  src={selectedChainIcon}
                  alt={selectedChain?.name || 'Network'}
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <select
                value={chainId}
                onChange={(e) => setChainId(Number(e.target.value))}
                className="w-full px-3 py-2 pl-10 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-semibold transition-all cursor-pointer"
              >
              {Object.values(CHAINS).map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
              </select>
            </div>
          </div>

          {/* Payment type - Horizontal compact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {isTranslationReady ? t('links.create.sections.paymentType', { defaultValue: 'Payment type' }) : 'Payment type'}
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(['instant', 'scheduled', 'recurring'] as PaymentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPaymentType(type)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    paymentType === type
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <div className={`flex items-center gap-2 ${
                    paymentType === type ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500'
                  }`}>
                    {getPaymentTypeIcon(type)}
                    <span className="text-xs font-semibold">
                      {isTranslationReady ? t(`links.types.${type}`) : type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled options */}
          {paymentType === 'scheduled' && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 animate-in fade-in duration-300">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isTranslationReady ? t('links.create.sections.schedule', { defaultValue: 'Schedule' }) : 'Schedule'}
              </h3>
              
              <input
                type="datetime-local"
                value={executeAt}
                onChange={(e) => setExecuteAt(e.target.value)}
                className="w-full px-3 py-2 border-2 border-purple-200 dark:border-purple-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm transition-all"
              />
            </div>
          )}

          {/* Recurring options */}
          {paymentType === 'recurring' && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 animate-in fade-in duration-300">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isTranslationReady ? t('links.create.sections.recurringConfig', { defaultValue: 'Recurring configuration' }) : 'Recurring configuration'}
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Frequency */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {isTranslationReady ? t('links.create.fields.frequency') : 'Frequency'}
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                    disabled
                    className="w-full px-0 py-2 border-0 rounded-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs transition-all appearance-none bg-none cursor-default disabled:opacity-100"
                  >
                    <option value="monthly">📅 {isTranslationReady ? t('links.frequency.monthly') : 'Monthly'} :</option>
                  </select>
                </div>

                {/* Periods */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {isTranslationReady ? t('links.create.fields.periods') : 'Periods'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={periods}
                    onChange={(e) => setPeriods(Number(e.target.value))}
                    className="w-full px-2 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs transition-all"
                    placeholder="6"
                  />
                </div>
              </div>

              {/* Start date info */}
              <div className="rounded-lg border border-purple-100 dark:border-purple-900/40 bg-purple-50/60 dark:bg-purple-900/10 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-gray-900/60 border border-purple-200/70 dark:border-purple-800 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isTranslationReady ? t('links.create.fields.startAt') : 'Start date'}
                  </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
                  {isTranslationReady
                    ? t(
                        'links.create.hint.startAtInformative',
                        {
                          defaultValue:
                            'The first monthly payment starts when the recipient opens the link and confirms the payment.',
                        },
                      )
                    : 'The first monthly payment starts when the recipient opens the link and confirms the payment.'}
                </p>
              </div>

              {/* First month custom - Option Same/Custom */}
              {frequency === 'monthly' && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {isTranslationReady ? t('links.create.firstMonth.title') : 'First monthly payment'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {isTranslationReady
                          ? t('links.create.firstMonth.description')
                          : 'By default, it is the same as the following months.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsFirstMonthCustom(false);
                          setFirstMonthAmount('');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                          !isFirstMonthCustom
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                        }`}
                      >
                        {isTranslationReady ? t('links.create.firstMonth.same') : 'Same'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFirstMonthCustom(true);
                          setFirstMonthAmount(amount || '');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                          isFirstMonthCustom
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                        }`}
                      >
                        {isTranslationReady ? t('links.create.firstMonth.custom') : 'Custom'}
                      </button>
                    </div>
                  </div>

                  {isFirstMonthCustom && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {isTranslationReady ? t('links.create.firstMonth.amountLabel') : 'First monthly amount'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={firstMonthAmount}
                        onChange={(e) => setFirstMonthAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm transition-all"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {isTranslationReady
                          ? t('links.create.firstMonth.info')
                          : '💡 If you enter the same amount as the monthly payment, this option will be ignored automatically.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {isTranslationReady ? t('links.create.sections.description', { defaultValue: 'Description' }) : 'Description'}
              <span className="text-xs text-gray-400 font-normal">
                {isTranslationReady ? t('links.create.sections.optional', { defaultValue: '(optional)' }) : '(optional)'}
              </span>
            </h3>
            
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm transition-all"
              placeholder={isTranslationReady ? t('links.create.placeholders.description') : 'e.g., Monthly rent, SaaS subscription...'}
            />
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-in fade-in duration-300">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Bouton Generate */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-base hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isTranslationReady ? t('links.create.generating') : 'Generating...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {isTranslationReady ? t('links.create.generate') : 'Generate payment link'}
              </>
            )}
          </button>
        </div>

        {/* Lien généré */}
        {createdId && (
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl shadow-xl p-6 border-2 border-purple-200 dark:border-purple-800 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isTranslationReady ? t('links.create.success') : 'Payment link created!'}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isTranslationReady ? t('links.create.successDescription') : 'Share this link to receive payments'}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-700 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:shadow-lg transition-all flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isTranslationReady ? t('links.create.copied') : 'Copied!'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {isTranslationReady ? t('links.create.copy') : 'Copy'}
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {isTranslationReady ? t('links.create.shareInfo') : 'Share this link via email, social media, or messaging apps'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
