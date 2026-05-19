-- Add optional donor-entered designation to donation records
ALTER TABLE public.page_donations
  ADD COLUMN IF NOT EXISTS designation text CHECK (char_length(designation) <= 50);
