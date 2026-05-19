-- Add audit fields to footer_content table
ALTER TABLE public.footer_content 
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_footer_content_updated_by 
ON public.footer_content(updated_by);

-- Update RLS policies to allow admins to update
-- (Existing policies should already cover this, but let's be explicit)

