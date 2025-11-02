// src/app/aide/debuter/page.tsx
import Link from 'next/link';

export default function DebuterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          ← Retour au centre d'aide
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          🚀 Débuter avec Confidance Crypto
        </h1>

        <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Qu'est-ce que Confidance Crypto ?
          </h2>
          <p className="text-gray-700 mb-4">
            Confidance Crypto est une plateforme DeFi qui permet de programmer des paiements crypto automatiques. 
            Envoyez de l'ETH ou des tokens qui seront libérés automatiquement à une date précise.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ✅ Ce dont vous avez besoin
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <strong className="text-gray-900">Un wallet crypto</strong>
                <p className="text-gray-600">MetaMask, Coinbase Wallet, Rainbow, etc.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <strong className="text-gray-900">Des ETH sur Base Mainnet</strong>
                <p className="text-gray-600">Minimum ~0.01 ETH pour les frais + montant à envoyer</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <strong className="text-gray-900">L'adresse du destinataire</strong>
                <p className="text-gray-600">Adresse Ethereum (0x...)</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📚 Prochaines étapes
          </h2>
          <div className="space-y-4">
            <Link
              href="/aide/guides"
              className="block p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <h3 className="font-semibold text-blue-900 mb-1">
                1. Créer votre premier paiement
              </h3>
              <p className="text-blue-700 text-sm">
                Tutoriel pas-à-pas pour envoyer votre premier paiement programmé
              </p>
            </Link>
            <Link
              href="/aide/faq"
              className="block p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <h3 className="font-semibold text-purple-900 mb-1">
                2. Questions fréquentes
              </h3>
              <p className="text-purple-700 text-sm">
                Sécurité, frais, délais... toutes les réponses
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}