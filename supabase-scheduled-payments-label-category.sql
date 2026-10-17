-- Libellé + catégorie pour les paiements simples/programmés (scheduled_payments)
-- À exécuter dans l’éditeur SQL Supabase si les colonnes n’existent pas encore.

ALTER TABLE public.scheduled_payments
  ADD COLUMN IF NOT EXISTS payment_label text;

ALTER TABLE public.scheduled_payments
  ADD COLUMN IF NOT EXISTS payment_category text;
