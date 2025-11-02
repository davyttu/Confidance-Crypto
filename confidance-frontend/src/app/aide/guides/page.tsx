// src/app/aide/guides/page.tsx
import Link from 'next/link';
import { RocketLaunchIcon, CurrencyDollarIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function GuidesPage() {
  const guides = [
    {
      icon: RocketLaunchIcon,
      title: 'Créer votre premier paiement',
      description: 'Guide complet pour envoyer votre premier paiement programmé',
      duration: '5 min',
      level: 'Débutant',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: CurrencyDollarIcon,
      title: 'Comprendre les frais',
      description: 'Calculez précisément les coûts de vos paiements',
      duration: '3 min',
      level: 'Débutant',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: CalendarIcon,
      title: 'Annuler un paiement',
      description: 'Comment annuler un paiement avant sa libération',
      duration: '2 min',
      level: 'Intermédiaire',
      color: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          ← Retour au centre d'aide
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          📚 Guides Pratiques
        </h1>
        <p className="text-gray-600 mb-12">
          Tutoriels détaillés pour maîtriser Confidance Crypto
        </p>

        <div className="space-y-6">
          {guides.map((guide, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${guide.color} flex items-center justify-center flex-shrink-0`}>
                  <guide.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {guide.title}
                  </h2>
                  <p className="text-gray-600 mb-3">
                    {guide.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                      ⏱️ {guide.duration}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                      📊 {guide.level}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-3">💡 Astuce</h2>
          <p className="text-white/90">
            Commencez par créer un paiement test avec un petit montant (0.001 ETH) pour vous familiariser avec le processus !
          </p>
        </div>
      </div>
    </div>
  );
}