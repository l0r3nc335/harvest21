-- Fix RLS policy for users table to allow fetching user info for messaging
-- This allows authenticated users to view basic profile info of other users they're in conversation with

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only view their own data" ON public.users;

-- Create new policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = user_id);

-- Create new policy: Authenticated users can view basic info of users in their conversations
CREATE POLICY "Users can view conversation partners"
ON public.users
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Can view own profile
    auth.uid() = user_id
    OR
    -- Can view users they have conversations with
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.conversation_members cm2
        WHERE cm2.conversation_id = cm.conversation_id
        AND cm2.user_id = public.users.user_id
      )
    )
  )
);

