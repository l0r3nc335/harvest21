-- Add state column to churches table
-- This allows churches to store their state/province information

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'churches' 
                 AND column_name = 'state') THEN
    ALTER TABLE public.churches ADD COLUMN state character varying;
  END IF;
END $$;
