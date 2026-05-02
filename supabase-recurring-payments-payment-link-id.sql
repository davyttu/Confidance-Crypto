-- Référence optionnelle vers public.payment_links (table existante, PK id text).
-- À exécuter une fois sur Supabase. Permet de marquer le lien "completed" quand toutes les mensualités sont faites.

ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS payment_link_id text NULL;

COMMENT ON COLUMN public.recurring_payments.payment_link_id IS
  'payment_links.id si le récurrent a été créé depuis un lien de paiement';

-- Contrainte FK optionnelle (commenter si erreur sur données existantes)
-- ALTER TABLE public.recurring_payments
--   ADD CONSTRAINT recurring_payments_payment_link_id_fkey
--   FOREIGN KEY (payment_link_id) REFERENCES public.payment_links (id) ON DELETE SET NULL;
