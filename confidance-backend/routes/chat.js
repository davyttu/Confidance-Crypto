// routes/chat.js
// Route API pour le Chat Agent Confidance avec MÉMOIRE SAFE

const express = require('express');
const router = express.Router();
const { sendToChatAgent } = require('../services/chatService');
const {
  getOrCreateConversation,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage,
  formatHistoryForClaude
} = require('../services/chatMemoryService');
const { optionalAuth } = require('../middleware/auth');

/**
 * POST /api/chat
 * Envoie un message au Chat Agent avec mémoire conversationnelle SAFE
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { message, context } = req.body;
    const { user } = req;

    // Validation
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message requis',
        success: false 
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Message vide',
        success: false 
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({ 
        error: 'Message trop long (max 1000 caractères)',
        success: false 
      });
    }

    // Déterminer userId
    const userId = user?.walletAddress || context?.walletAddress || 'anonymous';

    console.log('💬 [Chat API] Nouvelle requête:', {
      userId: userId.substring(0, 10) + '...',
      messageLength: message.length,
      context: context?.page
    });

    // ✅ MÉMOIRE - Tentative en mode SAFE (non bloquant)
    let conversationId = null;
    let history = [];
    let formattedHistory = '';

    try {
      // Récupérer ou créer la conversation
      const conversation = await getOrCreateConversation(userId);
      conversationId = conversation.id;

      // Récupérer l'historique (10 derniers messages)
      history = await getConversationHistory(conversationId, 10);

      // Sauvegarder le message utilisateur
      await saveUserMessage(conversationId, message, { context });

      // Formater l'historique pour Claude
      formattedHistory = formatHistoryForClaude(history);

      console.log('✅ [Memory] Mémoire activée:', {
        conversationId,
        historyLength: history.length
      });

    } catch (memoryError) {
      // Si la mémoire échoue, on continue sans elle
      console.warn('⚠️ [Memory] Mémoire indisponible, continue sans:', memoryError.message);
    }

    // ✅ Appeler le Chat Agent (avec ou sans historique)
    const chatResponse = await sendToChatAgent(
      message, 
      userId, 
      {
        ...context,
        conversationHistory: formattedHistory
      }
    );

    // ✅ Sauvegarder la réponse (tentative non bloquante)
    if (conversationId) {
      try {
        await saveAssistantMessage(
          conversationId,
          chatResponse.answer,
          chatResponse.intent,
          chatResponse.confidence,
          { context }
        );
      } catch (saveError) {
        console.warn('⚠️ [Memory] Impossible de sauvegarder la réponse:', saveError.message);
      }
    }

    // ✅ Retourner la réponse
    res.json({
      success: true,
      answer: chatResponse.answer,
      intent: chatResponse.intent,
      confidence: chatResponse.confidence,
      conversationId: conversationId, // Pour debug
      historyLength: history.length, // Pour debug
      memoryEnabled: conversationId !== null, // Indique si la mémoire fonctionne
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Chat API] Erreur:', error.message);
    
    // Erreur de timeout ou webhook indisponible
    if (error.message.includes('fetch') || error.message.includes('webhook')) {
      return res.status(503).json({
        success: false,
        error: 'Chat temporairement indisponible',
        fallback: "Désolé, je suis temporairement indisponible. Veuillez réessayer dans quelques instants."
      });
    }

    // Autre erreur
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: "Une erreur est survenue. Veuillez réessayer."
    });
  }
});

/**
 * GET /api/chat/health
 * Vérifie que le chat agent est disponible
 */
router.get('/health', async (req, res) => {
  try {
    const testResponse = await sendToChatAgent(
      "Test de santé", 
      "health-check",
      { page: "health", network: "BASE", walletConnected: false }
    );

    res.json({
      status: 'ok',
      chatAgentAvailable: true,
      memoryEnabled: true,
      responseTime: testResponse.confidence ? 'fast' : 'slow'
    });
  } catch (error) {
    res.json({
      status: 'degraded',
      chatAgentAvailable: false,
      memoryEnabled: true,
      error: error.message
    });
  }
});

/**
 * GET /api/chat/history/:userId
 * Récupère l'historique des conversations d'un utilisateur
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const conversation = await getOrCreateConversation(userId);
    const history = await getConversationHistory(conversation.id, 50);

    res.json({
      success: true,
      conversationId: conversation.id,
      messageCount: history.length,
      messages: history
    });

  } catch (error) {
    console.error('❌ [Chat API] Erreur history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
