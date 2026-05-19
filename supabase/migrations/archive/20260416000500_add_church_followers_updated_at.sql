-- Add updated_at column to church_followers if it doesn't exist
-- This ensures consistency across different migration paths

ALTER TABLE public.church_followers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_church_followers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS set_church_followers_updated_at ON public.church_followers;
CREATE TRIGGER set_church_followers_updated_at
    BEFORE UPDATE ON public.church_followers
    FOR EACH ROW
    EXECUTE FUNCTION update_church_followers_updated_at();
