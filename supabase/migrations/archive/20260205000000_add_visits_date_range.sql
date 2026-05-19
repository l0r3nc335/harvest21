ALTER TABLE public.missionaries
ADD COLUMN IF NOT EXISTS visits_start_date date NULL,
ADD COLUMN IF NOT EXISTS visits_end_date date NULL;

ALTER TABLE public.missionaries
ADD CONSTRAINT chk_visits_date_range
CHECK (
  (visits_start_date IS NULL AND visits_end_date IS NULL)
  OR (visits_start_date IS NOT NULL AND visits_end_date IS NOT NULL AND visits_end_date >= visits_start_date)
);

CREATE INDEX IF NOT EXISTS idx_missionaries_open_to_visits_dates
ON public.missionaries(open_to_visits, visits_start_date)
WHERE open_to_visits = true;

COMMENT ON COLUMN public.missionaries.visits_start_date IS 'First day open to in-person visits (when open_to_visits is true)';
COMMENT ON COLUMN public.missionaries.visits_end_date IS 'Last day open to in-person visits (when open_to_visits is true)';
