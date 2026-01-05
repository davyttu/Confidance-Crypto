-- Schema pour la table payment_transactions dans Supabase
-- Cette table stocke les frais de gas pour chaque paiement

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Référence au paiement
  payment_id UUID NOT NULL,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('scheduled', 'recurring')),
  
  -- Informations sur les transactions
  transaction_hashes TEXT[] NOT NULL, -- Array des hash de transactions (1 pour ETH natif, 2 pour ERC20)
  
  -- Détails des frais de gas pour chaque transaction
  -- Format: Array of objects: [{ hash: string, gas_used: string, gas_price: string, total_gas_fee: string }]
  gas_fees JSONB NOT NULL,
  
  -- Total des frais de gas (somme de tous les gas)
  total_gas_fee TEXT NOT NULL, -- En wei (string pour gérer les grands nombres)
  
  -- Réseau blockchain
  network VARCHAR(50) NOT NULL DEFAULT 'base_mainnet',
  chain_id INTEGER NOT NULL DEFAULT 8453,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contrainte unique: un paiement ne peut avoir qu'un seul enregistrement de gas
  UNIQUE(payment_id, payment_type)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id_type 
ON payment_transactions(payment_id, payment_type);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_network 
ON payment_transactions(network);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at 
ON payment_transactions(created_at DESC);

-- Commentaires pour documentation
COMMENT ON TABLE payment_transactions IS 'Stocke les frais de gas pour chaque paiement programmé ou récurrent';
COMMENT ON COLUMN payment_transactions.payment_id IS 'ID du paiement dans scheduled_payments ou recurring_payments';
COMMENT ON COLUMN payment_transactions.payment_type IS 'Type de paiement: scheduled ou recurring';
COMMENT ON COLUMN payment_transactions.transaction_hashes IS 'Array des hash de transactions (1 pour ETH natif, 2 pour ERC20: approbation + création)';
COMMENT ON COLUMN payment_transactions.gas_fees IS 'Array JSON des frais de gas détaillés pour chaque transaction';
COMMENT ON COLUMN payment_transactions.total_gas_fee IS 'Total des frais de gas en wei (somme de tous les gas)';




