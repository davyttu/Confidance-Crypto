-- Table pour enregistrer l'envoi des relevés mensuels
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS monthly_statements (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_to VARCHAR(255),
  pdf_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_statement_per_user_period UNIQUE (user_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_statements_user_id ON monthly_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_statements_period ON monthly_statements(period_year, period_month);

COMMENT ON TABLE monthly_statements IS 'Historique des relevés mensuels envoyés par email aux utilisateurs';
