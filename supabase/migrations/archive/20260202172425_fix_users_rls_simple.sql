-- Simple RLS policy for users table to allow viewing basic profile info
-- For messaging system, users need to see names of people they're chatting with

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view conversation partners" ON public.users;
DROP POLICY IF EXISTS "Admins and Staff can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins and Staff can update all users" ON public.users;
DROP POLICY IF EXISTS "Create Admin" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert own user record" ON public.users;

-- Create simple policy: All authenticated users can view basic profile info
CREATE POLICY "Authenticated users can view profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Admin can update all users
CREATE POLICY "Admins can update all users" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.users WHERE role IN (1, 2)
  )
);

-- Allow user creation for admins and signup
CREATE POLICY "Allow user creation" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR 
  auth.uid() IN (
    SELECT user_id FROM public.users WHERE role IN (1, 2)
  )
);

