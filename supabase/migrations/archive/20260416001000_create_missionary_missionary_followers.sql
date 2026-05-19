-- Create missionary_missionary_followers table for missionary-to-missionary following
CREATE TABLE IF NOT EXISTS public.missionary_missionary_followers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  follower_missionary_id bigint NOT NULL,
  followed_missionary_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'unfollowed'::text])),
  requested_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  unfollowed_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT missionary_missionary_followers_pkey PRIMARY KEY (id),
  CONSTRAINT missionary_missionary_followers_follower_fkey FOREIGN KEY (follower_missionary_id) REFERENCES public.missionaries(id) ON DELETE CASCADE,
  CONSTRAINT missionary_missionary_followers_followed_fkey FOREIGN KEY (followed_missionary_id) REFERENCES public.missionaries(id) ON DELETE CASCADE,
  CONSTRAINT missionary_missionary_followers_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT missionary_missionary_followers_unique UNIQUE (follower_missionary_id, followed_missionary_id)
);

CREATE INDEX IF NOT EXISTS idx_missionary_missionary_followers_follower ON public.missionary_missionary_followers(follower_missionary_id);
CREATE INDEX IF NOT EXISTS idx_missionary_missionary_followers_followed ON public.missionary_missionary_followers(followed_missionary_id);
CREATE INDEX IF NOT EXISTS idx_missionary_missionary_followers_status ON public.missionary_missionary_followers(status);

ALTER TABLE public.missionary_missionary_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missionary following records"
  ON public.missionary_missionary_followers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = follower_missionary_id
      AND m.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = followed_missionary_id
      AND m.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
      AND u.role IN (1, 2)
    )
  );

CREATE POLICY "Missionaries can create follow requests"
  ON public.missionary_missionary_followers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = follower_missionary_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Missionaries can update their own follow requests"
  ON public.missionary_missionary_followers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = follower_missionary_id
      AND m.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = followed_missionary_id
      AND m.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
      AND u.role IN (1, 2)
    )
  );

CREATE POLICY "Missionaries can delete their own follow requests"
  ON public.missionary_missionary_followers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = follower_missionary_id
      AND m.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
      AND u.role IN (1, 2)
    )
  );

COMMENT ON TABLE public.missionary_missionary_followers IS 'Tracks missionary-to-missionary following relationships';
COMMENT ON COLUMN public.missionary_missionary_followers.follower_missionary_id IS 'The missionary who is following';
COMMENT ON COLUMN public.missionary_missionary_followers.followed_missionary_id IS 'The missionary being followed';
COMMENT ON COLUMN public.missionary_missionary_followers.status IS 'Status of the follow request: pending, accepted, rejected, or unfollowed';
