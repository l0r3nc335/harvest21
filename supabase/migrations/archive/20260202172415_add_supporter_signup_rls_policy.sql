-- ============================================================================
-- RLS POLICY: Allow Supporter Self-Registration
-- Allows authenticated users to create their own user record during sign-up
-- ============================================================================

-- Add INSERT policy for users table to allow supporter sign-up
CREATE POLICY "Allow authenticated users to insert own user record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 4  -- Only allow supporter role (4) during self-registration
);

-- Note: This policy allows newly authenticated users to create their own
-- record in the users table during the sign-up process, but only with
-- role 4 (SUPPORTER). Admin-created accounts will use service role bypass.

 