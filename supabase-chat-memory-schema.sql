-- =====================================================
-- SCHEMA SUPABASE - SYSTÈME DE MÉMOIRE CHAT
-- Confidance - Marilyn Chat Agent V2
-- =====================================================

-- Table des conversations (sessions de chat)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des messages individuels
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  confidence NUMERIC(3,2),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON chat_conversations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at DESC);

-- Vue pour récupérer facilement les conversations avec leurs messages
CREATE OR REPLACE VIEW chat_history AS
SELECT 
  c.id as conversation_id,
  c.user_id,
  c.started_at,
  c.last_message_at,
  c.message_count,
  c.is_active,
  COALESCE(
    json_agg(
      json_build_object(
        'id', m.id,
        'role', m.role,
        'content', m.content,
        'intent', m.intent,
        'confidence', m.confidence,
        'created_at', m.created_at
      ) ORDER BY m.created_at ASC
    ) FILTER (WHERE m.id IS NOT NULL),
    '[]'::json
  ) as messages
FROM chat_conversations c
LEFT JOIN chat_messages m ON m.conversation_id = c.id
GROUP BY c.id, c.user_id, c.started_at, c.last_message_at, c.message_count, c.is_active;

-- Fonction pour nettoyer les vieilles conversations (optionnel)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Marquer comme inactives les conversations de plus de 7 jours sans activité
  UPDATE chat_conversations
  SET is_active = false
  WHERE last_message_at < NOW() - INTERVAL '7 days'
    AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Activer RLS (Row Level Security) pour sécurité
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Politique RLS : permettre tout pour le service role (backend)
CREATE POLICY "Service role can do everything on conversations"
  ON chat_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on messages"
  ON chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- EXEMPLES DE REQUÊTES UTILES
-- =====================================================

-- Récupérer les 10 derniers messages d'un utilisateur
-- SELECT * FROM chat_messages 
-- WHERE conversation_id IN (
--   SELECT id FROM chat_conversations 
--   WHERE user_id = '0x123...' AND is_active = true
--   ORDER BY last_message_at DESC
--   LIMIT 1
-- )
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Compter le nombre de conversations actives
-- SELECT COUNT(*) FROM chat_conversations WHERE is_active = true;

-- Statistiques par utilisateur
-- SELECT 
--   user_id,
--   COUNT(DISTINCT id) as total_conversations,
--   SUM(message_count) as total_messages,
--   MAX(last_message_at) as last_activity
-- FROM chat_conversations
-- GROUP BY user_id
-- ORDER BY total_messages DESC;

COMMENT ON TABLE chat_conversations IS 'Sessions de chat avec Marilyn';
COMMENT ON TABLE chat_messages IS 'Messages individuels dans les conversations';
COMMENT ON VIEW chat_history IS 'Vue combinée conversations + messages pour faciliter les requêtes';
