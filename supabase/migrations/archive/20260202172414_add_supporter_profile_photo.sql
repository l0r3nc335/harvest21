-- Add profile_photo_url column to supporter_profiles table
-- Guard: skip if table doesn't exist yet (applied before create_supporter_profiles).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supporter_profiles') THEN
    RETURN;
  END IF;

  ALTER TABLE public.supporter_profiles ADD COLUMN IF NOT EXISTS profile_photo_url text;
  COMMENT ON COLUMN public.supporter_profiles.profile_photo_url IS 'URL to supporter profile photo in storage';
END $$;

