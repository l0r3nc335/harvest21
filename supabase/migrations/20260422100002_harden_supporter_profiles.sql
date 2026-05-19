BEGIN;

DROP POLICY IF EXISTS "Supporters can view own profile" ON public.supporter_profiles;
DROP POLICY IF EXISTS "Supporters can insert own profile" ON public.supporter_profiles;
DROP POLICY IF EXISTS "Supporters can update own profile" ON public.supporter_profiles;
DROP POLICY IF EXISTS "Supporters can delete own profile" ON public.supporter_profiles;
DROP POLICY IF EXISTS "Admins can view all supporter profiles" ON public.supporter_profiles;
DROP POLICY IF EXISTS "Admins can update all supporter profiles" ON public.supporter_profiles;
DROP POLICY IF EXISTS "Admins can delete all supporter profiles" ON public.supporter_profiles;

DROP POLICY IF EXISTS "supporter_profiles_select_self_or_staff" ON public.supporter_profiles;
DROP POLICY IF EXISTS "supporter_profiles_insert_self_or_staff" ON public.supporter_profiles;
DROP POLICY IF EXISTS "supporter_profiles_update_self_or_staff" ON public.supporter_profiles;
DROP POLICY IF EXISTS "supporter_profiles_delete_admin" ON public.supporter_profiles;

CREATE POLICY "supporter_profiles_select_self_or_staff"
  ON public.supporter_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "supporter_profiles_insert_self_or_staff"
  ON public.supporter_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "supporter_profiles_update_self_or_staff"
  ON public.supporter_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "supporter_profiles_delete_admin"
  ON public.supporter_profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.supporter_profiles FROM anon;

ALTER TABLE public.supporter_profiles FORCE ROW LEVEL SECURITY;

COMMIT;

-- =============================================================================
-- ROLLBACK (manual)
-- BEGIN;
-- ALTER TABLE public.supporter_profiles NO FORCE ROW LEVEL SECURITY;
-- GRANT ALL ON TABLE public.supporter_profiles TO anon;
-- DROP POLICY IF EXISTS "supporter_profiles_select_self_or_staff" ON public.supporter_profiles;
-- DROP POLICY IF EXISTS "supporter_profiles_insert_self_or_staff" ON public.supporter_profiles;
-- DROP POLICY IF EXISTS "supporter_profiles_update_self_or_staff" ON public.supporter_profiles;
-- DROP POLICY IF EXISTS "supporter_profiles_delete_admin" ON public.supporter_profiles;
-- CREATE POLICY "Supporters can view own profile" ON public.supporter_profiles FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Supporters can insert own profile" ON public.supporter_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Supporters can update own profile" ON public.supporter_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Supporters can delete own profile" ON public.supporter_profiles FOR DELETE USING (auth.uid() = user_id);
-- COMMIT;
-- =============================================================================
