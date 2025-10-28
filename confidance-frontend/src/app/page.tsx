// src/app/page.tsx
'use client';

import { useAccount, useChainId } from 'wagmi';
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

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [supabaseOk, setSupabaseOk] = useState(false);

  useEffect(() => {
    testSupabaseConnection().then(setSupabaseOk);
  }, []);

  const features = [
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
      description: 'ETH, USDC, USDT, WBTC. Programmez de 5 minutes à plusieurs années',
      gradient: 'from-purple-400 to-pink-500',
    },
  ];

  const useCases = [
    { icon: '💼', title: 'Salaires automatiques', desc: 'Payez vos équipes à date fixe' },
    { icon: '🏠', title: 'Loyers programmés', desc: 'Plus besoin de penser à payer chaque mois' },
    { icon: '🎁', title: 'Cadeaux futurs', desc: 'Surprise garantie pour un anniversaire' },
    { icon: '💳', title: 'Abonnements', desc: 'Versements récurrents automatiques' },
  ];

  const stats = [
    { label: 'Paiements exécutés', value: '15+', icon: TrendingUp },
    { label: 'Taux de succès', value: '100%', icon: CheckCircle2 },
    { label: 'Utilisateurs actifs', value: '50+', icon: Users },
  ];

  return (
    <>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 sm:py-32">
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
                <span className="text-sm font-medium">Paiements programmés DeFi</span>
              </div>

              {/* Title */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="block text-gray-900 dark:text-white">Programmez vos</span>
                <span className="block gradient-text">paiements crypto</span>
                <span className="block text-gray-900 dark:text-white">en toute confiance</span>
              </h1>

              {/* Description */}
              <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 dark:text-gray-400 text-balance">
                Verrouillez vos cryptos et libérez-les automatiquement à une date précise.
                <br />
                <strong className="text-gray-900 dark:text-white">Sans intermédiaire. 100% on-chain.</strong>
              </p>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className={`glass px-4 py-2 rounded-full text-sm font-medium ${
                  supabaseOk 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <span className="inline-block w-2 h-2 rounded-full mr-2 bg-current animate-pulse" />
                  {supabaseOk ? 'Système opérationnel' : 'Maintenance'}
                </div>
                
                {isConnected && chainId === 8453 && (
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
                  className="group relative px-8 py-4 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-2xl shadow-primary-500/50 hover:shadow-primary-500/70 transition-all hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    Créer un paiement
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                
                {isConnected && (
                  <Link
                    href="/dashboard"
                    className="px-8 py-4 glass rounded-xl font-semibold hover:scale-105 transition-all"
                  >
                    Mon Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 border-y border-gray-200 dark:border-gray-800">
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
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                Pourquoi Confidance ?
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                La plateforme la plus simple et sécurisée pour programmer vos paiements crypto
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
        <section className="py-20 sm:py-32 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                Cas d'usage
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Des solutions pour tous vos besoins de paiements programmés
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
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative glass rounded-3xl p-12 sm:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 gradient-primary opacity-10 -z-10" />
              
              <div className="max-w-3xl mx-auto space-y-8">
                <Wallet className="h-16 w-16 mx-auto text-primary-500" />
                
                <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                  Prêt à commencer ?
                </h2>
                
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  Connectez votre wallet et créez votre premier paiement programmé en moins de 2 minutes
                </p>

                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-2xl shadow-primary-500/50 hover:shadow-primary-500/70 transition-all hover:scale-105"
                >
                  Créer mon premier paiement
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
