-- Add first month custom fields for recurring payments
-- Run in Supabase SQL editor

ALTER TABLE public.recurring_payments
ADD COLUMN IF NOT EXISTS first_month_amount text null;

ALTER TABLE public.recurring_payments
ADD COLUMN IF NOT EXISTS is_first_month_custom boolean not null default false;

-- Optional backfill if you want to mark existing rows manually later
