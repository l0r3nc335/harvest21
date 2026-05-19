-- Store donor name and email directly on the donation record
-- so billing info is always captured regardless of login status
ALTER TABLE public.page_donations
  ADD COLUMN IF NOT EXISTS donor_first_name text,
  ADD COLUMN IF NOT EXISTS donor_last_name  text,
  ADD COLUMN IF NOT EXISTS donor_email      text;
