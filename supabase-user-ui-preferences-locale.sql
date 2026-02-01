-- Ajouter la colonne locale aux préférences utilisateur (pour relevé mensuel et UI)
-- À exécuter dans Supabase SQL Editor

ALTER TABLE public.user_ui_preferences
  ADD COLUMN IF NOT EXISTS locale text DEFAULT 'fr';

COMMENT ON COLUMN public.user_ui_preferences.locale IS 'Langue de l''utilisateur (fr, en, es, ru, zh) pour emails et UI';
