-- Ajouter une colonne monthly_statuses pour tracker le statut de chaque mensualité
-- Format: {"0": "executed", "1": "failed", "2": "pending", ...}

ALTER TABLE public.recurring_payments
ADD COLUMN IF NOT EXISTS monthly_statuses JSONB DEFAULT '{}';

-- Commenter la colonne
COMMENT ON COLUMN public.recurring_payments.monthly_statuses IS 'Statuts individuels par mois (0-indexed): executed, failed, pending';

-- Créer un index pour optimiser les requêtes JSON
CREATE INDEX IF NOT EXISTS idx_recurring_payments_monthly_statuses
ON public.recurring_payments USING GIN (monthly_statuses);
