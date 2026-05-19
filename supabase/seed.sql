-- Seed script for development environment
-- Creates deterministic test data for local `supabase db reset`

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_test_password constant text := 'Test123!';
  v_admin_id          uuid := '532c9368-cb53-409a-a249-d7f38931397f';
  v_missionary_user_id uuid := 'f1111111-1111-4111-8111-111111111111';
  v_supporter_user_id uuid := 'f2222222-2222-4222-8222-222222222222';
  v_admin_hash        text;
  v_missionary_hash   text;
  v_supporter_hash    text;
  v_missionary_id     bigint;
  v_page_id           bigint;
  v_church_id         bigint;
  v_agency_id         bigint;
  v_college_id        bigint;
BEGIN
  v_admin_hash := extensions.crypt(v_test_password, extensions.gen_salt('bf'));
  v_missionary_hash := extensions.crypt(v_test_password, extensions.gen_salt('bf'));
  v_supporter_hash := extensions.crypt(v_test_password, extensions.gen_salt('bf'));

  RAISE NOTICE '====================================';
  RAISE NOTICE 'Starting seed process...';
  RAISE NOTICE '====================================';

  ---------------------------------
  -- 0. User roles (required FK target for public.users.role)
  ---------------------------------
  RAISE NOTICE '0. Seeding user_roles...';

  INSERT INTO public.user_roles (id, role) VALUES
    (1, 'ADMIN'),
    (2, 'SUPER ADMIN'),
    (3, 'MISSIONARY'),
    (4, 'SUPPORTER'),
    (5, 'MISSION AGENCY'),
    (6, 'CHURCH'),
    (7, 'COLLEGE ADMIN')
  ON CONFLICT (id) DO NOTHING;

  ---------------------------------
  -- 1. Auth users (GoTrue expects token columns + identities id = user_id)
  ---------------------------------
  RAISE NOTICE '1. Creating auth users...';

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_admin_id,
    'authenticated',
    'authenticated',
    'shared@harvest21.com',
    v_admin_hash,
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NULL, now(), now(),
    NULL, NULL, '', '', NULL,
    '', 0, NULL, '', NULL,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_missionary_user_id,
    'authenticated',
    'authenticated',
    'john.doe@example.com',
    v_missionary_hash,
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NULL, now(), now(),
    NULL, NULL, '', '', NULL,
    '', 0, NULL, '', NULL,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_supporter_user_id,
    'authenticated',
    'authenticated',
    'supporter@test.harvest21.com',
    v_supporter_hash,
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NULL, now(), now(),
    NULL, NULL, '', '', NULL,
    '', 0, NULL, '', NULL,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM auth.identities
  WHERE user_id IN (v_admin_id, v_missionary_user_id, v_supporter_user_id);

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES
    (
      v_admin_id, v_admin_id, v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'shared@harvest21.com'),
      'email', now(), now(), now()
    ),
    (
      v_missionary_user_id, v_missionary_user_id, v_missionary_user_id::text,
      jsonb_build_object('sub', v_missionary_user_id::text, 'email', 'john.doe@example.com'),
      'email', now(), now(), now()
    ),
    (
      v_supporter_user_id, v_supporter_user_id, v_supporter_user_id::text,
      jsonb_build_object('sub', v_supporter_user_id::text, 'email', 'supporter@test.harvest21.com'),
      'email', now(), now(), now()
    );

  INSERT INTO public.users (
    user_id, role, status, first_name, last_name, email, created_at
  )
  SELECT v_admin_id, 1, 'Active', 'Harvest21', 'Admin', 'shared@harvest21.com', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = v_admin_id
  );

  INSERT INTO public.users (
    user_id, role, status, first_name, last_name, email, created_at
  )
  SELECT v_missionary_user_id, 3, 'Active', 'John', 'Doe', 'john.doe@example.com', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = v_missionary_user_id
  );

  INSERT INTO public.users (
    user_id, role, status, first_name, last_name, email, created_at
  )
  SELECT v_supporter_user_id, 4, 'Active', 'Sam', 'Supporter', 'supporter@test.harvest21.com', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = v_supporter_user_id
  );

  INSERT INTO public.donors (
    user_id, first_name, last_name, email, created_at, updated_at
  ) VALUES (
    v_supporter_user_id, 'Sam', 'Supporter', 'supporter@test.harvest21.com', now(), now()
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  INSERT INTO public.supporter_profiles (
    user_id, first_name, last_name, email, country_of_residence, created_at, updated_at
  ) VALUES (
    v_supporter_user_id, 'Sam', 'Supporter', 'supporter@test.harvest21.com', 'United States', now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    country_of_residence = EXCLUDED.country_of_residence,
    updated_at = now();

  ---------------------------------
  -- 2. Missionary
  ---------------------------------
  RAISE NOTICE '2. Creating test missionary...';

  INSERT INTO public.missionaries (
    user_id, first_name, last_name, email, phone_number,
    country_of_residence, destination_country, mission_status,
    biography, open_to_visits, created_at
  ) VALUES (
    v_missionary_user_id, 'John', 'Doe', 'john.doe@example.com', '+1234567890',
    'United States', 'Chile', 'On-Field',
    'John Doe is a missionary serving in Chile, bringing the gospel to unreached communities.',
    true, now()
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone_number = EXCLUDED.phone_number,
    country_of_residence = EXCLUDED.country_of_residence,
    destination_country = EXCLUDED.destination_country,
    mission_status = EXCLUDED.mission_status,
    biography = EXCLUDED.biography,
    open_to_visits = EXCLUDED.open_to_visits
  RETURNING id INTO v_missionary_id;

  ---------------------------------
  -- 3. Church
  ---------------------------------
  RAISE NOTICE '3. Creating test church...';

  SELECT id INTO v_church_id
    FROM public.churches WHERE name = 'First Baptist Church' LIMIT 1;

  IF v_church_id IS NULL THEN
    INSERT INTO public.churches (
      name, phone_number, address, city, state, country, website, created_at
    ) VALUES (
      'First Baptist Church', '+1234567890', '123 Main St',
      'Springfield', 'IL', 'United States', 'https://firstbaptist.org', now()
    )
    RETURNING id INTO v_church_id;
  END IF;

  ---------------------------------
  -- 4. Agency
  ---------------------------------
  RAISE NOTICE '4. Creating test agency...';

  SELECT id INTO v_agency_id
    FROM public.agencies WHERE name = 'Global Missions Agency' LIMIT 1;

  IF v_agency_id IS NULL THEN
    INSERT INTO public.agencies (
      name, email, website, address, city, state, country, created_at
    ) VALUES (
      'Global Missions Agency', 'info@globalmissions.org',
      'https://globalmissions.org', '456 Mission Way',
      'Dallas', 'TX', 'United States', now()
    )
    RETURNING id INTO v_agency_id;
  END IF;

  ---------------------------------
  -- 5. College
  ---------------------------------
  RAISE NOTICE '5. Creating test college...';

  SELECT id INTO v_college_id
    FROM public.colleges WHERE name = 'Bible College' LIMIT 1;

  IF v_college_id IS NULL THEN
    INSERT INTO public.colleges (
      name, email, address, city, country, website, created_at
    ) VALUES (
      'Bible College', 'info@biblecollege.edu', '789 Seminary Rd',
      'Springfield', 'United States', 'https://biblecollege.edu', now()
    )
    RETURNING id INTO v_college_id;
  END IF;

  ---------------------------------
  -- 6. Link missionary -> agency/college
  ---------------------------------
  UPDATE public.missionaries
     SET agency_id = v_agency_id,
         college_id = v_college_id,
         sending_church_id = v_church_id
   WHERE id = v_missionary_id;

  ---------------------------------
  -- 7. Missionary page
  ---------------------------------
  RAISE NOTICE '6. Creating missionary page...';

  INSERT INTO public.pages (
    name, page_url, organization_id, organization_type,
    is_published, profile_photo_url, donation_percentage,
    donation_mode, about_text, short_quote, created_at, updated_at
  ) VALUES (
    'John Doe - Chile Mission',
    'john-doe-chile',
    v_missionary_id,
    'missionary',
    true,
    '/Images/default-avatar.png',
    75.5,
    'harvest21',
    'Serving in Chile since 2020, reaching unreached communities with the gospel.',
    'For to me, to live is Christ.',
    now(), now()
  )
  ON CONFLICT (page_url) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_page_id;

  ---------------------------------
  -- 8. Missionary-church affiliation
  ---------------------------------
  INSERT INTO public.missionary_churches (
    missionary_id, church_id, relationship_type, is_active, created_at
  )
  SELECT v_missionary_id, v_church_id, 'sending', true, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.missionary_churches
     WHERE missionary_id = v_missionary_id AND church_id = v_church_id
  );

  ---------------------------------
  -- 9. Cypress E2E test accounts (all password: Test123!)
  -- Fixed UUIDs so Cypress tasks can look up by UUID without querying auth.
  ---------------------------------
  RAISE NOTICE '9. Seeding Cypress E2E test accounts...';

  -- Admin: airken.99+admin@gmail.com
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'airken.99+admin@gmail.com',
    extensions.crypt(v_test_password, extensions.gen_salt('bf')),
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NULL, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.users (user_id, role, status, email, first_name, last_name, created_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1, 'Active', 'airken.99+admin@gmail.com', 'Admin', 'User', now())
  ON CONFLICT (user_id) DO UPDATE SET role = 1, email = EXCLUDED.email;

  -- Missionary 1: m1@h21test.local (Alice Waller)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b1000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'm1@h21test.local',
    extensions.crypt(v_test_password, extensions.gen_salt('bf')),
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NULL, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.users (user_id, role, status, email, first_name, last_name, created_at)
  VALUES ('b1000000-0000-0000-0000-000000000001', 3, 'Active', 'm1@h21test.local', 'Alice', 'Waller', now())
  ON CONFLICT (user_id) DO UPDATE SET first_name = 'Alice', last_name = 'Waller', role = 3;

  IF NOT EXISTS (SELECT 1 FROM public.missionaries WHERE email = 'm1@h21test.local') THEN
    INSERT INTO public.missionaries (
      first_name, last_name, email, destination_country, mission_status,
      country_of_residence, open_to_visits, agency_id, sending_church_id,
      mission_field_church_id, user_id, created_at
    ) VALUES (
      'Alice', 'Waller', 'm1@h21test.local', 'KE', 'On-Field',
      'US', false, v_agency_id, v_church_id, v_church_id,
      'b1000000-0000-0000-0000-000000000001', now()
    ) RETURNING id INTO v_missionary_id;
    INSERT INTO public.pages (organization_type, organization_id, page_url, is_published, donation_mode, created_at)
    VALUES ('missionary', v_missionary_id, 'alice-waller', true, 'harvest21', now())
    ON CONFLICT (page_url) DO NOTHING;
  ELSE
    SELECT id INTO v_missionary_id FROM public.missionaries WHERE email = 'm1@h21test.local';
    UPDATE public.missionaries SET first_name = 'Alice', last_name = 'Waller',
      user_id = 'b1000000-0000-0000-0000-000000000001' WHERE id = v_missionary_id;
    UPDATE public.pages SET page_url = 'alice-waller', is_published = true
    WHERE organization_id = v_missionary_id AND organization_type = 'missionary';
  END IF;

  -- Missionary 2: m2@h21test.local (Bob Carter)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b2000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'm2@h21test.local',
    extensions.crypt(v_test_password, extensions.gen_salt('bf')),
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NULL, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.users (user_id, role, status, email, first_name, last_name, created_at)
  VALUES ('b2000000-0000-0000-0000-000000000002', 3, 'Active', 'm2@h21test.local', 'Bob', 'Carter', now())
  ON CONFLICT (user_id) DO UPDATE SET first_name = 'Bob', last_name = 'Carter', role = 3;

  IF NOT EXISTS (SELECT 1 FROM public.missionaries WHERE email = 'm2@h21test.local') THEN
    INSERT INTO public.missionaries (
      first_name, last_name, email, destination_country, mission_status,
      country_of_residence, open_to_visits, agency_id, sending_church_id,
      mission_field_church_id, user_id, created_at
    ) VALUES (
      'Bob', 'Carter', 'm2@h21test.local', 'BR', 'On-Field',
      'US', false, v_agency_id, v_church_id, v_church_id,
      'b2000000-0000-0000-0000-000000000002', now()
    ) RETURNING id INTO v_missionary_id;
    INSERT INTO public.pages (organization_type, organization_id, page_url, is_published, donation_mode, created_at)
    VALUES ('missionary', v_missionary_id, 'bob-carter', true, 'harvest21', now())
    ON CONFLICT (page_url) DO NOTHING;
  ELSE
    SELECT id INTO v_missionary_id FROM public.missionaries WHERE email = 'm2@h21test.local';
    UPDATE public.missionaries SET first_name = 'Bob', last_name = 'Carter',
      user_id = 'b2000000-0000-0000-0000-000000000002' WHERE id = v_missionary_id;
    UPDATE public.pages SET page_url = 'bob-carter', is_published = true
    WHERE organization_id = v_missionary_id AND organization_type = 'missionary';
  END IF;

  -- Supporter: supporter@h21test.local (Carol Smith)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b3000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated',
    'supporter@h21test.local',
    extensions.crypt(v_test_password, extensions.gen_salt('bf')),
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NULL, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.users (user_id, role, status, email, first_name, last_name, created_at)
  VALUES ('b3000000-0000-0000-0000-000000000003', 4, 'Active', 'supporter@h21test.local', 'Carol', 'Smith', now())
  ON CONFLICT (user_id) DO UPDATE SET first_name = 'Carol', last_name = 'Smith', role = 4;

  INSERT INTO public.supporter_profiles (user_id, first_name, last_name, email, country_of_residence, created_at, updated_at)
  VALUES ('b3000000-0000-0000-0000-000000000003', 'Carol', 'Smith', 'supporter@h21test.local', 'US', now(), now())
  ON CONFLICT (user_id) DO UPDATE SET first_name = 'Carol', last_name = 'Smith';

  -- Church contact: church@h21test.local (David Jones)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b4000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated',
    'church@h21test.local',
    extensions.crypt(v_test_password, extensions.gen_salt('bf')),
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NULL, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.users (user_id, role, status, email, first_name, last_name, created_at)
  VALUES ('b4000000-0000-0000-0000-000000000004', 6, 'Active', 'church@h21test.local', 'David', 'Jones', now())
  ON CONFLICT (user_id) DO UPDATE SET role = 6, email = EXCLUDED.email;

  UPDATE public.churches SET contact_user_id = 'b4000000-0000-0000-0000-000000000004'
  WHERE id = v_church_id;

  -- Agency contact: agency@h21test.local (Eve Brown)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b5000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated',
    'agency@h21test.local',
    extensions.crypt(v_test_password, extensions.gen_salt('bf')),
    now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NULL, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.users (user_id, role, status, email, first_name, last_name, created_at)
  VALUES ('b5000000-0000-0000-0000-000000000005', 5, 'Active', 'agency@h21test.local', 'Eve', 'Brown', now())
  ON CONFLICT (user_id) DO UPDATE SET role = 5, email = EXCLUDED.email;

  UPDATE public.agencies SET contact_user_id = 'b5000000-0000-0000-0000-000000000005'
  WHERE id = v_agency_id;

  RAISE NOTICE '   ✓ Cypress E2E test accounts seeded';

  RAISE NOTICE '====================================';
  RAISE NOTICE 'Seed complete. Password for all: %', v_test_password;
  RAISE NOTICE '  shared@harvest21.com (admin)';
  RAISE NOTICE '  john.doe@example.com (missionary)';
  RAISE NOTICE '  supporter@test.harvest21.com (supporter)';
  RAISE NOTICE 'Cypress accounts:';
  RAISE NOTICE '  airken.99+admin@gmail.com (admin)';
  RAISE NOTICE '  m1@h21test.local (Alice Waller, missionary)';
  RAISE NOTICE '  m2@h21test.local (Bob Carter, missionary)';
  RAISE NOTICE '  supporter@h21test.local (Carol Smith)';
  RAISE NOTICE '  church@h21test.local (David Jones)';
  RAISE NOTICE '  agency@h21test.local (Eve Brown)';
  RAISE NOTICE '====================================';
END $$;
