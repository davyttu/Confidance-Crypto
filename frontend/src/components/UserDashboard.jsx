import React from "react";

function UserDashboard({ user, wallet }) {
  // Fonction pour tronquer l’adresse affichée
  const formatAddress = (addr) => {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  return (
    <div className="max-w-3xl mx-auto bg-gray-900 p-8 rounded-2xl shadow-lg border border-gray-800">
      <h2 className="text-3xl font-semibold text-blue-400 mb-6">
        Tableau de bord utilisateur
      </h2>

      {/* 🧑 Informations utilisateur */}
      {user ? (
        <div className="space-y-4">
          <p className="text-lg text-gray-300">
            Bienvenue, <span className="font-bold text-blue-300">{user.name}</span> 👋
          </p>

          {/* 💳 Wallet connecté */}
          {wallet ? (
            <div className="flex items-center space-x-3 bg-gray-800 border border-gray-700 p-4 rounded-xl">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-gray-200">
                Wallet connecté :{" "}
                <span className="font-mono text-blue-300">{formatAddress(wallet)}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-3 bg-gray-800 border border-gray-700 p-4 rounded-xl">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="text-gray-400">
                Aucun wallet connecté — veuillez connecter un portefeuille pour interagir.
              </span>
            </div>
          )}

          {/* 📅 Paiements planifiés */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-blue-400 mb-3">
              Paiements programmés
            </h3>
            <div className="bg-gray-800 p-4 rounded-lg text-gray-400">
              <p>Aucun paiement enregistré pour le moment.</p>
              <p className="text-sm text-gray-500 mt-1">
                Vos paiements différés, abonnements et versements futurs
                apparaîtront ici.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-400">
          Connectez-vous ou créez un compte pour accéder à votre tableau de bord.
        </p>
      )}
    </div>
  );
}

export default UserDashboard;
