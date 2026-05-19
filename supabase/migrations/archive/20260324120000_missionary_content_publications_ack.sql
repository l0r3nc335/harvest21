CREATE TABLE public.missionary_content_publications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
    page_id BIGINT NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('update_letter', 'prayer', 'photo', 'video')),
    source_table TEXT,
    source_id BIGINT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_missionary_published ON public.missionary_content_publications (missionary_id, published_at DESC);

CREATE TABLE public.missionary_follower_content_ack (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
    last_acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, missionary_id)
);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS content_metadata JSONB;

ALTER TABLE public.missionary_content_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missionary_follower_content_ack ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own missionary content ack"
    ON public.missionary_follower_content_ack
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.missionary_follower_content_ack TO authenticated;
