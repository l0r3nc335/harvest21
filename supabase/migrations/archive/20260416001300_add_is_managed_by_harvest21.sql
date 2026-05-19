ALTER TABLE public.missionaries ADD COLUMN IF NOT EXISTS is_managed_by_harvest21 BOOLEAN DEFAULT false;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS is_managed_by_harvest21 BOOLEAN DEFAULT false;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS is_managed_by_harvest21 BOOLEAN DEFAULT false;
