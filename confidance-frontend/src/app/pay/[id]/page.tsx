// src/app/pay/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'viem';
import { useTranslation } from 'react-i18next';
import { CHAINS } from '@/config/chains';
import { getToken, type TokenSymbol } from '@/config/tokens';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import { useCreatePayment } from '@/hooks/useCreatePayment';
import { useCreateRecurringPayment } from '@/hooks/useCreateRecurringPayment';
import PaymentProgressModal from '@/components/payment/PaymentProgressModal';
import { CATEGORY_ICONS, CATEGORY_LABELS, type PaymentCategory } from '@/types/payment-identity';
import { 
  Shield, 
  Lock, 
  Copy, 
  Check, 
  AlertCircle, 
  Info,
  CheckCircle,
  Clock,
  Repeat,
  Zap
} from 'lucide-react';

type LinkFrequency = 'monthly' | 'weekly' | null;

export default function PayLinkPage() {
  const { t, ready, i18n } = useTranslation();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { fetchLink, updateLinkStatus } = usePaymentLinks();
  const {
    createPayment,
    status: createStatus,
    error: createError,
    reset: resetCreate,
    currentStep: createCurrentStep,
    totalSteps: createTotalSteps,
    progressMessage: createProgressMessage,
    approveTxHash: createApproveTxHash,
    createTxHash: createCreateTxHash,
    contractAddress: createContractAddress,
  } = useCreatePayment();
  const {
    createRecurringPayment,
    status: recurringStatus,
    error: recurringError,
    reset: resetRecurring,
    currentStep: recurringCurrentStep,
    totalSteps: recurringTotalSteps,
    progressMessage: recurringProgressMessage,
    approveTxHash: recurringApproveTxHash,
    createTxHash: recurringCreateTxHash,
    contractAddress: recurringContractAddress,
  } = useCreateRecurringPayment();

  const [link, setLink] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const currentLang = (i18n?.language?.split('-')[0] || 'en') as 'en' | 'fr' | 'es' | 'ru' | 'zh';

  const params = useParams();
  const linkId = Array.isArray(params?.id)
    ? params?.id[0]
    : (params?.id as string | undefined) || '';

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (!linkId) {
          if (isMounted) {
            setError(ready ? t('links.pay.errors.notFound') : 'Payment link not found');
            setIsLoading(false);
          }
          return;
        }
        setIsLoading(true);
        const data = await fetchLink(linkId);
        if (isMounted) {
          setLink(data);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error
            ? err.message
            : (ready ? t('links.pay.errors.notFound') : 'Payment link not found');
          setError(message);
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
  const supportedChainIds = [8453, 84532];
  const isUnsupportedChain = link?.chain_id && !supportedChainIds.includes(link.chain_id);
  const isWeekly = link?.frequency === 'weekly';

  const isFirstMonthCustom =
    link?.is_first_month_custom === true || link?.is_first_month_custom === 'true';
  const monthlyAmountLabel = useMemo(() => {
    if (!link?.amount) return '-';
    return `${link.amount} ${link.token_symbol}`;
  }, [link]);
  const firstMonthAmountLabel = useMemo(() => {
    if (isFirstMonthCustom && link?.first_month_amount) {
      return `${link.first_month_amount} ${link.token_symbol}`;
    }
    return monthlyAmountLabel;
  }, [isFirstMonthCustom, link, monthlyAmountLabel]);
  const rawCategory = link?.payment_categorie || link?.payment_category || null;
  const categoryKey = rawCategory && rawCategory in CATEGORY_LABELS
    ? (rawCategory as PaymentCategory)
    : null;
  const categoryLabel = categoryKey
    ? CATEGORY_LABELS[categoryKey][currentLang]
    : rawCategory;
  const categoryIcon = categoryKey ? CATEGORY_ICONS[categoryKey] : '🏷️';

  const handleCopyAddress = () => {
    if (!link?.creator_address) return;
    navigator.clipboard.writeText(link.creator_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      if (!link.periods) {
        setError(ready ? t('links.pay.errors.recurringMissing') : 'Missing recurring info');
        return;
      }

      const token = getToken(link.token_symbol);
      const amount = parseUnits(link.amount, token.decimals);
      const firstMonthAmount = isFirstMonthCustom && link.first_month_amount
        ? parseUnits(link.first_month_amount, token.decimals)
        : undefined;
      const now = Math.floor(Date.now() / 1000);
      const startAt = link.start_at && Number(link.start_at) > now
        ? Number(link.start_at)
        : now + 600;
      const startDate = new Date(startAt * 1000);
      const dayOfMonth = startDate.getUTCDate();
      const totalMonths = Math.min(Number(link.periods), 12);

      await createRecurringPayment({
        tokenSymbol: link.token_symbol,
        beneficiary: link.creator_address,
        monthlyAmount: amount,
        firstMonthAmount,
        firstPaymentTime: startAt,
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

  // Helper pour obtenir l'icône du type de paiement
  const getPaymentTypeIcon = () => {
    switch (link?.payment_type) {
      case 'instant':
        return <Zap className="w-5 h-5" />;
      case 'scheduled':
        return <Clock className="w-5 h-5" />;
      case 'recurring':
        return <Repeat className="w-5 h-5" />;
      default:
        return null;
    }
  };

  // Helper pour obtenir la couleur du type
  const getPaymentTypeColor = () => {
    switch (link?.payment_type) {
      case 'instant':
        return 'from-green-500 to-emerald-600';
      case 'scheduled':
        return 'from-blue-500 to-indigo-600';
      case 'recurring':
        return 'from-purple-500 to-pink-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const isProcessing = createStatus === 'creating' || recurringStatus === 'creating';
  const isRecurringLink = link?.payment_type === 'recurring';
  const activeStatus = isRecurringLink ? recurringStatus : createStatus;
  const activeError = isRecurringLink ? recurringError : createError;
  const activeCurrentStep = isRecurringLink ? recurringCurrentStep : createCurrentStep;
  const activeTotalSteps = isRecurringLink ? recurringTotalSteps : createTotalSteps;
  const activeProgressMessage = isRecurringLink ? recurringProgressMessage : createProgressMessage;
  const activeApproveTxHash = isRecurringLink ? recurringApproveTxHash : createApproveTxHash;
  const activeCreateTxHash = isRecurringLink ? recurringCreateTxHash : createCreateTxHash;
  const activeContractAddress = isRecurringLink ? recurringContractAddress : createContractAddress;
  const tokenSymbol = (link?.token_symbol || 'USDC') as TokenSymbol;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium">
              {ready ? t('links.pay.loading') : 'Loading payment link...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {ready ? t('links.pay.errors.notFound') : 'Payment link not found'}
          </h2>
          <p className="text-red-600 mb-6">
            {error || (ready ? t('links.pay.errors.invalidOrExpired') : 'This payment link is invalid or has expired')}
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            {ready ? t('links.pay.backHome') : 'Back to home'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header avec badge sécurité */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Confidance</h1>
                <p className="text-xs text-gray-500">
                  {ready ? t('links.pay.securePayments') : 'Secure payments'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">
                {ready ? t('links.pay.secureConnection') : 'Secure connection'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Titre */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            {ready ? t('links.pay.title') : 'Payment validation'}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {ready ? t('links.pay.subtitle') : 'Review the payment details and pay securely.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Colonne gauche : Détails */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card principale */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Header avec type de paiement */}
              <div className={`bg-gradient-to-r ${getPaymentTypeColor()} px-6 py-4`}>
                <div className="flex items-center gap-2 text-white">
                  {getPaymentTypeIcon()}
                  <span className="font-semibold capitalize">
                    {ready ? t(`links.pay.types.${link.payment_type}`) : link.payment_type}
                  </span>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-6">
                {(link.payment_label || categoryLabel) && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs text-gray-500">
                          {ready ? t('links.pay.summary.label') : 'Payment label'}
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          {link.payment_label || (ready ? t('links.pay.summary.unnamed') : 'Unnamed payment')}
                        </p>
                      </div>
                      {categoryLabel && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                          <span>{categoryIcon}</span>
                          <span>{categoryLabel}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Montant principal */}
                <div className="text-center py-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">
                    {ready ? t('links.pay.summary.amount') : 'Amount to pay'}
                  </p>
                  <p className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {firstMonthAmountLabel}
                  </p>
                </div>

                {/* Informations détaillées */}
                <div className="space-y-4">
                  {/* Réseau */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">
                      {ready ? t('links.pay.summary.network') : 'Network'}
                    </span>
                    <span className="font-medium text-gray-900">{networkName}</span>
                  </div>

                  {/* Bénéficiaire */}
                  <div className="py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">
                        {ready ? t('links.pay.summary.beneficiary') : 'Beneficiary'}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {ready ? t('links.pay.verified') : 'Verified'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <code className="text-xs text-gray-700 flex-1 font-mono break-all">
                        {link.creator_address.slice(0, 10)}...{link.creator_address.slice(-8)}
                      </code>
                      <button
                        onClick={handleCopyAddress}
                        className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        title={ready ? t('links.pay.copyAddress') : 'Copy address'}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {link.description && (
                    <div className="py-3">
                      <span className="text-sm text-gray-600 block mb-2">
                        {ready ? t('links.pay.summary.description') : 'Description'}
                      </span>
                      <p className="text-gray-900 font-medium">{link.description}</p>
                    </div>
                  )}

                  {/* Info récurrent */}
                  {link.payment_type === 'recurring' && link.periods && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Repeat className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-purple-900">
                            {ready ? t('links.pay.recurringPayment') : 'Recurring payment'}
                          </p>
                          <p className="text-xs text-purple-700 mt-1">
                            {link.periods} {ready ? t('links.pay.months') : 'months'} × {monthlyAmountLabel}
                          </p>
                          {isFirstMonthCustom && link.first_month_amount && (
                            <div className="mt-2 space-y-1 text-xs text-purple-700">
                              <div>
                                {ready
                                  ? t('links.pay.recurringDetails.firstMonth')
                                  : 'First month'}: {firstMonthAmountLabel}
                              </div>
                              <div>
                                {ready
                                  ? t('links.pay.recurringDetails.nextMonths')
                                  : 'Next months'}: {monthlyAmountLabel}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info scheduled */}
                  {link.payment_type === 'scheduled' && link.execute_at && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            {ready ? t('links.pay.scheduledPayment') : 'Scheduled payment'}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            {new Date(link.execute_at * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vérifications de sécurité */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">
                  {ready ? t('links.pay.securityChecks') : 'Security checks'}
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ready ? t('links.pay.security.ssl') : 'Secure connection'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {ready ? t('links.pay.security.sslDesc') : 'SSL/TLS encryption active'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ready ? t('links.pay.security.contract') : 'Verified smart contract'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {ready ? t('links.pay.security.contractDesc') : 'Audited on Base Mainnet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ready ? t('links.pay.security.blockchain') : 'Blockchain secured'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {ready ? t('links.pay.security.blockchainDesc') : 'Transparent and immutable'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite : Action */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Card d'action */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">
                    {ready ? t('links.pay.summary.title') : 'Summary'}
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  {/* Montant */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {ready ? t('links.pay.summary.amount') : 'Amount'}
                    </span>
                    <span className="font-medium text-gray-900">{firstMonthAmountLabel}</span>
                  </div>

                  {link.payment_type === 'recurring' && isFirstMonthCustom && link.first_month_amount && (
                    <div className="text-xs text-gray-600 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                      <div>
                        {ready
                          ? t('links.pay.recurringDetails.firstMonth')
                          : 'First month'}: <span className="font-medium text-gray-900">{firstMonthAmountLabel}</span>
                      </div>
                      <div>
                        {ready
                          ? t('links.pay.recurringDetails.nextMonths')
                          : 'Next months'}: <span className="font-medium text-gray-900">{monthlyAmountLabel}</span>
                      </div>
                    </div>
                  )}

                  {/* Type */}
                  <div className="flex items-center justify-between text-sm pb-4 border-b border-gray-200">
                    <span className="text-gray-600">
                      {ready ? t('links.pay.summary.type') : 'Type'}
                    </span>
                    <span className="font-medium text-gray-900 capitalize">{link.payment_type}</span>
                  </div>

                  {/* Wallet connection */}
                  {!isConnected && (
                    <div className="pt-2">
                      <p className="text-sm text-gray-600 mb-3">
                        {ready ? t('links.pay.connectWallet') : 'Connect your wallet to continue'}
                      </p>
                      <ConnectButton />
                    </div>
                  )}

                  {/* Alertes */}
                  {isChainMismatch && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-900">
                          {ready 
                            ? t('links.pay.errors.chainMismatch', { network: networkName })
                            : `Please switch to ${networkName}`
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {isUnsupportedChain && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-900">
                          {ready ? t('links.pay.errors.chainUnsupported') : 'This network is not supported yet'}
                        </p>
                      </div>
                    </div>
                  )}

                  {isWeekly && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-900">
                          {ready ? t('links.pay.errors.weeklyUnsupported') : 'Weekly recurring not supported yet'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Erreurs de création */}
                  {createError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-xs text-red-900">{createError.message}</p>
                    </div>
                  )}

                  {recurringError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-xs text-red-900">{recurringError.message}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton de paiement */}
              <button
                onClick={handlePay}
                disabled={!isConnected || isChainMismatch || isUnsupportedChain || isWeekly || isProcessing}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {ready ? t('links.pay.processing') : 'Processing...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5" />
                    {ready ? t('links.pay.cta') : 'Pay now'}
                  </span>
                )}
              </button>

              {/* Avertissement */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-900">
                    {ready 
                      ? t('links.pay.warning') 
                      : 'Verify all details before confirming. Blockchain transactions are irreversible.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                {ready ? t('links.pay.footer.security') : 'Security'}
              </h4>
              <p className="text-xs text-gray-600">
                {ready 
                  ? t('links.pay.footer.securityDesc')
                  : 'Your payments are protected by blockchain and audited smart contracts'
                }
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                {ready ? t('links.pay.footer.support') : 'Support'}
              </h4>
              <p className="text-xs text-gray-600">
                {ready 
                  ? t('links.pay.footer.supportDesc')
                  : 'Need help? Contact our 24/7 support at support@confidance.crypto'
                }
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                {ready ? t('links.pay.footer.info') : 'Information'}
              </h4>
              <p className="text-xs text-gray-600">
                {ready 
                  ? t('links.pay.footer.infoDesc')
                  : 'Powered by Confidance Crypto - Secure DeFi payments'
                }
              </p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              © {typeof window !== 'undefined' ? new Date().getFullYear() : 2025} Confidance Crypto. {ready ? t('links.pay.footer.rights') : 'All rights reserved'} |{' '}
              <a href="#" className="text-blue-600 hover:underline">
                {ready ? t('links.pay.footer.terms') : 'Terms'}
              </a>{' '}
              |{' '}
              <a href="#" className="text-blue-600 hover:underline">
                {ready ? t('links.pay.footer.privacy') : 'Privacy'}
              </a>
            </p>
          </div>
        </div>
      </div>

      <PaymentProgressModal
        isOpen={activeStatus !== 'idle'}
        status={activeStatus}
        currentStep={activeCurrentStep || 1}
        totalSteps={activeTotalSteps || 1}
        progressMessage={activeProgressMessage || ''}
        error={activeError}
        approveTxHash={activeApproveTxHash}
        createTxHash={activeCreateTxHash}
        contractAddress={activeContractAddress}
        tokenSymbol={tokenSymbol}
        totalMonths={isRecurringLink ? Number(link?.periods || 0) || undefined : undefined}
        onClose={() => {
          resetCreate();
          resetRecurring();
        }}
      />
    </div>
  );
}
