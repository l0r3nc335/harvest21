-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.missionary_followers CASCADE;
DROP TABLE IF EXISTS public.church_followers CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Missionary followers table with approval workflow
CREATE TABLE public.missionary_followers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT missionary_followers_unique UNIQUE (missionary_id, user_id)
);

-- Church followers table with approval workflow
CREATE TABLE public.church_followers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    church_id BIGINT NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT church_followers_unique UNIQUE (church_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_missionary_followers_missionary ON public.missionary_followers(missionary_id);
CREATE INDEX idx_missionary_followers_user ON public.missionary_followers(user_id);
CREATE INDEX idx_missionary_followers_status ON public.missionary_followers(status);
CREATE INDEX idx_missionary_followers_created ON public.missionary_followers(created_at);

CREATE INDEX idx_church_followers_church ON public.church_followers(church_id);
CREATE INDEX idx_church_followers_user ON public.church_followers(user_id);
CREATE INDEX idx_church_followers_status ON public.church_followers(status);
CREATE INDEX idx_church_followers_created ON public.church_followers(created_at);

-- Enable RLS
ALTER TABLE public.missionary_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for missionary_followers
CREATE POLICY "Anyone can view followers"
    ON public.missionary_followers
    FOR SELECT
    USING (true);

CREATE POLICY "Users can create follow requests"
    ON public.missionary_followers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own pending requests"
    ON public.missionary_followers
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Missionary owners and admins can update follower status"
    ON public.missionary_followers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM missionaries m
            WHERE m.id = missionary_id 
            AND m.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.user_id = auth.uid()
            AND u.role IN (1, 2)
        )
    );

-- RLS Policies for church_followers
CREATE POLICY "Anyone can view church followers"
    ON public.church_followers
    FOR SELECT
    USING (true);

CREATE POLICY "Users can create church follow requests"
    ON public.church_followers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own pending church requests"
    ON public.church_followers
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Church owners and admins can update follower status"
    ON public.church_followers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM churches c
            WHERE c.id = church_id 
            AND c.contact_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.user_id = auth.uid()
            AND u.role IN (1, 2)
        )
    );

-- Helper functions for missionaries
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
    RETURN EXISTS (
        SELECT 1
        FROM missionary_followers
        WHERE missionary_id = p_missionary_id
        AND user_id = p_user_id
        AND status = 'accepted'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_missionary_follower_status(
    p_missionary_id BIGINT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status
    INTO v_status
    FROM missionary_followers
    WHERE missionary_id = p_missionary_id
    AND user_id = p_user_id;
    
    RETURN COALESCE(v_status, 'none');
END;
$$;

-- Helper functions for churches
CREATE OR REPLACE FUNCTION public.is_church_follower(
    p_church_id BIGINT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM church_followers
        WHERE church_id = p_church_id
        AND user_id = p_user_id
        AND status = 'accepted'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_church_follower_status(
    p_church_id BIGINT,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status
    INTO v_status
    FROM church_followers
    WHERE church_id = p_church_id
    AND user_id = p_user_id;
    
    RETURN COALESCE(v_status, 'none');
END;
$$;

-- Notifications table
CREATE TABLE public.notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id BIGINT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_created ON public.notifications(created_at);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.missionary_followers TO authenticated;
GRANT UPDATE ON public.missionary_followers TO authenticated;
GRANT USAGE ON SEQUENCE missionary_followers_id_seq TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.church_followers TO authenticated;
GRANT UPDATE ON public.church_followers TO authenticated;
GRANT USAGE ON SEQUENCE church_followers_id_seq TO authenticated;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;
GRANT USAGE ON SEQUENCE notifications_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_missionary_follower TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_missionary_follower_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_church_follower TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_church_follower_status TO authenticated;


