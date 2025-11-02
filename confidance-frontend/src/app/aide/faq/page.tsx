// src/app/aide/faq/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      category: '🔐 Sécurité',
      questions: [
        {
          q: 'Mes fonds sont-ils en sécurité ?',
          a: 'Oui ! Vos fonds sont verrouillés dans un smart contract audité sur la blockchain Base. Personne (même pas nous) ne peut y toucher avant la date programmée. Vous gardez le contrôle à 100%.',
        },
        {
          q: 'Que se passe-t-il si Confidance disparaît ?',
          a: 'Vos paiements continueront de fonctionner ! Les smart contracts sont sur la blockchain et fonctionnent de manière autonome. Même si notre site est hors ligne, les paiements seront libérés automatiquement.',
        },
      ],
    },
    {
      category: '💰 Frais',
      questions: [
        {
          q: 'Quels sont les frais ?',
          a: 'Il y a 2 types de frais : 1) Frais blockchain (gas) : ~0.002 ETH à la création. 2) Frais protocole : 1.79% du montant, prélevés automatiquement lors de la libération.',
        },
        {
          q: 'Exemple de calcul de frais',
          a: 'Pour envoyer 0.1 ETH : Frais gas (création) : 0.002 ETH. Frais protocole (1.79%) : 0.00179 ETH. Le bénéficiaire reçoit : 0.09821 ETH.',
        },
      ],
    },
    {
      category: '📅 Dates et Délais',
      questions: [
        {
          q: 'Puis-je annuler un paiement ?',
          a: 'Oui, si vous avez coché "Permettre l\'annulation" lors de la création. L\'annulation doit être faite AVANT la date prévue. Vous récupérez 100% du montant (pas de frais).',
        },
        {
          q: 'Quelle est la date minimale ?',
          a: 'Vous pouvez programmer un paiement dans quelques minutes ou dans plusieurs années. Il n\'y a pas de limite.',
        },
      ],
    },
    {
      category: '⚙️ Technique',
      questions: [
        {
          q: 'Quelle blockchain utilisez-vous ?',
          a: 'Nous utilisons Base Mainnet (Layer 2 d\'Ethereum). C\'est rapide, sécurisé et avec des frais très bas.',
        },
        {
          q: 'Puis-je envoyer des tokens (USDC, DAI) ?',
          a: 'Support ERC20 à venir prochainement ! Pour l\'instant, seul l\'ETH natif est disponible.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          ← Retour au centre d'aide
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ❓ Questions Fréquentes (FAQ)
        </h1>
        <p className="text-gray-600 mb-12">
          Trouvez rapidement les réponses aux questions les plus courantes
        </p>

        <div className="space-y-8">
          {faqs.map((category, catIndex) => (
            <div key={catIndex}>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {category.category}
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
                          {faq.q}
                        </span>
                        <ChevronDownIcon
                          className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-4 text-gray-700 border-t border-gray-100 pt-4">
                          {faq.a}
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
          <h2 className="text-2xl font-bold mb-3">Vous ne trouvez pas votre réponse ?</h2>
          <p className="mb-6 text-blue-100">
            Notre équipe de support est là pour vous aider
          </p>
          <Link
            href="/aide/contact"
            className="inline-block px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
          >
            💬 Contacter le support
          </Link>
        </div>
      </div>
    </div>
  );
}