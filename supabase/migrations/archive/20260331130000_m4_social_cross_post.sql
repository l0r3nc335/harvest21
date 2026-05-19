ALTER TABLE public.missionary_content_publications
  DROP CONSTRAINT IF EXISTS missionary_content_publications_content_type_check;

ALTER TABLE public.missionary_content_publications
  ADD CONSTRAINT missionary_content_publications_content_type_check
  CHECK (content_type IN ('update_letter', 'prayer', 'photo', 'video', 'text_update'));

CREATE TABLE public.missionary_social_connections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  missionary_id BIGINT NOT NULL UNIQUE REFERENCES public.missionaries(id) ON DELETE CASCADE,
  facebook_page_id TEXT,
  facebook_page_name TEXT,
  instagram_business_account_id TEXT,
  instagram_username TEXT,
  encrypted_token_bundle TEXT,
  token_expires_at TIMESTAMPTZ,
  facebook_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (facebook_status IN ('not_connected', 'connected', 'reconnect_required')),
  instagram_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (instagram_status IN ('not_connected', 'connected', 'reconnect_required')),
  last_facebook_verified_at TIMESTAMPTZ,
  last_instagram_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.social_cross_post_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id BIGINT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'posted', 'failed')),
  external_post_id TEXT,
  error_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id, platform)
);

CREATE INDEX idx_social_cross_post_missionary_created
  ON public.social_cross_post_attempts (missionary_id, created_at DESC);

CREATE TABLE public.meta_oauth_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('facebook', 'instagram')),
  encrypted_payload TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meta_oauth_pending_expires ON public.meta_oauth_pending (expires_at);

CREATE TABLE public.meta_oauth_states (
  state_token TEXT PRIMARY KEY,
  missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('facebook', 'instagram')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meta_oauth_states_expires ON public.meta_oauth_states (expires_at);

ALTER TABLE public.missionary_social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_cross_post_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_oauth_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Missionary reads own cross post attempts"
  ON public.social_cross_post_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missionaries m
      WHERE m.id = social_cross_post_attempts.missionary_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Missionary reads own oauth pending"
  ON public.meta_oauth_pending
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Missionary reads own oauth states"
  ON public.meta_oauth_states
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.social_cross_post_attempts TO authenticated;
GRANT SELECT ON public.meta_oauth_pending TO authenticated;
GRANT SELECT ON public.meta_oauth_states TO authenticated;
