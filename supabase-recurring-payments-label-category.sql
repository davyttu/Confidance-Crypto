-- Add label & category for recurring payments
-- Run in Supabase SQL editor

ALTER TABLE public.recurring_payments
ADD COLUMN IF NOT EXISTS payment_label text;

ALTER TABLE public.recurring_payments
ADD COLUMN IF NOT EXISTS payment_category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_category_check'
      AND conrelid = 'public.recurring_payments'::regclass
  ) THEN
    ALTER TABLE public.recurring_payments
    ADD CONSTRAINT payment_category_check check (
      (
        (payment_category is null)
        or (
          payment_category = any (
            array[
              'housing'::text,
              'salary'::text,
              'subscription'::text,
              'utilities'::text,
              'services'::text,
              'transfer'::text,
              'other'::text
            ]
          )
        )
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recurring_payment_category
ON public.recurring_payments (payment_category);

CREATE INDEX IF NOT EXISTS idx_recurring_payment_label_text_search
ON public.recurring_payments
USING gin (to_tsvector('simple'::regconfig, payment_label));
