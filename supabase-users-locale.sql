-- Ajouter la colonne locale à la table users
-- À exécuter dans Supabase SQL Editor
-- Permet de stocker la langue préférée de l'utilisateur (emails, relevés, etc.)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';

COMMENT ON COLUMN public.users.locale IS 'Langue préférée de l''utilisateur (fr, en, es, ru, zh) pour emails et interface';
