import React, { useState, useEffect } from "react";

const messages = [
  {
    id: 1,
    emoji: "🎁",
    title: "Cadeaux à effet de temps",
    text: "Programmez un transfert de 1000$ pour l'anniversaire de Jean. Confidance Crypto verrouille vos fonds dans un smart contract dédié qui s'exécute automatiquement à la date définie. La blockchain Core DAO garantit la ponctualité : aucun oubli possible, aucune intervention manuelle. Le cadeau parfait, livré au moment exact."
  },
  {
    id: 2,
    emoji: "🔁",
    title: "Paiements récurrents autonomes",
    text: "Automatisez vos mensualités : 50$ versés à Louis tous les 10 du mois, sans y penser. Le smart contract gère chaque versement de manière autonome sur Core DAO. Idéal pour les freelances, abonnements ou rentes. Vos paiements deviennent prévisibles, traçables et totalement décentralisés."
  },
  {
    id: 3,
    emoji: "💰",
    title: "Épargne auto-bloquée (Time-Lock)",
    text: "Verrouillez 500$ pendant 1 an grâce au time-lock crypto. Vous vous envoyez ces fonds à vous-même, mais impossible d'y toucher avant l'échéance. Le smart contract protège votre épargne contre les tentations. Une discipline financière inscrite dans le code, parfaite pour constituer un patrimoine numérique."
  },
  {
    id: 4,
    emoji: "💼",
    title: "Escrow automatisé pour freelances",
    text: "Sécurisez 2000$ libérés après 3 mois de mission. Le smart contract agit comme tiers de confiance automatique : conditions fixées au départ, impossible de les modifier après déploiement. Ni vous ni le bénéficiaire ne pouvez tricher. Parfait pour jalons de projets, versements échelonnés et contrats professionnels."
  },
  {
    id: 5,
    emoji: "🏛",
    title: "Transmission patrimoniale programmée",
    text: "Organisez votre succession crypto dès maintenant. Programmez un transfert conditionnel : si vous n'interagissez pas avec le contrat pendant X années, vos actifs partent automatiquement vers les bénéficiaires désignés. Une solution d'héritage transparent, sécurisée et totalement automatisée sur Core DAO."
  },
  {
    id: 6,
    emoji: "🔒",
    title: "Smart contracts uniques sur Core DAO",
    text: "Chaque paiement différé est scellé dans son propre smart contract déployé sur la blockchain Core DAO. Aucun intermédiaire ne peut bloquer, retarder ou modifier vos transferts. Code open-source, exécution décentralisée, confiance mathématique. Confidance Crypto : la confiance est dans le code, pas dans les banques."
  }
];

function OwlBubble({ onOwlClick }) {
  const [currentMessage, setCurrentMessage] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [messageQueue, setMessageQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // Fonction pour mélanger le tableau (algorithme Fisher-Yates)
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Fonction pour afficher le prochain message
  const showNextMessage = () => {
    // Afficher le message actuel
    setCurrentMessage(messageQueue[currentIndex]);
    setIsVisible(true);

    // Passer à l'index suivant
    const nextIndex = (currentIndex + 1) % messageQueue.length;

    // Si on revient au début, remélanger la file
    if (nextIndex === 0) {
      setMessageQueue(shuffleArray(messages));
    }

    setCurrentIndex(nextIndex);
  };

  // Initialiser la file de messages mélangée
  useEffect(() => {
    setMessageQueue(shuffleArray(messages));
  }, []);

  // Gestion de l'affichage automatique
  useEffect(() => {
    if (messageQueue.length === 0 || !autoPlayEnabled) return;

    let hideTimeout;
    let intervalId;

    const autoShowMessage = () => {
      showNextMessage();

      // Cacher le message après 30 secondes
      hideTimeout = setTimeout(() => {
        setIsVisible(false);
      }, 30000);
    };

    // Afficher le premier message après 10 secondes
    const initialTimeout = setTimeout(() => {
      autoShowMessage();
    }, 10000);

    // Ensuite afficher un nouveau message toutes les 30 secondes
    intervalId = setInterval(() => {
      autoShowMessage();
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [messageQueue, autoPlayEnabled]);

  // Exposer la fonction showNextMessage au parent via onOwlClick
  useEffect(() => {
    if (onOwlClick && messageQueue.length > 0) {
      onOwlClick(() => showNextMessage);
    }
  }, [onOwlClick, messageQueue, currentIndex]);

  const handleClose = () => {
    setIsVisible(false);
    setAutoPlayEnabled(false);
  };

  if (!currentMessage || !isVisible) {
    return null;
  }

  return (
    <div className="owl-bubble-container">
      <div className="owl-bubble">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-2xl">{currentMessage.emoji}</span>
          <h3 className="font-bold text-blue-400 text-lg">{currentMessage.title}</h3>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed">
          {currentMessage.text}
        </p>
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-xl leading-none"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default OwlBubble;
