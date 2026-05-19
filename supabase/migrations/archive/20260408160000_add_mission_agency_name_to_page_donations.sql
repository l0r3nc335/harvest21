-- Add optional mission agency name to donation records
ALTER TABLE public.page_donations
  ADD COLUMN IF NOT EXISTS mission_agency_name text;
