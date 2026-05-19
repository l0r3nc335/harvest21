BEGIN;

-- =============================================================================
-- Phase 4 of "remove getSupabaseAdmin()" plan. Adds SECURITY DEFINER RPCs for
-- syncing church-contact follow state on missionary affiliation changes.
-- Cross-user write: the missionary owner (or staff) creates/updates an
-- accepted follow row on behalf of the church's contact user.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_church_follow_missionary(
  p_missionary_id bigint,
  p_church_id bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_missionary_owner uuid;
  v_church_contact uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'sync_church_follow_missionary: unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_missionary_id IS NULL OR p_church_id IS NULL THEN
    RAISE EXCEPTION 'sync_church_follow_missionary: missionary_id and church_id required';
  END IF;

  SELECT user_id INTO v_missionary_owner FROM public.missionaries WHERE id = p_missionary_id;
  SELECT contact_user_id INTO v_church_contact FROM public.churches WHERE id = p_church_id;

  IF v_church_contact IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.is_staff()
    OR v_caller = v_missionary_owner
    OR v_caller = v_church_contact
  ) THEN
    RAISE EXCEPTION 'sync_church_follow_missionary: forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.missionary_followers (missionary_id, user_id, status, unfollowed_at)
  VALUES (p_missionary_id, v_church_contact, 'accepted', NULL)
  ON CONFLICT (missionary_id, user_id)
  DO UPDATE SET status = 'accepted', unfollowed_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_church_follow_missionary(bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_church_follow_missionary(bigint, bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_church_unfollow_missionary(
  p_missionary_id bigint,
  p_church_id bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_missionary_owner uuid;
  v_church_contact uuid;
  v_existing_id bigint;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'sync_church_unfollow_missionary: unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_missionary_id IS NULL OR p_church_id IS NULL THEN
    RAISE EXCEPTION 'sync_church_unfollow_missionary: missionary_id and church_id required';
  END IF;

  SELECT user_id INTO v_missionary_owner FROM public.missionaries WHERE id = p_missionary_id;
  SELECT contact_user_id INTO v_church_contact FROM public.churches WHERE id = p_church_id;

  IF v_church_contact IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.is_staff()
    OR v_caller = v_missionary_owner
    OR v_caller = v_church_contact
  ) THEN
    RAISE EXCEPTION 'sync_church_unfollow_missionary: forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.missionary_followers
  WHERE missionary_id = p_missionary_id
    AND user_id = v_church_contact;

  IF v_existing_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.missionary_followers
  SET status = 'unfollowed', unfollowed_at = now()
  WHERE id = v_existing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_church_unfollow_missionary(bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_church_unfollow_missionary(bigint, bigint) TO authenticated, service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK (manual)
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.sync_church_follow_missionary(bigint, bigint);
-- DROP FUNCTION IF EXISTS public.sync_church_unfollow_missionary(bigint, bigint);
-- COMMIT;
-- =============================================================================
