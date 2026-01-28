-- Table des notifications
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('payment', 'system', 'info')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Commentaires pour la documentation
COMMENT ON TABLE notifications IS 'Stocke les notifications pour les utilisateurs';
COMMENT ON COLUMN notifications.type IS 'Type de notification: payment, system, info';
COMMENT ON COLUMN notifications.read IS 'Indique si la notification a été lue';
