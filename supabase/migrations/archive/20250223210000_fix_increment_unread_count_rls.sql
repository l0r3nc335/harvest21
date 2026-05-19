-- Fix: increment_unread_count trigger blocked by RLS
-- Trigger runs as sender's session; RLS prevents updating recipient's row.
-- SECURITY DEFINER lets the function run with owner privileges and bypass RLS.
-- Guard: skip if messaging tables don't exist yet (applied before create_direct_messaging_system).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trigger_increment_unread_count ON public.messages;

  CREATE OR REPLACE FUNCTION public.increment_unread_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    UPDATE public.conversation_members
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
      AND user_id != NEW.sender_id;
    RETURN NEW;
  END;
  $fn$;

  CREATE TRIGGER trigger_increment_unread_count
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_unread_count();
END $$;
