-- Add receipt tracking fields
ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending' CHECK (delivery_status = ANY (ARRAY['pending', 'sent', 'delivered', 'failed']));

-- Add Stripe Connect fields to missionaries
ALTER TABLE public.missionaries
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'not_started' CHECK (payout_status = ANY (ARRAY['not_started', 'pending', 'enabled', 'restricted', 'incomplete'])),
  ADD COLUMN IF NOT EXISTS payout_setup_completed_at timestamp with time zone;

-- Add user_id to page_donations for direct user lookup
ALTER TABLE public.page_donations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_page_donations_user_id ON public.page_donations(user_id);

-- Add Refunded/Disputed to page_donations status constraint
ALTER TABLE public.page_donations DROP CONSTRAINT IF EXISTS page_donations_status_check;
ALTER TABLE public.page_donations ADD CONSTRAINT page_donations_status_check
  CHECK (status = ANY (ARRAY['Pending', 'Complete', 'Failed', 'Refunded', 'Disputed']));
