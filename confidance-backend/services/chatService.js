// services/chatService.js
// Service pour communiquer avec le Chat Agent (n8n webhook)

const CHAT_WEBHOOK_URL = process.env.CHAT_WEBHOOK_URL || 'https://davyvittu.app.n8n.cloud/webhook/chat/confidance';

/**
 * Envoie un message au Chat Agent Confidance
 * @param {string} message - Message utilisateur
 * @param {string} userId - Wallet address ou 'anonymous'
 * @param {object} context - Contexte (page, network, walletConnected, conversationHistory)
 * @returns {Promise<object>} - Réponse du chat agent
 */
async function sendToChatAgent(message, userId = 'anonymous', context = {}) {
  try {
    console.log('💬 [ChatService] Envoi au Chat Agent:', {
      message: message.substring(0, 50) + '...',
      userId,
      hasHistory: !!(context.conversationHistory && context.conversationHistory.length > 0)
    });

    const response = await fetch(CHAT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        userId,
        context: {
          page: context.page || 'unknown',
          network: context.network || 'BASE',
          walletConnected: context.walletConnected || false,
          conversationHistory: context.conversationHistory || '' // ✅ Historique pour mémoire
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [ChatService] Erreur webhook:', response.status, errorText);
      throw new Error(`Chat webhook error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ [ChatService] Réponse reçue:', {
      intent: data.intent,
      confidence: data.confidence,
      answerLength: data.answer?.length
    });

    return data;

  } catch (error) {
    console.error('❌ [ChatService] Erreur:', error.message);
    throw error;
  }
}

module.exports = {
  sendToChatAgent
};
