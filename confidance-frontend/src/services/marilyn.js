// 👑 MARILYN API CLIENT - Version Chat Agent V1
// src/services/marilyn.js

// ✅ Nouveau endpoint Chat Agent
const CHAT_API_URL = "/api/chat";

/**
 * Envoie un message au Chat Agent Confidance
 * @param {string} message - Le message de l'utilisateur
 * @param {string} userId - ID utilisateur (wallet address ou "anonymous")
 * @param {Object} options - Options additionnelles
 * @returns {Promise<Object>} Réponse du Chat Agent
 */
export async function sendToMarilyn(message, userId = "anonymous", options = {}) {
  // Validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error("Message requis");
  }

  // Préparer le payload pour le nouveau format
  const payload = {
    message: message.trim(),
    context: {
      page: options.page || (typeof window !== 'undefined' ? window.location.pathname : '/'),
      network: options.network || 'BASE',
      walletConnected: userId !== 'anonymous',
      walletAddress: userId !== 'anonymous' ? userId : undefined,
      ...options.context
    }
  };

  console.log('💬 Envoi au Chat Agent:', { 
    user: userId.substring(0, 10) + '...', 
    message: message.substring(0, 50),
    context: payload.context
  });

  try {
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur HTTP:', response.status, errorText);
      
      // Si le chat agent est indisponible (503)
      if (response.status === 503) {
        throw new Error('Chat temporairement indisponible');
      }
      
      throw new Error(`Erreur serveur (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ Réponse Chat Agent:', {
      intent: data.intent,
      confidence: data.confidence,
      answerLength: data.answer?.length
    });

    // Retourner dans le format attendu par ChatModal.jsx
    return {
      success: data.success || true,
      marilyn_response: data.answer, // Réponse du Chat Agent
      intent: data.intent,
      confidence: data.confidence,
      timestamp: data.timestamp,
      response_from: 'chat-agent',
      // Compatibilité avec l'ancien format
      message: data.answer
    };

  } catch (error) {
    console.error("❌ Erreur Chat Agent:", error);

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Impossible de contacter le chat. Vérifiez votre connexion');
    }

    throw error;
  }
}

/**
 * Gère ou crée un ID de session
 * @returns {string} Session ID
 */
function getOrCreateSessionId() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  let sessionId = sessionStorage.getItem('marilyn_chat_session');
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('marilyn_chat_session', sessionId);
  }
  
  return sessionId;
}

/**
 * Rate limiting simple (5 messages par minute)
 */
const messageTimestamps = [];

function canSendMessage() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  const recentMessages = messageTimestamps.filter(t => t > oneMinuteAgo);
  messageTimestamps.length = 0;
  messageTimestamps.push(...recentMessages);
  
  if (recentMessages.length >= 5) {
    return false;
  }
  
  messageTimestamps.push(now);
  return true;
}

/**
 * Envoie un message avec rate limiting
 */
export async function sendToMarilynSafe(message, userId, options) {
  if (!canSendMessage()) {
    throw new Error("Trop de messages. Veuillez patienter 1 minute.");
  }
  
  return sendToMarilyn(message, userId, options);
}

/**
 * Hook React (optionnel)
 */
export function useMarilynChat() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const send = async (message, userId) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendToMarilynSafe(message, userId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { send, isLoading, error };
}

export default {
  sendToMarilyn,
  sendToMarilynSafe,
  useMarilynChat
};
