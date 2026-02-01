-- Ajout email et téléphone aux bénéficiaires (pour envoi sécurisé des liens de paiement)
-- À exécuter dans l'éditeur SQL Supabase si les colonnes n'existent pas déjà

ALTER TABLE public.beneficiaries ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.beneficiaries ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.beneficiaries.email IS 'Email du bénéficiaire pour recevoir les liens de paiement de façon sécurisée';
COMMENT ON COLUMN public.beneficiaries.phone IS 'Numéro de téléphone du bénéficiaire pour recevoir les liens de paiement de façon sécurisée';
