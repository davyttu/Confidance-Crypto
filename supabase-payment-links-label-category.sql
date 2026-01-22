-- Add label & category for payment links
-- Run in Supabase SQL editor

ALTER TABLE public.payment_links
ADD COLUMN IF NOT EXISTS payment_label text;

ALTER TABLE public.payment_links
ADD COLUMN IF NOT EXISTS payment_categorie text;
