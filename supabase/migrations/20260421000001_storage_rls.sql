BEGIN;

-- Path-prefix based ownership policies on storage.objects so that even if
-- a client ever uses the anon key, writes are constrained to the owner's
-- own folder. Service role (used server-side via getSupabaseAdmin)
-- bypasses these policies as expected.
--
-- NOTE: `storage.objects` is owned by `supabase_storage_admin`; RLS is
-- already enabled by default on managed Supabase. We do not ALTER TABLE
-- here because the migration role is not the table owner (42501).

-- Ensure is_staff() exists (it was introduced in the harden migration
-- but is not present in the squashed baseline). Idempotent re-create.
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

DROP POLICY IF EXISTS "h21_public_read" ON storage.objects;
DROP POLICY IF EXISTS "h21_supporters_write_self" ON storage.objects;
DROP POLICY IF EXISTS "h21_supporters_update_self" ON storage.objects;
DROP POLICY IF EXISTS "h21_supporters_delete_self" ON storage.objects;
DROP POLICY IF EXISTS "h21_missionaries_write_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_missionaries_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_missionaries_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_churches_write_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_churches_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_churches_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_agencies_write_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_agencies_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_agencies_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_colleges_write_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_colleges_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_colleges_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "h21_homepage_write_staff" ON storage.objects;
DROP POLICY IF EXISTS "h21_homepage_update_staff" ON storage.objects;
DROP POLICY IF EXISTS "h21_homepage_delete_staff" ON storage.objects;
DROP POLICY IF EXISTS "h21_richcontent_write_auth" ON storage.objects;
DROP POLICY IF EXISTS "h21_richcontent_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "h21_richcontent_delete_auth" ON storage.objects;

-- Public read of all h21-dev objects (current behavior).
CREATE POLICY "h21_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'h21-dev');

-- Supporters: self-folder by uid.
CREATE POLICY "h21_supporters_write_self"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'supporters'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "h21_supporters_update_self"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'supporters'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'supporters'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "h21_supporters_delete_self"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'supporters'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Missionaries: owner (user_id) or staff.
CREATE POLICY "h21_missionaries_write_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'missionaries'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.missionaries m
        WHERE m.id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_missionaries_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'missionaries'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.missionaries m
        WHERE m.id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'missionaries'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.missionaries m
        WHERE m.id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_missionaries_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'missionaries'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.missionaries m
        WHERE m.id::text = (storage.foldername(name))[2]
          AND m.user_id = auth.uid()
      )
    )
  );

-- Churches: contact_user_id or staff.
CREATE POLICY "h21_churches_write_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'churches'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.churches c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_churches_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'churches'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.churches c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'churches'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.churches c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_churches_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'churches'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.churches c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  );

-- Agencies: contact_user_id or staff.
CREATE POLICY "h21_agencies_write_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'agencies'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id::text = (storage.foldername(name))[2]
          AND a.contact_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_agencies_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'agencies'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id::text = (storage.foldername(name))[2]
          AND a.contact_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'agencies'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id::text = (storage.foldername(name))[2]
          AND a.contact_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_agencies_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'agencies'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id::text = (storage.foldername(name))[2]
          AND a.contact_user_id = auth.uid()
      )
    )
  );

-- Colleges: contact_user_id or staff.
CREATE POLICY "h21_colleges_write_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'colleges'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.colleges c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_colleges_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'colleges'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.colleges c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'colleges'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.colleges c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "h21_colleges_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'colleges'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.colleges c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND c.contact_user_id = auth.uid()
      )
    )
  );

-- Homepage assets (banners, etc.): staff only.
CREATE POLICY "h21_homepage_write_staff"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] IN ('assets', 'homepage')
    AND public.is_staff()
  );

CREATE POLICY "h21_homepage_update_staff"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] IN ('assets', 'homepage')
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] IN ('assets', 'homepage')
    AND public.is_staff()
  );

CREATE POLICY "h21_homepage_delete_staff"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] IN ('assets', 'homepage')
    AND public.is_staff()
  );

-- Rich-content editor uploads: any authenticated user (owner is not tracked by path).
CREATE POLICY "h21_richcontent_write_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'rich-content'
  );

CREATE POLICY "h21_richcontent_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'rich-content'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'rich-content'
  );

CREATE POLICY "h21_richcontent_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'h21-dev'
    AND (storage.foldername(name))[1] = 'rich-content'
    AND (owner = auth.uid() OR public.is_staff())
  );

COMMIT;
