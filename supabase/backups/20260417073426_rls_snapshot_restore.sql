-- =======================================================================
-- RLS SNAPSHOT (captured 2026-04-17 before harden_rls_security migration)
-- Run this file to restore policies to their pre-migration state.
--
-- This script:
--   1. Drops all policies created by 20260417073426_harden_rls_security.sql
--   2. Drops the public views and is_staff() helper added by that migration
--   3. Recreates every original policy exactly as it existed
--
-- RLS enablement on tables is unchanged (all were already enabled).
-- Function bodies are unchanged (only search_path setting was altered).
-- Run inside a transaction.
-- =======================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. REMOVE NEW OBJECTS CREATED BY harden_rls_security MIGRATION
-- -----------------------------------------------------------------------

-- New policies (users)
DROP POLICY IF EXISTS "users_select_self"   ON public.users;
DROP POLICY IF EXISTS "users_select_staff"  ON public.users;
DROP POLICY IF EXISTS "users_update_self"   ON public.users;
DROP POLICY IF EXISTS "users_update_staff"  ON public.users;
DROP POLICY IF EXISTS "users_insert_staff"  ON public.users;
DROP POLICY IF EXISTS "users_delete_admin"  ON public.users;

-- New policies (donors)
DROP POLICY IF EXISTS "donors_select_self_or_staff"  ON public.donors;
DROP POLICY IF EXISTS "donors_insert_self_or_staff"  ON public.donors;
DROP POLICY IF EXISTS "donors_update_self_or_staff"  ON public.donors;
DROP POLICY IF EXISTS "donors_delete_admin"          ON public.donors;

-- New policies (missionaries)
DROP POLICY IF EXISTS "missionaries_select_self_or_staff" ON public.missionaries;
DROP POLICY IF EXISTS "missionaries_insert_self_or_staff" ON public.missionaries;
DROP POLICY IF EXISTS "missionaries_update_self_or_staff" ON public.missionaries;
DROP POLICY IF EXISTS "missionaries_delete_admin"         ON public.missionaries;

-- New policies (churches)
DROP POLICY IF EXISTS "churches_select_contact_or_staff" ON public.churches;
DROP POLICY IF EXISTS "churches_insert_staff"            ON public.churches;
DROP POLICY IF EXISTS "churches_update_contact_or_staff" ON public.churches;
DROP POLICY IF EXISTS "churches_delete_admin"            ON public.churches;

-- New policies (agencies)
DROP POLICY IF EXISTS "agencies_select_contact_or_staff" ON public.agencies;
DROP POLICY IF EXISTS "agencies_insert_staff"            ON public.agencies;
DROP POLICY IF EXISTS "agencies_update_contact_or_staff" ON public.agencies;
DROP POLICY IF EXISTS "agencies_delete_admin"            ON public.agencies;

-- New policies (colleges)
DROP POLICY IF EXISTS "colleges_select_contact_or_staff" ON public.colleges;
DROP POLICY IF EXISTS "colleges_insert_staff"            ON public.colleges;
DROP POLICY IF EXISTS "colleges_update_contact_or_staff" ON public.colleges;
DROP POLICY IF EXISTS "colleges_delete_admin"            ON public.colleges;

-- New policies (pages)
DROP POLICY IF EXISTS "pages_select_staff"  ON public.pages;
DROP POLICY IF EXISTS "pages_manage_staff"  ON public.pages;

-- New policies (page_approvals)
DROP POLICY IF EXISTS "page_approvals_select_requester_or_staff" ON public.page_approvals;
DROP POLICY IF EXISTS "page_approvals_insert_owner"              ON public.page_approvals;
DROP POLICY IF EXISTS "page_approvals_update_staff"              ON public.page_approvals;
DROP POLICY IF EXISTS "page_approvals_delete_admin"              ON public.page_approvals;

-- New policies (page_donations)
DROP POLICY IF EXISTS "page_donations_select_donor_or_owner_or_staff" ON public.page_donations;
DROP POLICY IF EXISTS "page_donations_update_staff"                   ON public.page_donations;
DROP POLICY IF EXISTS "page_donations_delete_admin"                   ON public.page_donations;

-- New policies (page_media / page_widgets)
DROP POLICY IF EXISTS "page_media_manage_owner"   ON public.page_media;
DROP POLICY IF EXISTS "page_widgets_manage_owner" ON public.page_widgets;

-- New policies (church_followers)
DROP POLICY IF EXISTS "church_followers_update_self_unfollow" ON public.church_followers;

-- Public views (created by migration)
DROP VIEW IF EXISTS public.missionaries_public;
DROP VIEW IF EXISTS public.churches_public;
DROP VIEW IF EXISTS public.agencies_public;
DROP VIEW IF EXISTS public.colleges_public;

-- Helper function
DROP FUNCTION IF EXISTS public.is_staff();

-- Reset search_path hardening (optional; keeping the SET is safe)
ALTER FUNCTION public.is_admin() RESET search_path;
ALTER FUNCTION public.is_church_follower(bigint, uuid) RESET search_path;
ALTER FUNCTION public.get_church_follower_status(bigint, uuid) RESET search_path;
ALTER FUNCTION public.get_church_follower_count(bigint) RESET search_path;
ALTER FUNCTION public.set_updated_at() RESET search_path;
ALTER FUNCTION public.bump_update_count() RESET search_path;
ALTER FUNCTION public.bump_amen_count() RESET search_path;

-- -----------------------------------------------------------------------
-- 2. RESTORE ORIGINAL POLICIES (exactly as they were)
-- -----------------------------------------------------------------------

-- agencies
CREATE POLICY agencies_delete_admin ON public.agencies AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY agencies_insert_admin ON public.agencies AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY agencies_select_public ON public.agencies AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY agencies_update_admin_or_owner ON public.agencies AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (contact_user_id = auth.uid())));

-- church_followers
CREATE POLICY "Admins can view all followers" ON public.church_followers AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "Church owners can update follow requests" ON public.church_followers AS PERMISSIVE FOR UPDATE TO public USING (((EXISTS ( SELECT 1
   FROM churches c
  WHERE ((c.id = church_followers.church_id) AND (c.contact_user_id = auth.uid())))) OR is_admin()));
CREATE POLICY "Church owners can view all followers" ON public.church_followers AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM churches c
  WHERE ((c.id = church_followers.church_id) AND (c.contact_user_id = auth.uid())))));
CREATE POLICY "Users can create follow requests" ON public.church_followers AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own follow requests" ON public.church_followers AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own follow requests" ON public.church_followers AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

-- church_missionaries
CREATE POLICY "Anyone can view active church missionaries" ON public.church_missionaries AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Church owners can manage missionaries" ON public.church_missionaries AS PERMISSIVE FOR ALL TO authenticated USING (((EXISTS ( SELECT 1
   FROM churches c
  WHERE ((c.id = church_missionaries.church_id) AND (c.contact_user_id = auth.uid())))) OR is_admin()));

-- churches
CREATE POLICY churches_delete_admin ON public.churches AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY churches_insert_admin ON public.churches AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY churches_select_public ON public.churches AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY churches_update_admin_or_owner ON public.churches AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (contact_user_id = auth.uid())));

-- colleges
CREATE POLICY "All" ON public.colleges AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() IN ( SELECT users.user_id
   FROM users
  WHERE (users.role = ANY (ARRAY[1, 2]))))) WITH CHECK ((auth.uid() IN ( SELECT users.user_id
   FROM users
  WHERE (users.role = ANY (ARRAY[1, 2])))));
CREATE POLICY colleges_delete_admin ON public.colleges AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY colleges_insert_admin ON public.colleges AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY colleges_select_public ON public.colleges AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY colleges_update_admin_or_owner ON public.colleges AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (contact_user_id = auth.uid())));

-- donors
CREATE POLICY donors_delete_admin ON public.donors AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY donors_insert_admin ON public.donors AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY donors_select_public ON public.donors AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY donors_update_admin_or_owner ON public.donors AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (user_id = auth.uid())));

-- homepage_banners
CREATE POLICY "Admins can delete banners" ON public.homepage_banners AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY "Admins can insert banners" ON public.homepage_banners AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "Admins can update banners" ON public.homepage_banners AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Admins can view all banners" ON public.homepage_banners AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "Anyone can view active banners" ON public.homepage_banners AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));

-- homepage_settings
CREATE POLICY "Admins can update homepage settings" ON public.homepage_settings AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Anyone can view homepage settings" ON public.homepage_settings AS PERMISSIVE FOR SELECT TO public USING (true);

-- missionaries
CREATE POLICY missionaries_delete_admin ON public.missionaries AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY missionaries_insert_admin ON public.missionaries AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY missionaries_select_public ON public.missionaries AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY missionaries_update_admin_or_owner ON public.missionaries AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (user_id = auth.uid())));

-- page_media
CREATE POLICY "Public can view media of published pages" ON public.page_media AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM pages p
  WHERE ((p.id = page_media.page_id) AND (p.is_published = true)))));

-- page_widgets
CREATE POLICY "Public can view widgets of published pages" ON public.page_widgets AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM pages p
  WHERE ((p.id = page_widgets.page_id) AND (p.is_published = true)))));

-- pages
CREATE POLICY "Owner can view their own page" ON public.pages AS PERMISSIVE FOR SELECT TO public USING ((((organization_type = 'missionary'::text) AND (EXISTS ( SELECT 1
   FROM missionaries m
  WHERE ((m.id = pages.organization_id) AND (m.user_id = auth.uid()))))) OR ((organization_type = 'church'::text) AND (EXISTS ( SELECT 1
   FROM churches ch
  WHERE ((ch.id = pages.organization_id) AND (ch.contact_user_id = auth.uid()))))) OR ((organization_type = 'college'::text) AND (EXISTS ( SELECT 1
   FROM colleges co
  WHERE ((co.id = pages.organization_id) AND (co.contact_user_id = auth.uid()))))) OR ((organization_type = 'agency'::text) AND (EXISTS ( SELECT 1
   FROM agencies ag
  WHERE ((ag.id = pages.organization_id) AND (ag.contact_user_id = auth.uid()))))) OR ((organization_type = 'donor'::text) AND (EXISTS ( SELECT 1
   FROM donors d
  WHERE ((d.id = pages.organization_id) AND (d.user_id = auth.uid())))))));
CREATE POLICY "Owner or org contact can manage page" ON public.pages AS PERMISSIVE FOR ALL TO public USING ((((organization_type = 'missionary'::text) AND (EXISTS ( SELECT 1
   FROM missionaries m
  WHERE ((m.id = pages.organization_id) AND (m.user_id = auth.uid()))))) OR ((organization_type = 'church'::text) AND (EXISTS ( SELECT 1
   FROM churches ch
  WHERE ((ch.id = pages.organization_id) AND (ch.contact_user_id = auth.uid()))))) OR ((organization_type = 'college'::text) AND (EXISTS ( SELECT 1
   FROM colleges co
  WHERE ((co.id = pages.organization_id) AND (co.contact_user_id = auth.uid()))))) OR ((organization_type = 'agency'::text) AND (EXISTS ( SELECT 1
   FROM agencies ag
  WHERE ((ag.id = pages.organization_id) AND (ag.contact_user_id = auth.uid()))))) OR ((organization_type = 'donor'::text) AND (EXISTS ( SELECT 1
   FROM donors d
  WHERE ((d.id = pages.organization_id) AND (d.user_id = auth.uid())))))));
CREATE POLICY "Public can view published pages" ON public.pages AS PERMISSIVE FOR SELECT TO public USING ((is_published = true));

-- prayer_reactions
CREATE POLICY "Auth users can amen published public prayers" ON public.prayer_reactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM prayers p
  WHERE ((p.id = prayer_reactions.prayer_id) AND (p.is_published = true) AND (p.visibility = 'public'::text) AND (p.deleted_at IS NULL)))));
CREATE POLICY "Public read reactions of public prayers" ON public.prayer_reactions AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM prayers p
  WHERE ((p.id = prayer_reactions.prayer_id) AND (p.is_published = true) AND (p.visibility = 'public'::text) AND (p.deleted_at IS NULL)))));
CREATE POLICY "Reactor can delete reaction" ON public.prayer_reactions AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));

-- prayer_updates
CREATE POLICY "Owner can read/create updates on own prayer" ON public.prayer_updates AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM prayers p
  WHERE ((p.id = prayer_updates.prayer_id) AND (p.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM prayers p
  WHERE ((p.id = prayer_updates.prayer_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "Public can read updates of public prayers" ON public.prayer_updates AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM prayers p
  WHERE ((p.id = prayer_updates.prayer_id) AND (p.is_published = true) AND (p.visibility = 'public'::text) AND (p.deleted_at IS NULL)))));

-- prayers
CREATE POLICY "Owner can delete prayers" ON public.prayers AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Owner can read own prayers" ON public.prayers AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) AND (deleted_at IS NULL)));
CREATE POLICY "Owner can update prayers" ON public.prayers AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Public can read published prayers" ON public.prayers AS PERMISSIVE FOR SELECT TO public USING (((is_published = true) AND (deleted_at IS NULL) AND (visibility = 'public'::text)));
CREATE POLICY "Users can insert prayers" ON public.prayers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

-- user_roles
CREATE POLICY "Admins and Managers can access" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() IN ( SELECT users.user_id
   FROM users
  WHERE (users.role = ANY (ARRAY[1, 2]))))) WITH CHECK ((auth.uid() IN ( SELECT users.user_id
   FROM users
  WHERE (users.role = ANY (ARRAY[1, 2])))));

-- users
CREATE POLICY "Admins and Staff can update all users" ON public.users AS PERMISSIVE FOR UPDATE TO public USING ((role = ANY (ARRAY[1, 2]))) WITH CHECK ((role = ANY (ARRAY[1, 2])));
CREATE POLICY "Admins and Staff can view all users" ON public.users AS PERMISSIVE FOR SELECT TO public USING ((role = ANY (ARRAY[1, 2])));
CREATE POLICY "Create Admin" ON public.users AS PERMISSIVE FOR INSERT TO public WITH CHECK ((role = ANY (ARRAY[1, 2])));

COMMIT;
