'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Network = 'mainnet' | 'sepolia';
type PaymentType = 'eth' | 'token';

const STEPS = [
  { id: 1, title: 'Réseau', short: 'Réseau' },
  { id: 2, title: 'Type de paiement', short: 'Type' },
  { id: 3, title: 'Lien du contrat', short: 'Contrat' },
  { id: 4, title: 'Où regarder', short: 'Onglet' },
  { id: 5, title: 'Que vérifier', short: 'Vérifier' },
  { id: 6, title: 'Récapitulatif', short: 'Récap' },
];

export default function FindProofPage() {
  const [step, setStep] = useState(1);
  const [network, setNetwork] = useState<Network | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [contractAddress, setContractAddress] = useState('');
  const [hasContractLink, setHasContractLink] = useState<boolean | null>(null);
  const [isSticky, setIsSticky] = useState(false);

  const basescanUrl = network === 'sepolia'
    ? 'https://sepolia.basescan.org'
    : network === 'mainnet'
    ? 'https://basescan.org'
    : 'https://basescan.org';

  const fullContractUrl = contractAddress.trim()
    ? `${basescanUrl}/address/${contractAddress.trim()}`
    : basescanUrl;

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 120);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const canProceedStep1 = network !== null;
  const canProceedStep2 = paymentType !== null;
  const canProceedStep3 = hasContractLink === false || (hasContractLink === true && contractAddress.trim().length >= 10);

  const goNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const goPrev = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hero */}
        <section className="text-center mb-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Trouver ma preuve
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Guide pas à pas pour localiser votre paiement sur Basescan
          </p>
        </section>

        {/* Sticky Stepper Navigation */}
        <nav
          className={`mb-8 transition-all duration-300 z-40 ${
            isSticky
              ? 'sticky top-16 py-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 shadow-lg -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 rounded-xl'
              : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {STEPS.map((s, index) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
                  step === s.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : step > s.id
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-white/20">
                  {step > s.id ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    s.id
                  )}
                </span>
                <span className="hidden sm:inline font-medium">{isSticky ? s.short : s.title}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Étape {step} sur 6
            </span>
            <div className="flex gap-2">
              {step > 1 && (
                <button
                  onClick={goPrev}
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  ← Précédent
                </button>
              )}
              {step < 6 && (
                <button
                  onClick={goNext}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Suivant →
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Step Content */}
        <div className="animate-fadeIn">
          {/* STEP 1 : Réseau */}
          {step === 1 && (
            <section className="glass rounded-3xl p-8 sm:p-10 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Sur quel réseau est votre paiement ?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Confidance utilise Base. Vérifiez que vous regardez le bon explorateur.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <button
                  onClick={() => setNetwork('mainnet')}
                  className={`p-6 rounded-2xl text-left transition-all border-2 ${
                    network === 'mainnet'
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-500'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Base Mainnet</h3>
                    {network === 'mainnet' && (
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Réseau de production • basescan.org</p>
                </button>
                <button
                  onClick={() => setNetwork('sepolia')}
                  className={`p-6 rounded-2xl text-left transition-all border-2 ${
                    network === 'sepolia'
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-500'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Base Sepolia</h3>
                    {network === 'sepolia' && (
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Réseau de test • sepolia.basescan.org</p>
                </button>
              </div>
              {canProceedStep1 && (
                <button
                  onClick={goNext}
                  className="mt-8 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                >
                  Suivant →
                </button>
              )}
            </section>
          )}

          {/* STEP 2 : Type de paiement */}
          {step === 2 && (
            <section className="glass rounded-3xl p-8 sm:p-10 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Quel type de paiement ?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Cela détermine où chercher sur Basescan.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <button
                  onClick={() => setPaymentType('eth')}
                  className={`p-6 rounded-2xl text-left transition-all border-2 ${
                    paymentType === 'eth'
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-500'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">ETH</h3>
                    {paymentType === 'eth' && (
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Ethereum natif → Internal Transactions</p>
                </button>
                <button
                  onClick={() => setPaymentType('token')}
                  className={`p-6 rounded-2xl text-left transition-all border-2 ${
                    paymentType === 'token'
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-500'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">USDC / USDT</h3>
                    {paymentType === 'token' && (
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Tokens ERC-20 → Token Transfers</p>
                </button>
              </div>
              {canProceedStep2 && (
                <button
                  onClick={goNext}
                  className="mt-8 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                >
                  Suivant →
                </button>
              )}
            </section>
          )}

          {/* STEP 3 : Lien du contrat */}
          {step === 3 && (
            <section className="glass rounded-3xl p-8 sm:p-10 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Avez-vous le lien Basescan de votre contrat ?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Après avoir créé un paiement, Confidance affiche un bouton &quot;Voir sur Basescan&quot;.
              </p>
              <div className="space-y-4 mb-8">
                <button
                  onClick={() => { setHasContractLink(true); setContractAddress(''); }}
                  className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
                    hasContractLink === true ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Oui, j&apos;ai le lien
                </button>
                <button
                  onClick={() => { setHasContractLink(false); setContractAddress(''); }}
                  className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
                    hasContractLink === false ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Non, je dois le récupérer
                </button>
              </div>

              {hasContractLink === true && (
                <div className="space-y-4 animate-fadeIn">
                  <label className="block font-medium text-gray-900 dark:text-white">
                    Collez l&apos;adresse du contrat (0x...)
                  </label>
                  <input
                    type="text"
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                    placeholder="0xabc123..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500">
                    Vous la trouvez dans l&apos;URL Basescan ou dans votre dashboard Confidance.
                  </p>
                </div>
              )}

              {hasContractLink === false && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 animate-fadeIn">
                  <p className="text-gray-800 dark:text-gray-200 mb-4">
                    Allez dans votre <strong>Dashboard</strong> Confidance pour retrouver vos paiements et le lien Basescan associé.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                  >
                    Ouvrir mon Dashboard
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              )}

              {canProceedStep3 && hasContractLink === true && (
                <button
                  onClick={goNext}
                  className="mt-8 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                >
                  Suivant →
                </button>
              )}

              {canProceedStep3 && hasContractLink === false && (
                <button
                  onClick={goNext}
                  className="mt-8 w-full sm:w-auto px-8 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl"
                >
                  J&apos;irai au Dashboard, continuer le guide →
                </button>
              )}
            </section>
          )}

          {/* STEP 4 : Où regarder */}
          {step === 4 && (
            <section className="glass rounded-3xl p-8 sm:p-10 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Sur Basescan : quel onglet ouvrir ?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Selon votre type de paiement, la preuve n&apos;est pas au même endroit.
              </p>
              <div className={`rounded-2xl p-8 ${
                paymentType === 'eth'
                  ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30'
                  : 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30'
              }`}>
                {paymentType === 'eth' ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">ETH</span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Internal Transactions</h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      L&apos;ETH est la monnaie native. Il n&apos;apparaît pas dans &quot;Token Transfers&quot;.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      <li>Allez sur la page de votre contrat</li>
                      <li>Cliquez sur l&apos;onglet <strong>Internal Txns</strong></li>
                      <li>Cherchez la transaction qui envoie l&apos;ETH au bénéficiaire</li>
                    </ol>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg">USDC/USDT</span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Token Transfers (ERC-20)</h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Les tokens émettent des événements visibles dans l&apos;onglet dédié.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      <li>Allez sur la page de votre contrat</li>
                      <li>Cliquez sur l&apos;onglet <strong>Token Transfers</strong></li>
                      <li>Filtrez par USDC ou USDT selon votre paiement</li>
                    </ol>
                  </>
                )}
              </div>
              <button
                onClick={goNext}
                className="mt-8 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
              >
                Suivant →
              </button>
            </section>
          )}

          {/* STEP 5 : Que vérifier */}
          {step === 5 && (
            <section className="glass rounded-3xl p-8 sm:p-10 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Que vérifier sur la transaction ?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Les 3 informations clés pour prouver un paiement.
              </p>
              <div className="space-y-6">
                {[
                  { icon: '💰', title: 'Le montant', desc: 'Vérifiez que le montant correspond à ce que vous avez programmé.' },
                  { icon: '📅', title: 'La date', desc: 'Le timestamp indique exactement quand le paiement a été exécuté.' },
                  { icon: '✅', title: 'Le statut', desc: '"Success" = paiement effectué. "Failed" = quelque chose a échoué.' },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={goNext}
                className="mt-8 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
              >
                Voir le récapitulatif →
              </button>
            </section>
          )}

          {/* STEP 6 : Récapitulatif */}
          {step === 6 && (
            <section className="glass rounded-3xl p-8 sm:p-10 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Récapitulatif
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Vous avez tout ce qu&apos;il faut pour trouver votre preuve.
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-8 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Réseau</span>
                  <span className="font-medium">{network === 'sepolia' ? 'Base Sepolia' : 'Base Mainnet'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">{paymentType === 'token' ? 'USDC/USDT' : 'ETH'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Où regarder</span>
                  <span className="font-medium">{paymentType === 'token' ? 'Token Transfers' : 'Internal Txns'}</span>
                </div>
              </div>

              {contractAddress.trim() ? (
                <a
                  href={fullContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 w-full sm:w-auto justify-center px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-xl hover:shadow-2xl hover:scale-105 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ouvrir mon contrat sur Basescan
                </a>
              ) : (
                <a
                  href={basescanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 w-full sm:w-auto justify-center px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-xl hover:shadow-2xl hover:scale-105 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ouvrir Basescan
                </a>
              )}

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/second-step"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 transition-all"
                >
                  ← Revoir le guide complet
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 transition-all"
                >
                  Dashboard
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
