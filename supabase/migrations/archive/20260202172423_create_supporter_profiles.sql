-- ============================================================================
-- SUPPORTER PROFILES TABLE
-- Implements: Supporter Account User Stories (Profile Management)
-- ============================================================================

-- Drop existing table if exists (development only)
-- DROP TABLE IF EXISTS public.supporter_profiles CASCADE;

-- 1. Create supporter_profiles table
CREATE TABLE IF NOT EXISTS public.supporter_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  
  -- Profile Information (Required fields)
  first_name text NOT NULL CHECK (char_length(first_name) > 0),
  last_name text NOT NULL CHECK (char_length(last_name) > 0),
  email text NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  country_of_residence text NOT NULL CHECK (char_length(country_of_residence) > 0),
  
  -- Profile Information (Optional fields)
  phone_number text,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT supporter_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT supporter_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT supporter_profiles_user_id_unique UNIQUE (user_id)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_supporter_profiles_user_id ON public.supporter_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_supporter_profiles_email ON public.supporter_profiles(email);
CREATE INDEX IF NOT EXISTS idx_supporter_profiles_created_at ON public.supporter_profiles(created_at);

-- 3. Enable Row Level Security
ALTER TABLE public.supporter_profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Policy: Supporters can view their own profile
CREATE POLICY "Supporters can view own profile"
ON public.supporter_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Supporters can insert their own profile (during sign-up)
CREATE POLICY "Supporters can insert own profile"
ON public.supporter_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Supporters can update their own profile
CREATE POLICY "Supporters can update own profile"
ON public.supporter_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Supporters can delete their own profile
CREATE POLICY "Supporters can delete own profile"
ON public.supporter_profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Admins and Super Admins can view all supporter profiles
CREATE POLICY "Admins can view all supporter profiles"
ON public.supporter_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.user_id = auth.uid()
    AND users.role IN (1, 2)
  )
);

-- Policy: Admins and Super Admins can update any supporter profile
CREATE POLICY "Admins can update all supporter profiles"
ON public.supporter_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.user_id = auth.uid()
    AND users.role IN (1, 2)
  )
);

-- Policy: Admins and Super Admins can delete any supporter profile
CREATE POLICY "Admins can delete all supporter profiles"
ON public.supporter_profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.user_id = auth.uid()
    AND users.role IN (1, 2)
  )
);

-- 5. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supporter_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_supporter_profiles_updated_at
BEFORE UPDATE ON public.supporter_profiles
FOR EACH ROW
EXECUTE FUNCTION update_supporter_profiles_updated_at();

-- 6. Create optional view for unified supporter follows
CREATE OR REPLACE VIEW public.supporter_follows AS
SELECT 
  'missionary' as entity_type,
  mf.user_id,
  mf.missionary_id as entity_id,
  mf.id as follow_id,
  m.first_name || ' ' || m.last_name as entity_name,
  p.profile_photo_url,
  p.page_url,
  mf.status,
  mf.requested_at,
  mf.reviewed_at,
  mf.created_at
FROM public.missionary_followers mf
JOIN public.missionaries m ON mf.missionary_id = m.id
LEFT JOIN public.pages p ON p.organization_type = 'missionary' AND p.organization_id = m.id

UNION ALL

SELECT 
  'church' as entity_type,
  cf.user_id,
  cf.church_id as entity_id,
  cf.id as follow_id,
  c.name as entity_name,
  p.profile_photo_url,
  p.page_url,
  cf.status,
  cf.requested_at,
  cf.reviewed_at,
  cf.created_at
FROM public.church_followers cf
JOIN public.churches c ON cf.church_id = c.id
LEFT JOIN public.pages p ON p.organization_type = 'church' AND p.organization_id = c.id

ORDER BY created_at DESC;

-- 7. Grant permissions for the view
GRANT SELECT ON public.supporter_follows TO authenticated;

-- 8. Migration notes
COMMENT ON TABLE public.supporter_profiles IS 'Stores supporter-specific profile information for users with role 4 (SUPPORTER)';
COMMENT ON COLUMN public.supporter_profiles.user_id IS 'References auth.users(id) - unique per supporter';
COMMENT ON COLUMN public.supporter_profiles.email IS 'Supporter email, must be valid format';
COMMENT ON COLUMN public.supporter_profiles.country_of_residence IS 'Required field for supporter profile';
COMMENT ON VIEW public.supporter_follows IS 'Unified view of all missionary and church follows for supporters';

