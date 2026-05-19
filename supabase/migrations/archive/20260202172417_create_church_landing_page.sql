-- ============================================================================
-- CHURCH LANDING PAGE SYSTEM
-- Implements EPIC: Church Landing Page with Follow System & Missionary Directory
-- ============================================================================

-- 1. Church Followers Table (Follow System)
-- Tracks follow requests and follower status for churches
CREATE TABLE IF NOT EXISTS public.church_followers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  church_id bigint NOT NULL,
  user_id uuid NOT NULL,
  
  -- Follow status: pending, accepted, rejected, blocked
  status text DEFAULT 'pending'::text NOT NULL 
    CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'blocked'::text])),
  
  -- Who approved/rejected the follow request
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  
  CONSTRAINT church_followers_pkey PRIMARY KEY (id),
  CONSTRAINT church_followers_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE,
  CONSTRAINT church_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT church_followers_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  
  -- Unique constraint: one follow record per user per church
  CONSTRAINT church_followers_unique UNIQUE (church_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_church_followers_church_id ON public.church_followers(church_id);
CREATE INDEX IF NOT EXISTS idx_church_followers_user_id ON public.church_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_church_followers_status ON public.church_followers(status);

-- 2. Church-Missionary Relationships
-- Links churches to the missionaries they support (for "Our Missionaries" tab)
CREATE TABLE IF NOT EXISTS public.church_missionaries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  church_id bigint NOT NULL,
  missionary_id bigint NOT NULL,
  
  -- Optional: relationship type (sending, supporting, partner, etc.)
  relationship_type text DEFAULT 'supporting'::text
    CHECK (relationship_type = ANY (ARRAY['sending'::text, 'supporting'::text, 'partner'::text])),
  
  -- Is this relationship active/visible?
  is_active boolean DEFAULT true,
  
  CONSTRAINT church_missionaries_pkey PRIMARY KEY (id),
  CONSTRAINT church_missionaries_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE,
  CONSTRAINT church_missionaries_missionary_id_fkey FOREIGN KEY (missionary_id) REFERENCES public.missionaries(id) ON DELETE CASCADE,
  
  -- Unique constraint: prevent duplicate relationships
  CONSTRAINT church_missionaries_unique UNIQUE (church_id, missionary_id)
);

CREATE INDEX IF NOT EXISTS idx_church_missionaries_church_id ON public.church_missionaries(church_id);
CREATE INDEX IF NOT EXISTS idx_church_missionaries_missionary_id ON public.church_missionaries(missionary_id);

-- 3. Extend churches table with additional fields (if not exists)
-- Add email column if it doesn't exist (for church contact)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'churches' 
                 AND column_name = 'email') THEN
    ALTER TABLE public.churches ADD COLUMN email text;
  END IF;
END $$;

-- Add description/tagline for hero banner
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'churches' 
                 AND column_name = 'description') THEN
    ALTER TABLE public.churches ADD COLUMN description text;
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.church_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_missionaries ENABLE ROW LEVEL SECURITY;

-- Church Followers Policies
-- Allow users to view their own follow requests
CREATE POLICY "Users can view their own follow requests"
  ON public.church_followers FOR SELECT
  USING (auth.uid() = user_id);

-- Allow church owners to view all followers
CREATE POLICY "Church owners can view all followers"
  ON public.church_followers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = church_followers.church_id
      AND c.contact_user_id = auth.uid()
    )
  );

-- Allow admins to view all followers
CREATE POLICY "Admins can view all followers"
  ON public.church_followers FOR SELECT
  USING (public.is_admin());

-- Allow logged-in users to create follow requests
CREATE POLICY "Users can create follow requests"
  ON public.church_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow church owners and admins to update follow requests
CREATE POLICY "Church owners can update follow requests"
  ON public.church_followers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = church_followers.church_id
      AND c.contact_user_id = auth.uid()
    ) OR public.is_admin()
  );

-- Allow users to delete their own follow requests (unfollow)
CREATE POLICY "Users can delete their own follow requests"
  ON public.church_followers FOR DELETE
  USING (auth.uid() = user_id);

-- Church Missionaries Policies
-- Public can view active church-missionary relationships
CREATE POLICY "Anyone can view active church missionaries"
  ON public.church_missionaries FOR SELECT
  USING (is_active = true);

-- Church owners and admins can manage relationships
CREATE POLICY "Church owners can manage missionaries"
  ON public.church_missionaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = church_missionaries.church_id
      AND c.contact_user_id = auth.uid()
    ) OR public.is_admin()
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user is an accepted follower of a church
CREATE OR REPLACE FUNCTION public.is_church_follower(p_church_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_followers
    WHERE church_id = p_church_id
    AND user_id = p_user_id
    AND status = 'accepted'
  );
$$;

-- Function to get church follower status
CREATE OR REPLACE FUNCTION public.get_church_follower_status(p_church_id bigint, p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT status
     FROM public.church_followers
     WHERE church_id = p_church_id
     AND user_id = p_user_id
     LIMIT 1),
    'none'
  );
$$;

-- Function to get follower count for a church
CREATE OR REPLACE FUNCTION public.get_church_follower_count(p_church_id bigint)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.church_followers
  WHERE church_id = p_church_id
  AND status = 'accepted';
$$;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample church-missionary relationships
-- INSERT INTO public.church_missionaries (church_id, missionary_id, relationship_type)
-- SELECT 1, id, 'supporting' FROM public.missionaries LIMIT 5
-- ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.church_followers IS 'Tracks follow requests and follower relationships between users and churches. Implements the follow system with pending/accepted/rejected states.';
COMMENT ON TABLE public.church_missionaries IS 'Links churches to missionaries they support. Used for the restricted "Our Missionaries" tab on church public pages.';
COMMENT ON FUNCTION public.is_church_follower IS 'Returns true if the user is an accepted follower of the church. Used for access control.';
COMMENT ON FUNCTION public.get_church_follower_status IS 'Returns the follow status: none, pending, accepted, rejected, or blocked.';

