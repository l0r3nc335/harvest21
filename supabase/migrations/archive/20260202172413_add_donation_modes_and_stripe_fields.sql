-- Additive migration: donation modes (Epic 1) + Stripe/webhook fields (Epics 2–8).
-- No destructive changes. Safe to run on existing DB.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'pages'
                 AND column_name = 'donation_mode') THEN
    ALTER TABLE public.pages
      ADD COLUMN donation_mode text
      CHECK (donation_mode IS NULL OR donation_mode = ANY (ARRAY['harvest21'::text, 'external'::text, 'off'::text]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'pages'
                 AND column_name = 'external_donation_url') THEN
    ALTER TABLE public.pages
      ADD COLUMN external_donation_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'page_donations'
                 AND column_name = 'type') THEN
    ALTER TABLE public.page_donations
      ADD COLUMN type text DEFAULT 'one_time'
      CHECK (type IS NULL OR type = ANY (ARRAY['one_time'::text, 'recurring'::text]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'page_donations'
                 AND column_name = 'stripe_payment_intent_id') THEN
    ALTER TABLE public.page_donations
      ADD COLUMN stripe_payment_intent_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'page_donations'
                 AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE public.page_donations
      ADD COLUMN stripe_subscription_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'page_donations'
                 AND column_name = 'stripe_invoice_id') THEN
    ALTER TABLE public.page_donations
      ADD COLUMN stripe_invoice_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'donors'
                 AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE public.donors
      ADD COLUMN stripe_customer_id text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.donation_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  page_donation_id bigint NOT NULL,
  donor_id bigint,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  receipt_number text NOT NULL UNIQUE,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT donation_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT donation_receipts_page_donation_id_fkey FOREIGN KEY (page_donation_id) REFERENCES public.page_donations(id),
  CONSTRAINT donation_receipts_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.donors(id)
);

CREATE INDEX IF NOT EXISTS idx_donation_receipts_page_donation_id ON public.donation_receipts(page_donation_id);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_donor_id ON public.donation_receipts(donor_id);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_receipt_number ON public.donation_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_page_donations_stripe_payment_intent ON public.page_donations(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_donations_stripe_invoice ON public.page_donations(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pages_donation_mode ON public.pages(donation_mode) WHERE donation_mode IS NOT NULL;

ALTER TABLE public.donation_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can read own receipts"
  ON public.donation_receipts FOR SELECT TO authenticated
  USING (
    donor_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.donors d WHERE d.id = donation_receipts.donor_id AND d.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.donation_receipts TO authenticated;
GRANT USAGE ON SEQUENCE donation_receipts_id_seq TO authenticated;
