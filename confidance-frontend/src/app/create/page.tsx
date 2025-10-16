import PaymentForm from '@/components/payment/PaymentForm';

export const metadata = {
  title: 'Créer un paiement | Confidance Crypto',
  description: 'Créez un paiement programmé sécurisé sur Base Mainnet',
};

export default function CreatePaymentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Header */}
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            Créer un paiement programmé
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Envoyez de la crypto qui sera automatiquement libérée à la date
            choisie
          </p>
        </div>

        {/* Formulaire */}
        <div className="max-w-3xl mx-auto">
          <PaymentForm />
        </div>

        {/* Section info */}
        <div className="max-w-3xl mx-auto mt-12 grid md:grid-cols-3 gap-6">
          {/* Sécurisé */}
          <div className="text-center p-6 glass rounded-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              100% Sécurisé
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vos fonds sont verrouillés dans un smart contract vérifié
            </p>
          </div>

          {/* Automatique */}
          <div className="text-center p-6 glass rounded-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              Automatique
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Le paiement est libéré automatiquement à la date choisie
            </p>
          </div>

          {/* Transparent */}
          <div className="text-center p-6 glass rounded-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              Transparent
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Suivez votre paiement en temps réel sur Basescan
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}