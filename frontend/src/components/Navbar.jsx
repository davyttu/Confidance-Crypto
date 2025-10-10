import React, { useState } from "react";
import WalletButton from "./WalletButton";
import OwlBubble from "./OwlBubble";

function Navbar({ user, onLogout, onNavigate, onConnectWallet }) {
  const [triggerBubble, setTriggerBubble] = useState(null);

  const handleOwlClick = () => {
    if (triggerBubble) {
      triggerBubble();
    }
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 text-gray-100 px-8 py-4 flex justify-between items-center shadow-lg">
      {/* Logo / Nom du projet */}
      <div className="flex items-center gap-3">
        <div
          className="text-2xl font-bold text-blue-400 cursor-pointer hover:text-blue-300 transition"
          onClick={() => onNavigate("signup")}
        >
          Confidance Crypto
        </div>

        {/* Hibou animé */}
        <div className="relative">
          <div className="cursor-pointer select-none owl-pulse" onClick={handleOwlClick}>
            {/* Corps du hibou */}
            <div className="text-2xl owl-hover">
              🦉
            </div>
          </div>
          {/* Bulle de discussion */}
          <OwlBubble onOwlClick={setTriggerBubble} />
        </div>
      </div>

      {/* Liens de navigation */}
      <div className="flex space-x-4 items-center">
        <button
          onClick={() => onNavigate("payment")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Programmer un paiement
        </button>
        <button
          onClick={() => onNavigate("dashboard")}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Tableau de bord
        </button>

        {/* Connexion utilisateur */}
        {user ? (
          <>
            <span className="text-sm text-gray-400">
              Bonjour, <strong>{user.name}</strong>
            </span>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm"
            >
              Déconnexion
            </button>
          </>
        ) : (
          <button
            onClick={() => onNavigate("signup")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Se connecter
          </button>
        )}

        {/* Bouton Wallet */}
        <WalletButton onConnect={onConnectWallet} />
      </div>
    </nav>
  );
}

export default Navbar;
