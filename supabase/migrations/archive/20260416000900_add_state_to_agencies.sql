-- Add state column to agencies table
-- This allows agencies to store their state/province information

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'agencies' 
                 AND column_name = 'state') THEN
    ALTER TABLE public.agencies ADD COLUMN state character varying;
  END IF;
END $$;
