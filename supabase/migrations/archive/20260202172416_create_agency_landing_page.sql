-- ============================================================================
-- Mission Agency Landing Page Migration
-- Based on MA-LP requirements (Mission Agency Landing Page)
-- ============================================================================

-- Note: The 'agencies' table already exists in the schema
-- Note: The 'pages' table already supports organization_type = 'agency'
-- Note: The 'missionaries' table already has agency_id column for direct relationship
-- This migration adds missing columns to pages table for agency landing pages

-- ============================================================================
-- Add missing columns to pages table for agencies
-- ============================================================================

-- Add columns if they don't exist (matching church implementation)
DO $$ 
BEGIN
  -- Add name column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pages' 
                 AND column_name = 'name') THEN
    ALTER TABLE public.pages ADD COLUMN name text;
  END IF;

  -- Add template_content column if it doesn't exist (for 7 fixed sections)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pages' 
                 AND column_name = 'template_content') THEN
    ALTER TABLE public.pages ADD COLUMN template_content text;
  END IF;

  -- Add video_hashed_id column if it doesn't exist (for background video)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pages' 
                 AND column_name = 'video_hashed_id') THEN
    ALTER TABLE public.pages ADD COLUMN video_hashed_id text;
  END IF;

  -- Add donation_percentage column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pages' 
                 AND column_name = 'donation_percentage') THEN
    ALTER TABLE public.pages ADD COLUMN donation_percentage numeric;
  END IF;
END $$;

-- ============================================================================
-- Add index for agency missionaries lookup
-- ============================================================================

-- Index on missionaries.agency_id for efficient queries
CREATE INDEX IF NOT EXISTS missionaries_agency_id_idx 
  ON public.missionaries(agency_id) 
  WHERE agency_id IS NOT NULL;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if user is agency owner
CREATE OR REPLACE FUNCTION public.is_agency_owner(agency_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.agencies
    WHERE agencies.id = $1
    AND agencies.contact_user_id = auth.uid()
  );
END;
$$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION public.is_agency_owner IS 'Helper function to check if current user owns an agency';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Key differences from churches (MA-LP requirements):
-- 1. No follow system - agencies are publicly accessible
-- 2. No follower approval workflow
-- 3. Missionaries tab is publicly accessible for all visitors (MA-LP-015)
-- 4. Missionaries are linked directly via missionaries.agency_id (existing column)
-- 5. Uses same pages table structure as churches with 7 fixed About Us sections

