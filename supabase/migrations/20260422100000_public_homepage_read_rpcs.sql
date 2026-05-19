-- Public read path for homepage banners/settings without changing RLS.
-- SECURITY DEFINER runs as owner (bypasses RLS); only exposes active banners + one settings row.

CREATE OR REPLACE FUNCTION public.public_homepage_active_banners()
RETURNS SETOF public.homepage_banners
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.homepage_banners
  WHERE is_active = true
  ORDER BY display_order ASC;
$$;

REVOKE ALL ON FUNCTION public.public_homepage_active_banners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_homepage_active_banners() TO service_role;

CREATE OR REPLACE FUNCTION public.public_homepage_settings_row()
RETURNS SETOF public.homepage_settings
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.homepage_settings
  ORDER BY id ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_homepage_settings_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_homepage_settings_row() TO service_role;
