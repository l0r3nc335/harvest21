-- Add 'unfollowed' status to missionary_followers table
ALTER TABLE public.missionary_followers
DROP CONSTRAINT IF EXISTS missionary_followers_status_check;

ALTER TABLE public.missionary_followers
ADD CONSTRAINT missionary_followers_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'unfollowed'));

-- Add 'unfollowed' status to church_followers table
ALTER TABLE public.church_followers
DROP CONSTRAINT IF EXISTS church_followers_status_check;

ALTER TABLE public.church_followers
ADD CONSTRAINT church_followers_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'unfollowed'));

-- Add unfollowed_at timestamp column for tracking when user unfollowed
ALTER TABLE public.missionary_followers
ADD COLUMN IF NOT EXISTS unfollowed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.church_followers
ADD COLUMN IF NOT EXISTS unfollowed_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_missionary_followers_unfollowed 
ON public.missionary_followers(missionary_id, status) 
WHERE status != 'unfollowed';

CREATE INDEX IF NOT EXISTS idx_church_followers_unfollowed 
ON public.church_followers(church_id, status) 
WHERE status != 'unfollowed';

