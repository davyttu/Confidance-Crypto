'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BlockchainGuidePage() {
  const [activeTab, setActiveTab] = useState<'eth' | 'token'>('eth');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
      <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        
        {/* SECTION 1 : HERO */}
        <section className="text-center mb-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-8 shadow-2xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Lire la blockchain,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              c'est lire une preuve
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Chaque paiement Confidance laisse une trace publique, vérifiable, inaltérable.
          </p>

          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Cette page vous apprend où la trouver.
          </p>
        </section>

        {/* SECTION 2 : Ce que la blockchain montre/ne montre pas */}
        <section className="glass rounded-3xl p-10 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Ce que la blockchain montre… et ce qu'elle ne montre pas
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Ne montre PAS */}
            <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-8 border-2 border-red-200 dark:border-red-900">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <h3 className="text-2xl font-bold text-red-900 dark:text-red-100">
                  Ne montre PAS
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  "L'intention",
                  "La description",
                  "Le \"pourquoi\"",
                  "Votre nom",
                  "La motivation"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Montre UNIQUEMENT */}
            <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-8 border-2 border-green-200 dark:border-green-900">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
                  Montre UNIQUEMENT
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Ce qui a été exécuté",
                  "Le montant exact",
                  "La date précise",
                  "Les adresses",
                  "Le résultat technique"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white text-center">
            <p className="text-2xl sm:text-3xl font-bold">
              Sur la blockchain, on ne lit pas ce qu'on voulait faire.
              <br />
              <span className="text-yellow-300">On lit ce qui a été fait.</span>
            </p>
          </div>
        </section>

        {/* SECTION 3 : Table de vérité Confidance vs Blockchain */}
        <section className="glass rounded-3xl p-10 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Confidance vs Blockchain : deux réalités complémentaires
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-8 py-5 text-left text-xl font-bold">
                    <span className="flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Confidance
                    </span>
                  </th>
                  <th className="px-8 py-5 text-left text-xl font-bold">
                    <span className="flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Blockchain
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  { confidance: "Formulaire", blockchain: "Code" },
                  { confidance: "Date programmée", blockchain: "Condition" },
                  { confidance: "\"Paiement exécuté\"", blockchain: "Transaction" },
                  { confidance: "Description", blockchain: "Rien" },
                  { confidance: "Intention", blockchain: "Preuve" }
                ].map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-8 py-5 text-lg text-gray-700 dark:text-gray-300 font-medium">
                      {row.confidance}
                    </td>
                    <td className="px-8 py-5 text-lg text-gray-700 dark:text-gray-300 font-mono">
                      {row.blockchain}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-600 p-6 rounded-r-xl">
            <p className="text-gray-800 dark:text-gray-200 text-lg">
              <strong>Pourquoi cette distinction ?</strong><br />
              Confidance vous donne l'expérience. La blockchain vous donne la garantie.
            </p>
          </div>
        </section>

        {/* SECTION 4 : Explorateur de blockchain */}
        <section className="glass rounded-3xl p-10 mb-16">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 bg-gradient-to-r from-green-600 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                L'explorateur de blockchain : le journal public
              </h2>
              <p className="text-xl text-gray-700 dark:text-gray-300">
                Un explorateur, c'est comme un moteur de recherche pour la blockchain.
              </p>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-lg">
                Pourquoi tout est public ?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Parce que c'est la seule façon de garantir que personne ne triche. Si tout le monde peut vérifier, personne ne peut mentir.
              </p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-lg">
                Pourquoi c'est une force, pas un danger ?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Vos données personnelles (nom, email) ne sont jamais sur la blockchain. Seulement les montants, dates, et adresses techniques.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <a
              href="https://basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl p-6 text-white transition-all hover:shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold">Base Mainnet</h3>
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <p className="text-blue-100 mb-2">Le réseau de production</p>
              <code className="text-sm bg-blue-900/50 px-3 py-1 rounded">basescan.org</code>
            </a>

            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl p-6 text-white transition-all hover:shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold">Base Sepolia</h3>
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <p className="text-purple-100 mb-2">Le réseau de test</p>
              <code className="text-sm bg-purple-900/50 px-3 py-1 rounded">sepolia.basescan.org</code>
            </a>
          </div>

          <div className="mt-8 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white text-center">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-2xl font-bold mb-2">Règle d'or</p>
            <p className="text-xl">
              Même adresse + mauvais réseau = <span className="text-yellow-300">rien à voir</span>
            </p>
          </div>
        </section>

        {/* SECTION 5 : Transaction ≠ Paiement */}
        <section className="glass rounded-3xl p-10 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Transaction ≠ Paiement
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Transaction
              </h3>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Une action technique</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Appel d'un smart contract</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Peut réussir sans qu'aucun argent ne bouge</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 rounded-2xl p-8 border-2 border-green-300 dark:border-green-800">
              <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Paiement
              </h3>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Mouvement de valeur</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Argent réellement transféré</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Toujours traçable quelque part</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-8 text-white text-center">
            <p className="text-2xl sm:text-3xl font-bold">
              Une transaction peut réussir<br />
              <span className="text-yellow-200">sans qu'aucun argent ne bouge.</span>
            </p>
          </div>
        </section>

        {/* SECTION 6 : ETH vs Tokens */}
        <section className="glass rounded-3xl p-10 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            ETH vs Tokens : le moment "aha"
          </h2>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
            <button
              onClick={() => setActiveTab('eth')}
              className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                activeTab === 'eth'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Paiement en ETH
            </button>
            <button
              onClick={() => setActiveTab('token')}
              className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                activeTab === 'token'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Paiement en USDC/USDT
            </button>
          </div>

          {/* ETH Content */}
          {activeTab === 'eth' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  🔹 ETH n'est PAS un token
                </h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <svg className="w-8 h-8 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      ETH <strong>n'apparaît PAS</strong> dans "Token Transfers"
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      ETH apparaît dans <strong>"Internal Transactions"</strong>
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
                    Chemin d'un paiement ETH :
                  </p>
                  <div className="flex items-center justify-center gap-4 text-center">
                    <div className="bg-blue-100 dark:bg-blue-900 px-6 py-3 rounded-lg">
                      <p className="font-bold text-gray-900 dark:text-white">Contrat</p>
                    </div>
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="bg-purple-100 dark:bg-purple-900 px-6 py-3 rounded-lg">
                      <p className="font-bold text-gray-900 dark:text-white">Internal TX</p>
                    </div>
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="bg-green-100 dark:bg-green-900 px-6 py-3 rounded-lg">
                      <p className="font-bold text-gray-900 dark:text-white">Destinataire</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600 p-6 rounded-r-xl">
                <p className="text-gray-800 dark:text-gray-200">
                  <strong>💡 Pourquoi ?</strong><br />
                  ETH est la monnaie native de la blockchain. Elle n'a pas besoin de contrat pour exister.
                </p>
              </div>
            </div>
          )}

          {/* Token Content */}
          {activeTab === 'token' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  🔹 Les tokens parlent via des événements
                </h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      USDC/USDT apparaissent dans <strong>"Token Transfers (ERC-20)"</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <svg className="w-8 h-8 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      Chaque transfert émet un événement <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Transfer</code>
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
                    Chemin d'un paiement Token :
                  </p>
                  <div className="flex items-center justify-center gap-4 text-center">
                    <div className="bg-purple-100 dark:bg-purple-900 px-6 py-3 rounded-lg">
                      <p className="font-bold text-gray-900 dark:text-white">USDC Contract</p>
                    </div>
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="bg-pink-100 dark:bg-pink-900 px-6 py-3 rounded-lg">
                      <p className="font-bold text-gray-900 dark:text-white">Event Transfer</p>
                    </div>
                    <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="bg-green-100 dark:bg-green-900 px-6 py-3 rounded-lg">
                      <p className="font-bold text-gray-900 dark:text-white">Token Transfers</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-600 p-6 rounded-r-xl">
                <p className="text-gray-800 dark:text-gray-200 mb-3">
                  <strong>⚠️ Si pas de ligne ERC-20 visible :</strong>
                </p>
                <ul className="space-y-2 ml-6">
                  <li className="text-gray-700 dark:text-gray-300">• Soit pas de transfert réel</li>
                  <li className="text-gray-700 dark:text-gray-300">• Soit mauvais token sélectionné</li>
                  <li className="text-gray-700 dark:text-gray-300">• Soit mauvais réseau</li>
                </ul>
              </div>
            </div>
          )}

          {/* Table récapitulative */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
              <thead className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-lg font-bold">Type de paiement</th>
                  <th className="px-6 py-4 text-left text-lg font-bold">Où regarder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr className="hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold">ETH</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg font-medium">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Internal Transactions
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors">
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold">USDC / USDT</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-4 py-2 rounded-lg font-medium">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Token Transfers (ERC-20)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 7 : Internal Transactions */}
        <section className="glass rounded-3xl p-10 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Pourquoi les "Internal Transactions" sont si importantes
          </h2>

          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-2xl p-8">
              <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">
                Un smart contract peut envoyer de l'ETH <strong>sans être le signataire de la transaction</strong>.
              </p>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Ce que ça signifie :</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>C'est <strong>invisible au premier niveau</strong> de la transaction</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Mais <strong>visible dans "Internal Transactions"</strong></span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>C'est là que Confidance <strong>libère les fonds</strong></span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white text-center">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-3xl font-bold mb-2">
                Quand l'argent sort d'un contrat,
              </p>
              <p className="text-2xl">
                la vérité est dans les <span className="text-yellow-300">Internal Transactions</span>.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 8 : Ce qu'on n'a pas besoin de comprendre */}
        <section className="glass rounded-3xl p-10 mb-16">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Ce que vous n'avez PAS besoin de comprendre
              </h2>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { title: "Bytecode", desc: "Le code machine du contrat" },
              { title: "Gas optimizations", desc: "Les détails techniques des frais" },
              { title: "Appels internes complexes", desc: "La mécanique bas niveau" }
            ].map((item, index) => (
              <div key={index} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-8 text-center border-2 border-purple-300 dark:border-purple-700">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Vous n'avez pas besoin de tout comprendre.
            </p>
            <p className="text-2xl text-gray-700 dark:text-gray-300">
              Juste de savoir <span className="text-purple-600 dark:text-purple-400 font-bold">où regarder</span>.
            </p>
          </div>
        </section>

        {/* SECTION 9 : Pourquoi Confidance enseigne ça */}
        <section className="glass rounded-3xl p-10 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Pourquoi Confidance vous apprend ça
          </h2>

          <div className="space-y-6 mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xl">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    Confidance ne demande pas la confiance
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Nous la rendons <strong>vérifiable</strong>. À tout moment. Par n'importe qui.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-xl p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xl">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    Comprendre la blockchain = autonomie
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Vous ne dépendez plus de nous pour savoir si un paiement a été exécuté. <strong>Vous voyez par vous-même.</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 rounded-xl p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xl">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    C'est notre engagement
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Nous construisons des outils transparents par design. Pas par marketing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-10 text-white text-center">
            <svg className="w-20 h-20 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-3xl font-bold mb-4">
              La transparence n'est pas une option.
            </p>
            <p className="text-xl">
              C'est notre architecture.
            </p>
          </div>
        </section>

        {/* SECTION 10 : CTA Final */}
        <section className="glass rounded-3xl p-12 text-center bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30">
          <svg className="w-24 h-24 mx-auto mb-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Vous savez maintenant<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              lire la preuve
            </span>
          </h2>

          <p className="text-xl text-gray-700 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
            La blockchain n'attend que vous. Chaque paiement Confidance y laisse sa trace.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              href="/find-proof"
              className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Trouver ma preuve étape par étape
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg rounded-xl border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Retour au Dashboard
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
