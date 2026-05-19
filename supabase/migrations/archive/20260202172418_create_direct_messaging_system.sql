-- Direct Messaging System for Missionaries
-- Real-time enabled for conversations and messages
-- Supports: DM-001 through DM-011 requirements

-- ============================================
-- TABLES
-- ============================================

-- Conversations table
CREATE TABLE public.conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    missionary_id BIGINT NOT NULL REFERENCES public.missionaries(id) ON DELETE CASCADE,
    supporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    last_message_sender_id UUID,
    CONSTRAINT conversations_unique_pair UNIQUE (missionary_id, supporter_id)
);

-- Conversation members (for easy access control and unread tracking)
CREATE TABLE public.conversation_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT conversation_members_unique UNIQUE (conversation_id, user_id)
);

-- Messages table
CREATE TABLE public.messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message reports table (DM-011)
CREATE TABLE public.message_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES public.conversations(id),
    message_id BIGINT REFERENCES public.messages(id),
    reported_by UUID NOT NULL REFERENCES auth.users(id),
    report_type TEXT NOT NULL CHECK (report_type IN ('message', 'conversation')),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add DM settings to missionaries table (DM-009)
ALTER TABLE public.missionaries 
ADD COLUMN IF NOT EXISTS allow_direct_messages BOOLEAN DEFAULT TRUE;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_conversations_missionary ON public.conversations(missionary_id);
CREATE INDEX idx_conversations_supporter ON public.conversations(supporter_id);
CREATE INDEX idx_conversations_updated ON public.conversations(last_message_at DESC);

CREATE INDEX idx_conversation_members_conversation ON public.conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_unread ON public.conversation_members(user_id, unread_count) WHERE unread_count > 0;

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

CREATE INDEX idx_message_reports_status ON public.message_reports(status) WHERE status = 'pending';
CREATE INDEX idx_message_reports_reported_by ON public.message_reports(reported_by);

-- ============================================
-- TRIGGERS FOR REALTIME UPDATES
-- ============================================

-- Update conversation timestamp when message is sent
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET 
        updated_at = NOW(),
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        last_message_sender_id = NEW.sender_id
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- Increment unread count for recipient (DM-007)
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversation_members
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_unread_count
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION increment_unread_count();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- Conversations: Only members can view
CREATE POLICY "Users can view their own conversations"
    ON public.conversations
    FOR SELECT
    USING (
        auth.uid() = supporter_id
        OR auth.uid() IN (
            SELECT user_id FROM missionaries WHERE id = missionary_id
        )
    );

-- Conversations: Only accepted followers can create (DM-002)
CREATE POLICY "Accepted followers can create conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (
        auth.uid() = supporter_id
        AND public.is_missionary_follower(missionary_id, auth.uid())
        AND (
            SELECT allow_direct_messages 
            FROM missionaries 
            WHERE id = missionary_id
        ) = TRUE
    );

-- Conversations: Members can update
CREATE POLICY "Members can update conversations"
    ON public.conversations
    FOR UPDATE
    USING (
        auth.uid() = supporter_id
        OR auth.uid() IN (
            SELECT user_id FROM missionaries WHERE id = missionary_id
        )
    );

-- Conversation Members: Can view own memberships
CREATE POLICY "Users can view their own memberships"
    ON public.conversation_members
    FOR SELECT
    USING (auth.uid() = user_id);

-- Conversation Members: System can insert
CREATE POLICY "System can create memberships"
    ON public.conversation_members
    FOR INSERT
    WITH CHECK (true);

-- Conversation Members: Can update own membership
CREATE POLICY "Users can update own membership"
    ON public.conversation_members
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Messages: Members can view conversation messages
CREATE POLICY "Members can view conversation messages"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Messages: Members can send messages (DM-004, DM-005)
CREATE POLICY "Members can send messages"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM conversations c
            JOIN missionaries m ON c.missionary_id = m.id
            WHERE c.id = messages.conversation_id
            AND m.allow_direct_messages = TRUE
        )
    );

-- Message Reports: Anyone can report (DM-011)
CREATE POLICY "Users can report messages"
    ON public.message_reports
    FOR INSERT
    WITH CHECK (auth.uid() = reported_by);

-- Message Reports: Admins can view all
CREATE POLICY "Admins can view all reports"
    ON public.message_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE user_id = auth.uid()
            AND role IN (1, 2)
        )
    );

-- Message Reports: Admins can update
CREATE POLICY "Admins can update reports"
    ON public.message_reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE user_id = auth.uid()
            AND role IN (1, 2)
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user can send DM to missionary
CREATE OR REPLACE FUNCTION public.can_send_direct_message(
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
        FROM missionaries m
        WHERE m.id = p_missionary_id
        AND m.allow_direct_messages = TRUE
        AND public.is_missionary_follower(p_missionary_id, p_user_id)
    );
END;
$$;

-- Get conversation between user and missionary
CREATE OR REPLACE FUNCTION public.get_conversation_id(
    p_missionary_id BIGINT,
    p_supporter_id UUID DEFAULT auth.uid()
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation_id BIGINT;
BEGIN
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE missionary_id = p_missionary_id
    AND supporter_id = p_supporter_id;
    
    RETURN v_conversation_id;
END;
$$;

-- Get total unread message count for user
CREATE OR REPLACE FUNCTION public.get_total_unread_messages(
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(unread_count), 0)
    INTO v_count
    FROM conversation_members
    WHERE user_id = p_user_id;
    
    RETURN v_count;
END;
$$;

-- ============================================
-- GRANTS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT USAGE ON SEQUENCE conversations_id_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.conversation_members TO authenticated;
GRANT USAGE ON SEQUENCE conversation_members_id_seq TO authenticated;

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT USAGE ON SEQUENCE messages_id_seq TO authenticated;

GRANT SELECT, INSERT ON public.message_reports TO authenticated;
GRANT UPDATE ON public.message_reports TO authenticated;
GRANT USAGE ON SEQUENCE message_reports_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_send_direct_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_unread_messages TO authenticated;

-- Enable Realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

