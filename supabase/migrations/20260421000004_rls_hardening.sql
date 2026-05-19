BEGIN;

-- -----------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY on all sensitive tables. This prevents table
-- owners (including schema migration roles) from bypassing RLS.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users',
    'missionaries',
    'missionary_social_connections',
    'meta_oauth_states',
    'meta_oauth_pending',
    'social_cross_post_attempts',
    'supporter_profiles',
    'agencies',
    'churches',
    'colleges',
    'pages',
    'page_approvals',
    'page_donations',
    'page_media',
    'page_widgets',
    'donors',
    'donation_receipts',
    'missionary_followers',
    'missionary_missionary_followers',
    'church_followers',
    'affiliated_churches',
    'missionary_churches',
    'conversations',
    'conversation_members',
    'messages',
    'message_reports',
    'notifications',
    'missionary_content_publications',
    'missionary_follower_content_ack',
    'prayers',
    'prayer_reactions',
    'prayer_updates',
    'push_subscriptions',
    'homepage_banners',
    'homepage_featured_sections',
    'homepage_section_profiles',
    'homepage_settings',
    'footer_content',
    'security_events',
    'stripe_webhook_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Restrict is_admin() / is_staff() execution to authenticated + service_role.
-- These functions read auth.uid() and should never be callable by the anon
-- role directly.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_staff'
  ) THEN
    REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Users table: column-level UPDATE lockdown.
-- Regular users must never be able to mutate their own role/status. This is
-- a belt-and-suspenders protection on top of the existing RLS policy.
-- -----------------------------------------------------------------------------
REVOKE UPDATE (role, status) ON public.users FROM authenticated, anon;
GRANT UPDATE (role, status) ON public.users TO service_role;

-- -----------------------------------------------------------------------------
-- security_events: add inet column alongside text ip for future migration.
-- We keep `ip` (text) intact to avoid breaking historical rows with masked
-- values; new writes target `ip_cidr` as a proper inet (e.g. 192.168.1.0/24).
-- -----------------------------------------------------------------------------
ALTER TABLE public.security_events
  ADD COLUMN IF NOT EXISTS ip_cidr inet;

-- Append-only audit log: block mutation grants beyond service_role.
REVOKE INSERT, UPDATE, DELETE ON public.security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security_events TO authenticated;

-- -----------------------------------------------------------------------------
-- stripe_webhook_events: append-only log for dedup. Block SELECT for anon.
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stripe_webhook_events TO service_role;
GRANT INSERT ON public.stripe_webhook_events TO service_role;

DROP POLICY IF EXISTS "stripe_webhook_events_admin_select" ON public.stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_admin_select"
  ON public.stripe_webhook_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;
