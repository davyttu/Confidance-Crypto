-- Script pour corriger la structure Supabase
-- Exécuter dans l'éditeur SQL de Supabase

-- 1. Renommer les colonnes existantes
ALTER TABLE scheduled_payments 
RENAME COLUMN payer_address TO payer;

ALTER TABLE scheduled_payments 
RENAME COLUMN payee_address TO payee;

ALTER TABLE scheduled_payments 
RENAME COLUMN token_symbol TO currency;

ALTER TABLE scheduled_payments 
RENAME COLUMN transaction_hash TO tx_hash;

-- 2. Ajouter les colonnes manquantes
ALTER TABLE scheduled_payments 
ADD COLUMN IF NOT EXISTS amount_decimals INTEGER DEFAULT 18;

ALTER TABLE scheduled_payments 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 8453;

-- 3. Mettre à jour les contraintes
ALTER TABLE scheduled_payments 
ALTER COLUMN payer SET NOT NULL;

ALTER TABLE scheduled_payments 
ALTER COLUMN payee SET NOT NULL;

ALTER TABLE scheduled_payments 
ALTER COLUMN currency SET NOT NULL;

-- 4. Créer un index pour le keeper
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_ready 
ON scheduled_payments (status, release_time) 
WHERE status = 'pending';

-- 5. Vérifier la structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'scheduled_payments' 
ORDER BY ordinal_position;

