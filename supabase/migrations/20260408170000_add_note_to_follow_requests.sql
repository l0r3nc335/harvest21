-- Add optional note field to follow request tables
-- Allows users to include a short message when sending a follow request

ALTER TABLE public.missionary_followers
  ADD COLUMN IF NOT EXISTS note text CHECK (char_length(note) <= 100);

ALTER TABLE public.church_followers
  ADD COLUMN IF NOT EXISTS note text CHECK (char_length(note) <= 100);

ALTER TABLE public.missionary_missionary_followers
  ADD COLUMN IF NOT EXISTS note text CHECK (char_length(note) <= 100);
