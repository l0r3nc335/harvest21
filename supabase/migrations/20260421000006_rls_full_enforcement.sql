BEGIN;

-- =============================================================================
-- Phase 1 of "remove getSupabaseAdmin()" plan. Introduces SECURITY DEFINER
-- RPCs for cross-user writes, closes remaining RLS gaps, and tightens the
-- over-permissive "System" policies that previously relied on the admin
-- client bypassing RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. log_security_event RPC
-- Allows anon + authenticated callers to record a security event row without
-- needing INSERT privileges on public.security_events (which is service-role-
-- only today). The function runs SECURITY DEFINER so the insert succeeds
-- regardless of caller role, but the argument list is strictly bounded.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_path text DEFAULT NULL,
  p_method text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_ip_cidr inet DEFAULT NULL,
  p_detail jsonb DEFAULT NULL,
  p_incident_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_event_type IS NULL OR length(p_event_type) = 0 THEN
    RAISE EXCEPTION 'log_security_event: p_event_type required';
  END IF;

  INSERT INTO public.security_events (
    incident_id,
    event_type,
    path,
    method,
    user_id,
    ip,
    ip_cidr,
    detail
  ) VALUES (
    p_incident_id,
    p_event_type,
    p_path,
    p_method,
    p_user_id,
    p_ip,
    p_ip_cidr,
    p_detail
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text, text, text, uuid, text, inet, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, uuid, text, inet, jsonb, uuid) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. create_notification RPC
-- Replaces ad-hoc notification inserts that used the service-role client.
-- Authorization model:
--   * is_staff() can notify anyone
--   * caller can notify themselves
--   * caller and target share a relationship that makes notification plausible
--     (follower/followee on either side, shared conversation, donor -> page
--     owner, page owner -> donor, admin impersonation).
-- Anon callers are rejected outright.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Replace the blanket policy with a tight staff-or-self-insert policy. Most
-- inserts go through the RPC below (which uses SECURITY DEFINER and so is
-- unaffected by RLS), but we keep a narrow policy for self-authored rows
-- (e.g. "you marked X" kind of pings you create for yourself).
DROP POLICY IF EXISTS "notifications_insert_self_or_staff" ON public.notifications;
CREATE POLICY "notifications_insert_self_or_staff"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    OR user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.create_notification(
  p_target_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id bigint DEFAULT NULL,
  p_content_metadata jsonb DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_allowed boolean := false;
  v_new_id bigint;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'create_notification: unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'create_notification: p_target_user_id required';
  END IF;
  IF p_type IS NULL OR p_title IS NULL OR p_message IS NULL THEN
    RAISE EXCEPTION 'create_notification: type/title/message required';
  END IF;

  IF public.is_staff() THEN
    v_allowed := true;
  ELSIF v_caller = p_target_user_id THEN
    v_allowed := true;
  ELSE
    -- Missionary <-> supporter follow
    IF EXISTS (
      SELECT 1
      FROM public.missionaries m
      JOIN public.missionary_followers f ON f.missionary_id = m.id
      WHERE (m.user_id = v_caller AND f.user_id = p_target_user_id)
         OR (f.user_id = v_caller AND m.user_id = p_target_user_id)
    ) THEN
      v_allowed := true;
    END IF;

    -- Missionary <-> missionary follow
    IF NOT v_allowed AND EXISTS (
      SELECT 1
      FROM public.missionary_missionary_followers mmf
      JOIN public.missionaries mf ON mf.id = mmf.follower_missionary_id
      JOIN public.missionaries md ON md.id = mmf.followed_missionary_id
      WHERE (mf.user_id = v_caller AND md.user_id = p_target_user_id)
         OR (md.user_id = v_caller AND mf.user_id = p_target_user_id)
    ) THEN
      v_allowed := true;
    END IF;

    -- Church contact <-> follower
    IF NOT v_allowed AND EXISTS (
      SELECT 1
      FROM public.church_followers cf
      JOIN public.churches c ON c.id = cf.church_id
      WHERE (c.contact_user_id = v_caller AND cf.user_id = p_target_user_id)
         OR (cf.user_id = v_caller AND c.contact_user_id = p_target_user_id)
    ) THEN
      v_allowed := true;
    END IF;

    -- Conversation counterpart
    IF NOT v_allowed AND EXISTS (
      SELECT 1
      FROM public.conversations conv
      LEFT JOIN public.missionaries m ON m.id = conv.missionary_id
      WHERE (conv.supporter_id = v_caller AND m.user_id = p_target_user_id)
         OR (conv.supporter_id = p_target_user_id AND m.user_id = v_caller)
    ) THEN
      v_allowed := true;
    END IF;

    -- Donor -> page owner (for donation notifications, when related_entity
    -- points at a page). Caller must be a donor.
    IF NOT v_allowed AND p_related_entity_type = 'page' AND p_related_entity_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.donors d
        JOIN public.pages p ON p.id = p_related_entity_id
        LEFT JOIN public.missionaries m ON p.organization_type = 'missionary' AND m.id = p.organization_id
        LEFT JOIN public.churches c ON p.organization_type = 'church' AND c.id = p.organization_id
        LEFT JOIN public.agencies a ON p.organization_type = 'agency' AND a.id = p.organization_id
        LEFT JOIN public.colleges col ON p.organization_type = 'college' AND col.id = p.organization_id
        WHERE d.user_id = v_caller
          AND (
            m.user_id = p_target_user_id
            OR c.contact_user_id = p_target_user_id
            OR a.contact_user_id = p_target_user_id
            OR col.contact_user_id = p_target_user_id
          )
      ) THEN
        v_allowed := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'create_notification: caller % not allowed to notify %', v_caller, p_target_user_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    related_entity_type,
    related_entity_id,
    content_metadata,
    is_read
  ) VALUES (
    p_target_user_id,
    p_type,
    p_title,
    p_message,
    p_related_entity_type,
    p_related_entity_id,
    p_content_metadata,
    false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, bigint, jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. broadcast_missionary_followers_notification RPC
-- Batch helper for the common "missionary publishes new content" flow.
-- Caller must own the missionary (or be staff); inserts one notification row
-- per accepted follower and one row per missionary that follows this one.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_missionary_followers_notification(
  p_missionary_id bigint,
  p_type text,
  p_title text,
  p_message text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id bigint DEFAULT NULL,
  p_content_metadata jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_inserted integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'broadcast_missionary_followers_notification: unauthenticated'
      USING ERRCODE = '42501';
  END IF;
  IF p_missionary_id IS NULL THEN
    RAISE EXCEPTION 'broadcast_missionary_followers_notification: p_missionary_id required';
  END IF;

  SELECT user_id INTO v_owner FROM public.missionaries WHERE id = p_missionary_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'broadcast_missionary_followers_notification: missionary not found';
  END IF;

  IF NOT (public.is_staff() OR v_owner = v_caller) THEN
    RAISE EXCEPTION 'broadcast_missionary_followers_notification: forbidden'
      USING ERRCODE = '42501';
  END IF;

  WITH targets AS (
    SELECT DISTINCT target_user_id FROM (
      SELECT f.user_id AS target_user_id
      FROM public.missionary_followers f
      WHERE f.missionary_id = p_missionary_id
        AND f.status = 'accepted'
      UNION
      SELECT m.user_id
      FROM public.missionary_missionary_followers mmf
      JOIN public.missionaries m ON m.id = mmf.follower_missionary_id
      WHERE mmf.followed_missionary_id = p_missionary_id
        AND mmf.status = 'accepted'
    ) t
    WHERE target_user_id IS NOT NULL
      AND target_user_id <> v_caller
  ),
  inserted AS (
    INSERT INTO public.notifications (
      user_id, type, title, message,
      related_entity_type, related_entity_id, content_metadata, is_read
    )
    SELECT
      target_user_id, p_type, p_title, p_message,
      p_related_entity_type, p_related_entity_id, p_content_metadata, false
    FROM targets
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_missionary_followers_notification(bigint, text, text, text, text, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_missionary_followers_notification(bigint, text, text, text, text, bigint, jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. broadcast_staff_notification RPC
-- For flows like "message report filed" that need to notify every staff user.
-- Anyone authenticated can trigger this, but only staff get a notification.
-- Event type is intentionally a caller-supplied text; staff UI filters on it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_staff_notification(
  p_type text,
  p_title text,
  p_message text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id bigint DEFAULT NULL,
  p_content_metadata jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_inserted integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'broadcast_staff_notification: unauthenticated' USING ERRCODE = '42501';
  END IF;

  WITH inserted AS (
    INSERT INTO public.notifications (
      user_id, type, title, message,
      related_entity_type, related_entity_id, content_metadata, is_read
    )
    SELECT
      u.user_id, p_type, p_title, p_message,
      p_related_entity_type, p_related_entity_id, p_content_metadata, false
    FROM public.users u
    WHERE u.role IN (1, 2)
      AND u.user_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_staff_notification(text, text, text, text, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_staff_notification(text, text, text, text, bigint, jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. meta_oauth_states / meta_oauth_pending: full owner CRUD
-- Baseline only had SELECT; the flow needs INSERT/UPDATE/DELETE from the
-- authenticated user tied to the row.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meta_oauth_states', 'meta_oauth_pending'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_self" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_self" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_self" ON public.%I', t, t);
  END LOOP;
END $$;

CREATE POLICY "meta_oauth_states_insert_self"
  ON public.meta_oauth_states FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meta_oauth_states_update_self"
  ON public.meta_oauth_states FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meta_oauth_states_delete_self"
  ON public.meta_oauth_states FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "meta_oauth_pending_insert_self"
  ON public.meta_oauth_pending FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meta_oauth_pending_update_self"
  ON public.meta_oauth_pending FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meta_oauth_pending_delete_self"
  ON public.meta_oauth_pending FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. missionary_social_connections: owner + staff CRUD
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "missionary_social_connections_select_owner" ON public.missionary_social_connections;
DROP POLICY IF EXISTS "missionary_social_connections_insert_owner" ON public.missionary_social_connections;
DROP POLICY IF EXISTS "missionary_social_connections_update_owner" ON public.missionary_social_connections;
DROP POLICY IF EXISTS "missionary_social_connections_delete_owner" ON public.missionary_social_connections;

CREATE POLICY "missionary_social_connections_select_owner"
  ON public.missionary_social_connections FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = missionary_social_connections.missionary_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "missionary_social_connections_insert_owner"
  ON public.missionary_social_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = missionary_social_connections.missionary_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "missionary_social_connections_update_owner"
  ON public.missionary_social_connections FOR UPDATE
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = missionary_social_connections.missionary_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = missionary_social_connections.missionary_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "missionary_social_connections_delete_owner"
  ON public.missionary_social_connections FOR DELETE
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = missionary_social_connections.missionary_id
        AND m.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. social_cross_post_attempts: owner INSERT/UPDATE (SELECT already in baseline)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "social_cross_post_attempts_insert_owner" ON public.social_cross_post_attempts;
DROP POLICY IF EXISTS "social_cross_post_attempts_update_owner" ON public.social_cross_post_attempts;

CREATE POLICY "social_cross_post_attempts_insert_owner"
  ON public.social_cross_post_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = social_cross_post_attempts.missionary_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "social_cross_post_attempts_update_owner"
  ON public.social_cross_post_attempts FOR UPDATE
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = social_cross_post_attempts.missionary_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = social_cross_post_attempts.missionary_id
        AND m.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 8. missionary_content_publications: owner INSERT (SELECT for followers stays
-- on existing anon read where present). This table is written by the content
-- publication helpers.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "missionary_content_publications_select_public" ON public.missionary_content_publications;
DROP POLICY IF EXISTS "missionary_content_publications_insert_owner" ON public.missionary_content_publications;

CREATE POLICY "missionary_content_publications_select_public"
  ON public.missionary_content_publications FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "missionary_content_publications_insert_owner"
  ON public.missionary_content_publications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = missionary_content_publications.missionary_id
        AND m.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 9. conversation_members: tighten the "System can create memberships" policy.
-- The authenticated user is allowed to create a membership row ONLY for
-- themselves, and only in a conversation they are a party to via
-- supporter_id or missionary ownership.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can create memberships" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert_self" ON public.conversation_members;

CREATE POLICY "conversation_members_insert_self"
  ON public.conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_members.conversation_id
        AND (
          c.supporter_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.missionaries m
            WHERE m.id = c.missionary_id
              AND m.user_id = auth.uid()
          )
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 10. push_subscriptions: remove the permissive "Service role can manage"
-- policy. Existing self-owned policies already cover all legitimate user
-- operations (insert/select/update/delete own rows).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage push subscriptions" ON public.push_subscriptions;

-- -----------------------------------------------------------------------------
-- 11. page_media / page_widgets anonymous read support for published pages.
-- The baseline "Public can view media of published pages" policy already
-- allows this; verify it coexists with the staff/owner policies by making
-- it explicit here.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view media of published pages" ON public.page_media;
CREATE POLICY "Public can view media of published pages"
  ON public.page_media FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_media.page_id
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS "Public can view widgets of published pages" ON public.page_widgets;
CREATE POLICY "Public can view widgets of published pages"
  ON public.page_widgets FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_widgets.page_id
        AND p.is_published = true
    )
  );

-- -----------------------------------------------------------------------------
-- 12. Missionary followers / church followers / missionary-missionary followers
-- already have owner-side UPDATE policies. Explicitly ensure the reviewer
-- column is permitted.
-- -----------------------------------------------------------------------------
-- (No-op: baseline policies are sufficient. Documented here so reviewers can
-- trace why we did not touch them.)

-- -----------------------------------------------------------------------------
-- 12b. Extend missionaries_public view to include is_managed_by_harvest21.
-- The public homepage / featured sections / navbar cards need this flag to
-- render the "managed by Harvest21" badge on anon pages, and moving reads
-- off the admin client requires that column to be exposed in the view.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.missionaries_public AS
SELECT
  id,
  first_name,
  last_name,
  country_of_residence,
  destination_country,
  mission_status,
  open_to_visits,
  biography,
  agency_id,
  college_id,
  sending_church_id,
  mission_field_church_id,
  is_managed_by_harvest21
FROM public.missionaries;

GRANT SELECT ON public.missionaries_public TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 13. FORCE RLS sweep on tables added since the last hardening pass.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'missionary_content_publications',
    'missionary_follower_content_ack',
    'conversation_members',
    'conversations',
    'messages',
    'prayers',
    'prayer_reactions',
    'prayer_updates',
    'push_subscriptions',
    'user_roles'
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

COMMIT;

-- =============================================================================
-- ROLLBACK (manual)
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.log_security_event(text, text, text, uuid, text, inet, jsonb, uuid);
-- DROP FUNCTION IF EXISTS public.create_notification(uuid, text, text, text, text, bigint, jsonb);
-- DROP FUNCTION IF EXISTS public.broadcast_missionary_followers_notification(bigint, text, text, text, text, bigint, jsonb);
-- DROP FUNCTION IF EXISTS public.broadcast_staff_notification(text, text, text, text, bigint, jsonb);
-- DROP POLICY IF EXISTS "notifications_insert_self_or_staff" ON public.notifications;
-- CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
-- (and reverse the remaining policy changes as needed)
-- COMMIT;
-- =============================================================================
