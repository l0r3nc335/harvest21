-- Update is_missionary_follower to also consider missionary_missionary_followers
-- This allows missionaries to send DMs to other missionaries when they are accepted followers
-- (regardless of user type: supporter, missionary, etc. - as long as they are an accepted follower)
CREATE OR REPLACE FUNCTION public.is_missionary_follower(
    p_missionary_id BIGINT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check 1: User follows missionary via missionary_followers (supporters, or any user)
    IF EXISTS (
        SELECT 1
        FROM missionary_followers
        WHERE missionary_id = p_missionary_id
        AND user_id = p_user_id
        AND status = 'accepted'
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check 2: User is a missionary who follows this missionary via missionary_missionary_followers
    IF EXISTS (
        SELECT 1
        FROM missionary_missionary_followers mmf
        JOIN missionaries m ON m.id = mmf.follower_missionary_id AND m.user_id = p_user_id
        WHERE mmf.followed_missionary_id = p_missionary_id
        AND mmf.status = 'accepted'
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
