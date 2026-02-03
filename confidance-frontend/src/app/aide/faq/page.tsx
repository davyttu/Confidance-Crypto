// src/app/aide/faq/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export default function FAQPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const faqs = [
    {
      categoryKey: 'help.faq.categories.security.title',
      categoryFallback: '🔐 Sécurité',
      questions: [
        {
          qKey: 'help.faq.categories.security.questions.fundsSafe.q',
          qFallback: 'Mes fonds sont-ils en sécurité ?',
          aKey: 'help.faq.categories.security.questions.fundsSafe.a',
          aFallback: 'Oui ! Vos fonds sont verrouillés dans un smart contract audité sur la blockchain Base. Personne (même pas nous) ne peut y toucher avant la date programmée. Vous gardez le contrôle à 100%.',
        },
        {
          qKey: 'help.faq.categories.security.questions.ifConfidanceDisappears.q',
          qFallback: 'Que se passe-t-il si Confidance disparaît ?',
          aKey: 'help.faq.categories.security.questions.ifConfidanceDisappears.a',
          aFallback: 'Vos paiements continueront de fonctionner ! Les smart contracts sont sur la blockchain et fonctionnent de manière autonome. Même si notre site est hors ligne, les paiements seront libérés automatiquement.',
        },
      ],
    },
    {
      categoryKey: 'help.faq.categories.fees.title',
      categoryFallback: '💰 Frais',
      questions: [
        {
          qKey: 'help.faq.categories.fees.questions.whatFees.q',
          qFallback: 'Quels sont les frais ?',
          aKey: 'help.faq.categories.fees.questions.whatFees.a',
          aFallback: 'Il y a 2 types de frais : 1) Frais blockchain (gas) : ~0.002 ETH à la création. 2) Frais protocole : 1.79% du montant, prélevés automatiquement lors de la libération.',
        },
        {
          qKey: 'help.faq.categories.fees.questions.feeExample.q',
          qFallback: 'Exemple de calcul de frais',
          aKey: 'help.faq.categories.fees.questions.feeExample.a',
          aFallback: 'Pour envoyer 0.1 ETH : Frais gas (création) : 0.002 ETH. Frais protocole (1.79%) : 0.00179 ETH. Le bénéficiaire reçoit : 0.09821 ETH.',
        },
      ],
    },
    {
      categoryKey: 'help.faq.categories.dates.title',
      categoryFallback: '📅 Dates et Délais',
      questions: [
        {
          qKey: 'help.faq.categories.dates.questions.canCancel.q',
          qFallback: 'Puis-je annuler un paiement ?',
          aKey: 'help.faq.categories.dates.questions.canCancel.a',
          aFallback: 'Oui, si vous avez coché "Permettre l\'annulation" lors de la création. L\'annulation doit être faite AVANT la date prévue. Vous récupérez 100% du montant (pas de frais).',
        },
        {
          qKey: 'help.faq.categories.dates.questions.minDate.q',
          qFallback: 'Quelle est la date minimale ?',
          aKey: 'help.faq.categories.dates.questions.minDate.a',
          aFallback: 'Vous pouvez programmer un paiement dans quelques minutes ou dans plusieurs années. Il n\'y a pas de limite.',
        },
      ],
    },
    {
      categoryKey: 'help.faq.categories.technical.title',
      categoryFallback: '⚙️ Technique',
      questions: [
        {
          qKey: 'help.faq.categories.technical.questions.blockchain.q',
          qFallback: 'Quelle blockchain utilisez-vous ?',
          aKey: 'help.faq.categories.technical.questions.blockchain.a',
          aFallback: 'Nous utilisons Base Mainnet (Layer 2 d\'Ethereum). C\'est rapide, sécurisé et avec des frais très bas.',
        },
        {
          qKey: 'help.faq.categories.technical.questions.tokens.q',
          qFallback: 'Puis-je envoyer des tokens (USDC, DAI) ?',
          aKey: 'help.faq.categories.technical.questions.tokens.a',
          aFallback: 'Support ERC20 à venir prochainement ! Pour l\'instant, seul l\'ETH natif est disponible.',
        },
        {
          qKey: 'help.faq.categories.technical.questions.metamaskRecurring.q',
          qFallback: 'Pourquoi plusieurs fenêtres MetaMask pour un paiement récurrent ?',
          aKey: 'help.faq.categories.technical.questions.metamaskRecurring.a',
          aFallback: 'Pour un paiement récurrent (ex. 1 USDC × 3 mois), vous voyez 3 étapes :\n\n1) Première approbation — Vous autorisez la plateforme à utiliser vos tokens pour créer le contrat.\n\n2) Création — La transaction qui enregistre votre planning (montant, durée, bénéficiaire).\n\n3) Deuxième approbation — Vous autorisez le contrat créé à prélever le total des mensualités (ex. 3 USDC pour 3 mois).\n\nC’est le fonctionnement normal des tokens : chaque “dépenseur” doit être autorisé séparément.\n\nPlusieurs destinataires : il peut y avoir des fenêtres MetaMask supplémentaires (une approbation par contrat par bénéficiaire).',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          {isMounted && translationsReady ? t('help.faq.back') : '← Retour au centre d\'aide'}
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isMounted && translationsReady ? t('help.faq.title') : '❓ Questions Fréquentes (FAQ)'}
        </h1>
        <p className="text-gray-600 mb-12">
          {isMounted && translationsReady ? t('help.faq.subtitle') : 'Trouvez rapidement les réponses aux questions les plus courantes'}
        </p>

        <div className="space-y-8">
          {faqs.map((category, catIndex) => (
            <div key={catIndex}>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {isMounted && translationsReady ? t(category.categoryKey) : category.categoryFallback}
              </h2>
              <div className="space-y-3">
                {category.questions.map((faq, qIndex) => {
                  const globalIndex = catIndex * 100 + qIndex;
                  const isOpen = openIndex === globalIndex;

                  return (
                    <div key={qIndex} className="bg-white rounded-xl shadow-md overflow-hidden">
                      <button
                        onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-semibold text-gray-900 pr-4">
                          {isMounted && translationsReady ? t(faq.qKey) : faq.qFallback}
                        </span>
                        <ChevronDownIcon
                          className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-4 text-gray-700 border-t border-gray-100 pt-4 whitespace-pre-line">
                          {isMounted && translationsReady ? t(faq.aKey) : faq.aFallback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-blue-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">{isMounted && translationsReady ? t('help.faq.notFound.title') : 'Vous ne trouvez pas votre réponse ?'}</h2>
          <p className="mb-6 text-blue-100">
            {isMounted && translationsReady ? t('help.faq.notFound.description') : 'Notre équipe de support est là pour vous aider'}
          </p>
          <Link
            href="/aide/contact"
            className="inline-block px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
          >
            {isMounted && translationsReady ? t('help.faq.notFound.button') : '💬 Contacter le support'}
          </Link>
        </div>
      </div>
    </div>
  );
}