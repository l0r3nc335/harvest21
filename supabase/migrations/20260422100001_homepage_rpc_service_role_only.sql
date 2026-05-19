-- Tighten homepage read RPCs: not callable with anon/authenticated JWT (browser).
-- Server uses SUPABASE_SERVICE_ROLE_KEY only.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'public_homepage_active_banners'
  ) THEN
    REVOKE ALL ON FUNCTION public.public_homepage_active_banners() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.public_homepage_active_banners() FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.public_homepage_active_banners() TO service_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'public_homepage_settings_row'
  ) THEN
    REVOKE ALL ON FUNCTION public.public_homepage_settings_row() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.public_homepage_settings_row() FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.public_homepage_settings_row() TO service_role;
  END IF;
END $$;
