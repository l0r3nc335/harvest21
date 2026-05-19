-- Add open_to_visits field to missionaries table
ALTER TABLE public.missionaries
ADD COLUMN IF NOT EXISTS open_to_visits BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_missionaries_open_to_visits 
ON public.missionaries(open_to_visits);

-- Add comment for documentation
COMMENT ON COLUMN public.missionaries.open_to_visits IS 'Indicates if the missionary is open to visits from supporters';

