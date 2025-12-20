// services/chatMemoryService.js
// Gestion de la mémoire conversationnelle avec Supabase
// TABLES: marilyn_conversations, marilyn_messages

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Récupère ou crée une conversation active pour un utilisateur
 * @param {string} userId - Wallet address ou 'anonymous'
 * @returns {Promise<object>} Conversation object
 */
async function getOrCreateConversation(userId) {
  try {
    // Chercher une conversation active récente (< 24h)
    const { data: existing, error: fetchError } = await supabase
      .from('marilyn_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
      throw fetchError;
    }

    // Si une conversation existe et est récente
    if (existing) {
      console.log('💬 [Memory] Conversation existante:', existing.id);
      return existing;
    }

    // Sinon créer une nouvelle conversation
    const { data: newConv, error: createError } = await supabase
      .from('marilyn_conversations')
      .insert([{
        user_id: userId,
        started_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        message_count: 0,
        is_active: true,
        metadata: {}
      }])
      .select()
      .single();

    if (createError) throw createError;

    console.log('✨ [Memory] Nouvelle conversation créée:', newConv.id);
    return newConv;

  } catch (error) {
    console.error('❌ [Memory] Erreur getOrCreateConversation:', error);
    throw error;
  }
}

/**
 * Récupère l'historique des N derniers messages
 * @param {string} conversationId - UUID de la conversation
 * @param {number} limit - Nombre de messages à récupérer (défaut: 10)
 * @returns {Promise<array>} Array de messages
 */
async function getConversationHistory(conversationId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('marilyn_messages')
      .select('role, content, intent, confidence, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Retourner dans l'ordre chronologique
    const messages = (data || []).reverse();
    
    console.log(`📚 [Memory] Historique récupéré: ${messages.length} messages`);
    return messages;

  } catch (error) {
    console.error('❌ [Memory] Erreur getConversationHistory:', error);
    return []; // Retourner tableau vide en cas d'erreur
  }
}

/**
 * Sauvegarde un message utilisateur
 * @param {string} conversationId - UUID de la conversation
 * @param {string} content - Contenu du message
 * @param {object} metadata - Métadonnées additionnelles
 */
async function saveUserMessage(conversationId, content, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('marilyn_messages')
      .insert([{
        conversation_id: conversationId,
        role: 'user',
        content: content,
        metadata: metadata
      }])
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le compteur et last_message_at
    await supabase
      .from('marilyn_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: supabase.sql`message_count + 1`
      })
      .eq('id', conversationId);

    console.log('💾 [Memory] Message utilisateur sauvegardé');
    return data;

  } catch (error) {
    console.error('❌ [Memory] Erreur saveUserMessage:', error);
    throw error;
  }
}

/**
 * Sauvegarde une réponse assistant
 * @param {string} conversationId - UUID de la conversation
 * @param {string} content - Contenu de la réponse
 * @param {string} intent - Type d'intent
 * @param {number} confidence - Score de confiance
 * @param {object} metadata - Métadonnées additionnelles
 */
async function saveAssistantMessage(conversationId, content, intent, confidence, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('marilyn_messages')
      .insert([{
        conversation_id: conversationId,
        role: 'assistant',
        content: content,
        intent: intent,
        confidence: confidence,
        metadata: metadata
      }])
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le compteur et last_message_at
    await supabase
      .from('marilyn_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: supabase.sql`message_count + 1`
      })
      .eq('id', conversationId);

    console.log('💾 [Memory] Réponse assistant sauvegardée');
    return data;

  } catch (error) {
    console.error('❌ [Memory] Erreur saveAssistantMessage:', error);
    throw error;
  }
}

/**
 * Formate l'historique pour Claude
 * @param {array} messages - Array de messages
 * @returns {string} Historique formaté
 */
function formatHistoryForClaude(messages) {
  if (!messages || messages.length === 0) {
    return '';
  }

  const history = messages.map(msg => {
    const role = msg.role === 'user' ? 'Utilisateur' : 'Marilyn';
    return `${role}: ${msg.content}`;
  }).join('\n\n');

  return `\n\n=== HISTORIQUE DE LA CONVERSATION ===\n${history}\n=== FIN DE L'HISTORIQUE ===\n\n`;
}

/**
 * Nettoie les conversations inactives (à appeler périodiquement)
 */
async function cleanupOldConversations() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('marilyn_conversations')
      .update({ is_active: false })
      .lt('last_message_at', sevenDaysAgo)
      .eq('is_active', true)
      .select('id');

    if (error) throw error;

    const count = data?.length || 0;
    console.log(`🧹 [Memory] ${count} conversations archivées`);
    return count;

  } catch (error) {
    console.error('❌ [Memory] Erreur cleanupOldConversations:', error);
    return 0;
  }
}

module.exports = {
  getOrCreateConversation,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage,
  formatHistoryForClaude,
  cleanupOldConversations
};
