// src/app/page.tsx
'use client';

import { useAccount, useChainId, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import { testSupabaseConnection } from '@/lib/supabase/test';
import Link from 'next/link';
import { 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Shield, 
  Clock, 
  TrendingUp,
  Users,
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const walletConnected = Boolean(address);
  const [supabaseOk, setSupabaseOk] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    testSupabaseConnection().then(setSupabaseOk);
  }, []);

  const handleReconnectWallet = () => {
    disconnect();
    if (openConnectModal) {
      setTimeout(() => openConnectModal(), 50);
    }
  };

  // ✅ FIX : Utiliser des valeurs par défaut pendant l'hydratation
  const features = isMounted && ready ? [
    {
      icon: Zap,
      title: t('home.features.automatic.title'),
      description: t('home.features.automatic.description'),
      gradient: 'from-yellow-400 to-orange-500',
    },
    {
      icon: Shield,
      title: t('home.features.secure.title'),
      description: t('home.features.secure.description'),
      gradient: 'from-green-400 to-emerald-500',
    },
    {
      icon: Clock,
      title: t('home.features.flexible.title'),
      description: t('home.features.flexible.description'),
      gradient: 'from-purple-400 to-pink-500',
    },
  ] : [
    {
      icon: Zap,
      title: 'Automatique',
      description: 'Un keeper 24/7 surveille et exécute vos paiements à la seconde près',
      gradient: 'from-yellow-400 to-orange-500',
    },
    {
      icon: Shield,
      title: 'Sécurisé',
      description: 'Smart contracts audités. Vos fonds sont verrouillés on-chain',
      gradient: 'from-green-400 to-emerald-500',
    },
    {
      icon: Clock,
      title: 'Flexible',
      description: 'ETH, USDC, USDT. Programmez de 5 minutes à plusieurs années',
      gradient: 'from-purple-400 to-pink-500',
    },
  ];

  const useCases = isMounted && ready ? [
    { icon: '💼', title: t('home.useCases.salaries.title'), desc: t('home.useCases.salaries.desc') },
    { icon: '🏠', title: t('home.useCases.rent.title'), desc: t('home.useCases.rent.desc') },
    { icon: '🎁', title: t('home.useCases.gifts.title'), desc: t('home.useCases.gifts.desc') },
    { icon: '💳', title: t('home.useCases.subscriptions.title'), desc: t('home.useCases.subscriptions.desc') },
    {
      icon: '🛡️',
      title: t('home.useCases.insurance.title', { defaultValue: 'Insurance & guarantees' }),
      desc: t('home.useCases.insurance.desc', { defaultValue: 'Upfront deposit at signature, then monthly premiums' }),
    },
  ] : [
    { icon: '💼', title: 'Salaires automatiques', desc: 'Payez vos équipes à date fixe' },
    { icon: '🏠', title: 'Loyers programmés', desc: 'Plus besoin de penser à payer chaque mois' },
    { icon: '🎁', title: 'Cadeaux futurs', desc: 'Surprise garantie pour un anniversaire' },
    { icon: '💳', title: 'Abonnements', desc: 'Versements récurrents automatiques' },
    { icon: '🛡️', title: 'Assurances & garanties', desc: 'Caution à la signature puis mensualités' },
  ];

  const stats = isMounted && ready ? [
    { label: t('home.stats.executed'), value: '15+', icon: TrendingUp },
    { label: t('home.stats.success'), value: '100%', icon: CheckCircle2 },
    { label: t('home.stats.users'), value: '50+', icon: Users },
  ] : [
    { label: 'Paiements exécutés', value: '15+', icon: TrendingUp },
    { label: 'Taux de succès', value: '100%', icon: CheckCircle2 },
    { label: 'Utilisateurs actifs', value: '50+', icon: Users },
  ];

  return (
    <>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-10 sm:py-16">
          {/* Background decorations */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 gradient-primary rounded-full blur-3xl opacity-20 animate-float" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }} />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-8 animate-slide-up">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span className="text-sm font-medium">{isMounted && ready ? t('home.badge') : 'Paiements programmés DeFi'}</span>
              </div>

              {/* Title */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="block text-gray-900 dark:text-white">{isMounted && ready ? t('home.title') : 'Programmez vos paiements crypto en toute confiance'}</span>
              </h1>

              {/* Description */}
              <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 dark:text-gray-400 text-balance">
                {isMounted && ready ? t('home.subtitle') : 'Verrouillez vos cryptos et libérez-les automatiquement à une date précise.'}
                <br />
                <strong className="text-gray-900 dark:text-white">{isMounted && ready ? t('home.tagline') : 'Sans intermédiaire. 100% on-chain.'}</strong>
              </p>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className={`glass px-4 py-2 rounded-full text-sm font-medium ${
                  supabaseOk 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <span className="inline-block w-2 h-2 rounded-full mr-2 bg-current animate-pulse" />
                  {isMounted && ready ? (supabaseOk ? t('home.status.operational') : t('home.status.maintenance')) : (supabaseOk ? 'Système opérationnel' : 'Maintenance')}
                </div>
                
                {walletConnected && chainId === 8453 && (
                  <div className="glass px-4 py-2 rounded-full text-sm font-medium text-blue-600 dark:text-blue-400">
                    <span className="inline-block w-2 h-2 rounded-full mr-2 bg-current animate-pulse" />
                    Base Mainnet
                  </div>
                )}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link
                  href="/create"
                  className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-2xl transition-all hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    {isMounted && ready ? t('home.cta') : 'Créer un paiement'}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                
                {walletConnected && (
                  <Link
                    href="/dashboard"
                    className="px-8 py-4 glass rounded-xl font-semibold hover:scale-105 transition-all"
                  >
                    {isMounted && ready ? t('dashboard.title') : 'Mon Dashboard'}
                  </Link>
                )}
              </div>

              {!walletConnected && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => openConnectModal?.()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                    type="button"
                  >
                    {isMounted && ready ? t('common.connectWallet', { defaultValue: 'Connect Wallet' }) : 'Connect Wallet'}
                  </button>
                  <button
                    onClick={handleReconnectWallet}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
                    type="button"
                  >
                    {isMounted && ready ? t('common.resetWallet', { defaultValue: 'Reset wallet connection' }) : 'Reset wallet connection'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-8 sm:py-10 border-y border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {stats.map((stat, i) => (
                <div key={i} className="text-center space-y-2 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <stat.icon className="h-8 w-8 mx-auto text-primary-500" />
                  <div className="text-4xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white animate-slide-in-right">
                {isMounted && ready ? t('home.why.title') : 'Pourquoi Confidance ?'}
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto animate-slide-in-left">
                {isMounted && ready ? t('home.why.description') : 'La plateforme la plus simple et sécurisée pour programmer vos paiements crypto'}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="group relative glass rounded-2xl p-8 card-hover animate-slide-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity -z-10`} />
                  
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="pt-10 pb-16 sm:pt-12 sm:pb-22 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                {isMounted && ready ? t('home.useCases.title') : 'Cas d\'usage'}
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                {isMounted && ready ? t('home.useCases.subtitle') : 'Des solutions pour tous vos besoins de paiements programmés'}
              </p>
            </div>

            <div className="grid gap-4">
              {useCases.map((useCase, i) => (
                <div
                  key={i}
                  className="glass rounded-xl p-6 flex items-start gap-4 card-hover animate-slide-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="text-4xl">{useCase.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
                      {useCase.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">{useCase.desc}</p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/links/new"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-2xl hover:scale-105 transition-all"
              >
                {isMounted && ready ? t('links.cta') : 'Créer un lien de paiement'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative glass rounded-3xl p-12 sm:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 gradient-primary opacity-10 -z-10" />
              
              <div className="max-w-3xl mx-auto space-y-8">
                <Wallet className="h-16 w-16 mx-auto text-primary-500" />
                
                <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                  {isMounted && ready ? t('home.ctaSection.title') : 'Prêt à commencer ?'}
                </h2>
                
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  {isMounted && ready ? t('home.ctaSection.description') : 'Connectez votre wallet et créez votre premier paiement programmé en moins de 2 minutes'}
                </p>

                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-2xl shadow-primary-500/50 hover:shadow-primary-500/70 transition-all hover:scale-105"
                >
                  {isMounted && ready ? t('home.ctaSection.button') : 'Créer mon premier paiement'}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
