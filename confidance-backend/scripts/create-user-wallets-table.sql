-- Table pour gérer plusieurs wallets par utilisateur
-- À exécuter dans Supabase SQL Editor

-- Créer la table user_wallets
CREATE TABLE IF NOT EXISTS user_wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  label VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un wallet ne peut être lié qu'à un seul utilisateur
  CONSTRAINT unique_wallet_address UNIQUE (wallet_address),

  -- Un utilisateur ne peut avoir qu'un seul wallet primary
  CONSTRAINT unique_primary_per_user UNIQUE (user_id, is_primary) WHERE is_primary = TRUE
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_is_primary ON user_wallets(is_primary) WHERE is_primary = TRUE;

-- Commentaires
COMMENT ON TABLE user_wallets IS 'Stocke plusieurs wallets par utilisateur';
COMMENT ON COLUMN user_wallets.wallet_address IS 'Adresse du wallet (en lowercase)';
COMMENT ON COLUMN user_wallets.is_primary IS 'Si true, c''est le wallet principal de l''utilisateur';
COMMENT ON COLUMN user_wallets.label IS 'Nom personnalisé du wallet (ex: MetaMask Pro, Coinbase Personnel)';

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_user_wallets_updated_at_trigger ON user_wallets;
CREATE TRIGGER update_user_wallets_updated_at_trigger
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_wallets_updated_at();

-- Migration des wallets existants depuis users.primary_wallet (si ils existent)
-- Cette partie s'exécutera sans erreur même si primary_wallet n'existe pas
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Vérifier si la colonne primary_wallet existe
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'primary_wallet'
  ) THEN
    -- Migrer les wallets existants
    FOR user_record IN
      SELECT id, primary_wallet
      FROM users
      WHERE primary_wallet IS NOT NULL
      AND primary_wallet != ''
    LOOP
      -- Insérer dans user_wallets si pas déjà présent
      INSERT INTO user_wallets (user_id, wallet_address, is_primary, label)
      VALUES (
        user_record.id,
        LOWER(user_record.primary_wallet),
        TRUE,
        'Wallet principal'
      )
      ON CONFLICT (wallet_address) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Migration des wallets existants terminée';
  ELSE
    RAISE NOTICE 'Colonne primary_wallet non trouvée, aucune migration nécessaire';
  END IF;
END $$;
