BEGIN;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = auth.uid()
      AND role IN (1, 2)
  );
$$;

DO $$
DECLARE
  v_sig text;
  v_sigs text[] := ARRAY[
    'public.is_admin()',
    'public.is_church_follower(bigint, uuid)',
    'public.get_church_follower_status(bigint, uuid)',
    'public.get_church_follower_count(bigint)',
    'public.set_updated_at()',
    'public.bump_update_count()',
    'public.bump_amen_count()'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname || '.' || p.proname || '(' ||
            pg_get_function_identity_arguments(p.oid) || ')' = v_sig
    ) THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_sig);
    END IF;
  END LOOP;
END $$;

-- USERS -----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and Staff can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins and Staff can update all users" ON public.users;
DROP POLICY IF EXISTS "Create Admin" ON public.users;

CREATE POLICY "users_select_self"
  ON public.users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_select_staff"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "users_update_self"
  ON public.users FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role IS NOT DISTINCT FROM (SELECT u.role FROM public.users u WHERE u.user_id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT u.status FROM public.users u WHERE u.user_id = auth.uid())
  );

CREATE POLICY "users_update_staff"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "users_insert_staff"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- DONORS ----------------------------------------------------------------
DROP POLICY IF EXISTS "donors_select_public" ON public.donors;
DROP POLICY IF EXISTS "donors_insert_admin" ON public.donors;
DROP POLICY IF EXISTS "donors_update_admin_or_owner" ON public.donors;
DROP POLICY IF EXISTS "donors_delete_admin" ON public.donors;

CREATE POLICY "donors_select_self_or_staff"
  ON public.donors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "donors_insert_self_or_staff"
  ON public.donors FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "donors_update_self_or_staff"
  ON public.donors FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "donors_delete_admin"
  ON public.donors FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- MISSIONARIES ----------------------------------------------------------
DROP POLICY IF EXISTS "missionaries_select_public" ON public.missionaries;
DROP POLICY IF EXISTS "missionaries_insert_admin" ON public.missionaries;
DROP POLICY IF EXISTS "missionaries_update_admin_or_owner" ON public.missionaries;
DROP POLICY IF EXISTS "missionaries_delete_admin" ON public.missionaries;

CREATE POLICY "missionaries_select_self_or_staff"
  ON public.missionaries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "missionaries_insert_self_or_staff"
  ON public.missionaries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "missionaries_update_self_or_staff"
  ON public.missionaries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "missionaries_delete_admin"
  ON public.missionaries FOR DELETE
  TO authenticated
  USING (public.is_admin());

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
  mission_field_church_id
FROM public.missionaries;

GRANT SELECT ON public.missionaries_public TO anon, authenticated;

-- CHURCHES --------------------------------------------------------------
DROP POLICY IF EXISTS "churches_select_public" ON public.churches;
DROP POLICY IF EXISTS "churches_insert_admin" ON public.churches;
DROP POLICY IF EXISTS "churches_update_admin_or_owner" ON public.churches;
DROP POLICY IF EXISTS "churches_delete_admin" ON public.churches;

CREATE POLICY "churches_select_contact_or_staff"
  ON public.churches FOR SELECT
  TO authenticated
  USING (contact_user_id = auth.uid() OR public.is_staff());

CREATE POLICY "churches_insert_staff"
  ON public.churches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "churches_update_contact_or_staff"
  ON public.churches FOR UPDATE
  TO authenticated
  USING (contact_user_id = auth.uid() OR public.is_staff())
  WITH CHECK (contact_user_id = auth.uid() OR public.is_staff());

CREATE POLICY "churches_delete_admin"
  ON public.churches FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE VIEW public.churches_public AS
SELECT id, name, city, country, website
FROM public.churches;

GRANT SELECT ON public.churches_public TO anon, authenticated;

-- AGENCIES --------------------------------------------------------------
DROP POLICY IF EXISTS "agencies_select_public" ON public.agencies;
DROP POLICY IF EXISTS "agencies_insert_admin" ON public.agencies;
DROP POLICY IF EXISTS "agencies_update_admin_or_owner" ON public.agencies;
DROP POLICY IF EXISTS "agencies_delete_admin" ON public.agencies;

CREATE POLICY "agencies_select_contact_or_staff"
  ON public.agencies FOR SELECT
  TO authenticated
  USING (contact_user_id = auth.uid() OR public.is_staff());

CREATE POLICY "agencies_insert_staff"
  ON public.agencies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "agencies_update_contact_or_staff"
  ON public.agencies FOR UPDATE
  TO authenticated
  USING (contact_user_id = auth.uid() OR public.is_staff())
  WITH CHECK (contact_user_id = auth.uid() OR public.is_staff());

CREATE POLICY "agencies_delete_admin"
  ON public.agencies FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE VIEW public.agencies_public AS
SELECT id, name, city, country, website
FROM public.agencies;

GRANT SELECT ON public.agencies_public TO anon, authenticated;

-- COLLEGES --------------------------------------------------------------
DROP POLICY IF EXISTS "All" ON public.colleges;
DROP POLICY IF EXISTS "colleges_select_public" ON public.colleges;
DROP POLICY IF EXISTS "colleges_insert_admin" ON public.colleges;
DROP POLICY IF EXISTS "colleges_update_admin_or_owner" ON public.colleges;
DROP POLICY IF EXISTS "colleges_delete_admin" ON public.colleges;

CREATE POLICY "colleges_select_contact_or_staff"
  ON public.colleges FOR SELECT
  TO authenticated
  USING (contact_user_id = auth.uid() OR public.is_staff());

CREATE POLICY "colleges_insert_staff"
  ON public.colleges FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "colleges_update_contact_or_staff"
  ON public.colleges FOR UPDATE
  TO authenticated
  USING (contact_user_id = auth.uid() OR public.is_staff())
  WITH CHECK (contact_user_id = auth.uid() OR public.is_staff());

CREATE POLICY "colleges_delete_admin"
  ON public.colleges FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE VIEW public.colleges_public AS
SELECT id, name, city, country, website
FROM public.colleges;

GRANT SELECT ON public.colleges_public TO anon, authenticated;

-- PAGES (staff oversight) ----------------------------------------------
DROP POLICY IF EXISTS "pages_select_staff" ON public.pages;
DROP POLICY IF EXISTS "pages_manage_staff" ON public.pages;

CREATE POLICY "pages_select_staff"
  ON public.pages FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "pages_manage_staff"
  ON public.pages FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- PAGE_APPROVALS -------------------------------------------------------
DROP POLICY IF EXISTS "page_approvals_select_requester_or_staff" ON public.page_approvals;
DROP POLICY IF EXISTS "page_approvals_insert_owner" ON public.page_approvals;
DROP POLICY IF EXISTS "page_approvals_update_staff" ON public.page_approvals;
DROP POLICY IF EXISTS "page_approvals_delete_admin" ON public.page_approvals;

CREATE POLICY "page_approvals_select_requester_or_staff"
  ON public.page_approvals FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR approved_by = auth.uid()
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_approvals.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
          OR (p.organization_type = 'college' AND EXISTS (SELECT 1 FROM public.colleges co WHERE co.id = p.organization_id AND co.contact_user_id = auth.uid()))
          OR (p.organization_type = 'donor' AND EXISTS (SELECT 1 FROM public.donors d WHERE d.id = p.organization_id AND d.user_id = auth.uid()))
        )
    )
  );

CREATE POLICY "page_approvals_insert_owner"
  ON public.page_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_approvals.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
          OR (p.organization_type = 'college' AND EXISTS (SELECT 1 FROM public.colleges co WHERE co.id = p.organization_id AND co.contact_user_id = auth.uid()))
          OR (p.organization_type = 'donor' AND EXISTS (SELECT 1 FROM public.donors d WHERE d.id = p.organization_id AND d.user_id = auth.uid()))
        )
    )
  );

CREATE POLICY "page_approvals_update_staff"
  ON public.page_approvals FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "page_approvals_delete_admin"
  ON public.page_approvals FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- PAGE_DONATIONS -------------------------------------------------------
DROP POLICY IF EXISTS "page_donations_select_donor_or_owner_or_staff" ON public.page_donations;
DROP POLICY IF EXISTS "page_donations_update_staff" ON public.page_donations;
DROP POLICY IF EXISTS "page_donations_delete_admin" ON public.page_donations;

CREATE POLICY "page_donations_select_donor_or_owner_or_staff"
  ON public.page_donations FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.donors d
      WHERE d.id = page_donations.donor_id
        AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_donations.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
        )
    )
  );

CREATE POLICY "page_donations_update_staff"
  ON public.page_donations FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "page_donations_delete_admin"
  ON public.page_donations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- PAGE_MEDIA -----------------------------------------------------------
DROP POLICY IF EXISTS "page_media_manage_owner" ON public.page_media;

CREATE POLICY "page_media_manage_owner"
  ON public.page_media FOR ALL
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_media.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
          OR (p.organization_type = 'college' AND EXISTS (SELECT 1 FROM public.colleges co WHERE co.id = p.organization_id AND co.contact_user_id = auth.uid()))
          OR (p.organization_type = 'donor' AND EXISTS (SELECT 1 FROM public.donors d WHERE d.id = p.organization_id AND d.user_id = auth.uid()))
        )
    )
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_media.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
          OR (p.organization_type = 'college' AND EXISTS (SELECT 1 FROM public.colleges co WHERE co.id = p.organization_id AND co.contact_user_id = auth.uid()))
          OR (p.organization_type = 'donor' AND EXISTS (SELECT 1 FROM public.donors d WHERE d.id = p.organization_id AND d.user_id = auth.uid()))
        )
    )
  );

-- PAGE_WIDGETS ---------------------------------------------------------
DROP POLICY IF EXISTS "page_widgets_manage_owner" ON public.page_widgets;

CREATE POLICY "page_widgets_manage_owner"
  ON public.page_widgets FOR ALL
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_widgets.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
          OR (p.organization_type = 'college' AND EXISTS (SELECT 1 FROM public.colleges co WHERE co.id = p.organization_id AND co.contact_user_id = auth.uid()))
          OR (p.organization_type = 'donor' AND EXISTS (SELECT 1 FROM public.donors d WHERE d.id = p.organization_id AND d.user_id = auth.uid()))
        )
    )
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_widgets.page_id
        AND (
          (p.organization_type = 'missionary' AND EXISTS (SELECT 1 FROM public.missionaries m WHERE m.id = p.organization_id AND m.user_id = auth.uid()))
          OR (p.organization_type = 'church' AND EXISTS (SELECT 1 FROM public.churches c WHERE c.id = p.organization_id AND c.contact_user_id = auth.uid()))
          OR (p.organization_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = p.organization_id AND a.contact_user_id = auth.uid()))
          OR (p.organization_type = 'college' AND EXISTS (SELECT 1 FROM public.colleges co WHERE co.id = p.organization_id AND co.contact_user_id = auth.uid()))
          OR (p.organization_type = 'donor' AND EXISTS (SELECT 1 FROM public.donors d WHERE d.id = p.organization_id AND d.user_id = auth.uid()))
        )
    )
  );

-- CHURCH_FOLLOWERS (self-unfollow) -------------------------------------
DROP POLICY IF EXISTS "church_followers_update_self_unfollow" ON public.church_followers;

CREATE POLICY "church_followers_update_self_unfollow"
  ON public.church_followers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status = 'unfollowed');

COMMIT;
