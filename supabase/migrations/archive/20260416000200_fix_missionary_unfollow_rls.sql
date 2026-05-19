-- Fix RLS policy to allow users to unfollow missionaries they're currently following
-- The existing policy only allows canceling pending requests, not unfollowing accepted relationships

-- Drop policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can unfollow missionaries they follow" ON public.missionary_followers;
DROP POLICY IF EXISTS "Users can unfollow churches they follow" ON public.church_followers;

-- Add policy to allow users to delete their own accepted follow relationships (unfollow)
CREATE POLICY "Users can unfollow missionaries they follow"
    ON public.missionary_followers
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'accepted');

-- Also ensure church followers has the same capability
CREATE POLICY "Users can unfollow churches they follow"
    ON public.church_followers
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'accepted');

