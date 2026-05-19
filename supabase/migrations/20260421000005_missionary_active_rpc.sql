-- Public RPC that returns the subset of missionary IDs whose linked user is Active.
-- SECURITY DEFINER allows anon/authenticated to call this without direct SELECT on public.users.

CREATE OR REPLACE FUNCTION public.missionary_ids_with_active_users(ids bigint[])
RETURNS SETOF bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT m.id
  FROM public.missionaries m
  JOIN public.users u ON u.user_id = m.user_id
  WHERE m.id = ANY(ids)
    AND u.status = 'Active';
$$;

REVOKE ALL ON FUNCTION public.missionary_ids_with_active_users(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.missionary_ids_with_active_users(bigint[]) TO anon, authenticated;
