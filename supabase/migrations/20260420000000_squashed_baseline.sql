


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."bump_amen_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.prayers set amen_count = amen_count + 1, updated_at = now()
    where id = new.prayer_id;
  elsif tg_op = 'DELETE' then
    update public.prayers set amen_count = greatest(amen_count - 1,0), updated_at = now()
    where id = old.prayer_id;
  end if;
  return null;
end$$;


ALTER FUNCTION "public"."bump_amen_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_update_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.prayers set update_count = update_count + 1, updated_at = now()
    where id = new.prayer_id;
  elsif tg_op = 'DELETE' then
    update public.prayers set update_count = greatest(update_count - 1,0), updated_at = now()
    where id = old.prayer_id;
  end if;
  return null;
end$$;


ALTER FUNCTION "public"."bump_update_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_resend_follow_request"("p_missionary_id" bigint, "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT CASE
    -- No existing request - can send
    WHEN NOT EXISTS (
      SELECT 1 FROM public.missionary_followers
      WHERE missionary_id = p_missionary_id AND user_id = p_user_id
    ) THEN true
    -- Blocked - cannot send
    WHEN EXISTS (
      SELECT 1 FROM public.missionary_followers
      WHERE missionary_id = p_missionary_id 
      AND user_id = p_user_id 
      AND status = 'blocked'
    ) THEN false
    -- Pending - cannot resend
    WHEN EXISTS (
      SELECT 1 FROM public.missionary_followers
      WHERE missionary_id = p_missionary_id 
      AND user_id = p_user_id 
      AND status = 'pending'
    ) THEN false
    -- Rejected - can resend after 24 hours
    WHEN EXISTS (
      SELECT 1 FROM public.missionary_followers
      WHERE missionary_id = p_missionary_id 
      AND user_id = p_user_id 
      AND status = 'rejected'
      AND (last_rejected_at IS NULL OR last_rejected_at < now() - interval '24 hours')
    ) THEN true
    ELSE false
  END;
$$;


ALTER FUNCTION "public"."can_resend_follow_request"("p_missionary_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_resend_follow_request"("p_missionary_id" bigint, "p_user_id" "uuid") IS 'Implements the 24-hour resend rule for rejected follow requests. Prevents spam while allowing legitimate re-requests.';



CREATE OR REPLACE FUNCTION "public"."can_send_direct_message"("p_missionary_id" bigint, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."can_send_direct_message"("p_missionary_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_church_follower_status"("p_church_id" bigint, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_church_follower_status"("p_church_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_id"("p_missionary_id" bigint, "p_supporter_id" "uuid" DEFAULT "auth"."uid"()) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_conversation_id"("p_missionary_id" bigint, "p_supporter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_missionary_follower_count"("p_missionary_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM missionary_followers
    WHERE missionary_id = p_missionary_id;
    
    RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_missionary_follower_count"("p_missionary_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_missionary_follower_status"("p_missionary_id" bigint, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_missionary_follower_status"("p_missionary_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_missionary_follower_status"("p_missionary_id" bigint, "p_user_id" "uuid") IS 'Returns the follow status: none, pending, accepted, rejected, or blocked. Used for UI state synchronization.';



CREATE OR REPLACE FUNCTION "public"."get_total_unread_messages"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_total_unread_messages"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$declare
  provider text;
begin


  return new;
end;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_unread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.conversation_members
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = auth.uid()
    AND role = 1
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_church_follower"("p_church_id" bigint, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_church_follower"("p_church_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_missionary_follower"("p_missionary_id" bigint, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Check 1: User follows via missionary_followers
    IF EXISTS (
        SELECT 1 FROM missionary_followers
        WHERE missionary_id = p_missionary_id AND user_id = p_user_id AND status = 'accepted'
    ) THEN RETURN TRUE; END IF;

    -- Check 2: Missionary follows via missionary_missionary_followers
    IF EXISTS (
        SELECT 1 FROM missionary_missionary_followers mmf
        JOIN missionaries m ON m.id = mmf.follower_missionary_id AND m.user_id = p_user_id
        WHERE mmf.followed_missionary_id = p_missionary_id AND mmf.status = 'accepted'
    ) THEN RETURN TRUE; END IF;

    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."is_missionary_follower"("p_missionary_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_missionary_follower"("p_missionary_id" bigint, "p_user_id" "uuid") IS 'Returns true if the user is an accepted follower of the missionary. Used for access control to restricted content (Photos, Videos, Prayer Wall).';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_church_followers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_church_followers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_conversation_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_supporter_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_supporter_profiles_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."affiliated_churches" (
    "id" bigint NOT NULL,
    "missionary_id" bigint NOT NULL,
    "church_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."affiliated_churches" OWNER TO "postgres";


ALTER TABLE "public"."affiliated_churches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."affiliated_churches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."agencies" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" character varying NOT NULL,
    "contact_user_id" "uuid",
    "email" "text",
    "phone_number" character varying,
    "address" "text",
    "city" character varying,
    "country" character varying,
    "website" "text",
    "state" character varying,
    "contact_person_phone_number" "text",
    "is_managed_by_harvest21" boolean DEFAULT false
);


ALTER TABLE "public"."agencies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agencies"."contact_person_phone_number" IS 'Phone number of the contact person (separate from agency main phone)';



ALTER TABLE "public"."agencies" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."agencies_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."church_followers" (
    "id" bigint NOT NULL,
    "church_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unfollowed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    CONSTRAINT "church_followers_note_check" CHECK (("char_length"("note") <= 100)),
    CONSTRAINT "church_followers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'unfollowed'::"text"])))
);


ALTER TABLE "public"."church_followers" OWNER TO "postgres";


ALTER TABLE "public"."church_followers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."church_followers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."churches" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" character varying NOT NULL,
    "contact_user_id" "uuid",
    "phone_number" character varying,
    "address" "text",
    "city" character varying,
    "country" character varying,
    "website" "text",
    "state" character varying,
    "contact_person_phone_number" "text",
    "is_managed_by_harvest21" boolean DEFAULT false
);


ALTER TABLE "public"."churches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."churches"."contact_person_phone_number" IS 'Phone number of the contact person (separate from church main phone)';



ALTER TABLE "public"."churches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."churches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."colleges" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" character varying NOT NULL,
    "contact_user_id" "uuid",
    "email" "text",
    "phone_number" character varying,
    "address" "text",
    "city" character varying,
    "country" character varying,
    "website" "text"
);


ALTER TABLE "public"."colleges" OWNER TO "postgres";


ALTER TABLE "public"."colleges" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."colleges_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."conversation_members" (
    "id" bigint NOT NULL,
    "conversation_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "unread_count" integer DEFAULT 0,
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_members" OWNER TO "postgres";


ALTER TABLE "public"."conversation_members" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."conversation_members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" bigint NOT NULL,
    "missionary_id" bigint NOT NULL,
    "supporter_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "last_message_preview" "text",
    "last_message_sender_id" "uuid"
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


ALTER TABLE "public"."conversations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."conversations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."donation_receipts" (
    "id" bigint NOT NULL,
    "page_donation_id" bigint NOT NULL,
    "donor_id" bigint,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "receipt_number" "text" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "delivery_status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "donation_receipts_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."donation_receipts" OWNER TO "postgres";


ALTER TABLE "public"."donation_receipts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."donation_receipts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."donors" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "phone_number" "text",
    "country" "text",
    "city" "text",
    "address" "text",
    "postal_code" "text",
    "organization_name" "text",
    "donation_preference" "text",
    "total_donated" numeric(12,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_customer_id" "text"
);


ALTER TABLE "public"."donors" OWNER TO "postgres";


ALTER TABLE "public"."donors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."donors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."footer_content" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "page_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "footer_content_page_type_check" CHECK (("page_type" = ANY (ARRAY['about_us'::"text", 'statement_of_faith'::"text", 'donate'::"text", 'faq'::"text", 'contact_us'::"text", 'privacy_policy'::"text", 'terms_of_use'::"text"])))
);


ALTER TABLE "public"."footer_content" OWNER TO "postgres";


ALTER TABLE "public"."footer_content" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."footer_content_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."homepage_banners" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "banner_type" "text" DEFAULT 'carousel'::"text",
    "is_active" boolean DEFAULT true,
    "display_order" integer NOT NULL,
    "location" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "scroll_duration" integer DEFAULT 5000,
    CONSTRAINT "homepage_banners_banner_type_check" CHECK (("banner_type" = ANY (ARRAY['carousel'::"text", 'static'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."homepage_banners" OWNER TO "postgres";


ALTER TABLE "public"."homepage_banners" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."homepage_banners_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."homepage_featured_sections" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."homepage_featured_sections" OWNER TO "postgres";


ALTER TABLE "public"."homepage_featured_sections" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."homepage_featured_sections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."homepage_section_profiles" (
    "id" bigint NOT NULL,
    "section_id" bigint NOT NULL,
    "profile_id" bigint NOT NULL,
    "profile_type" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "homepage_section_profiles_profile_type_check" CHECK (("profile_type" = ANY (ARRAY['missionary'::"text", 'church'::"text", 'agency'::"text"])))
);


ALTER TABLE "public"."homepage_section_profiles" OWNER TO "postgres";


ALTER TABLE "public"."homepage_section_profiles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."homepage_section_profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."homepage_settings" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "banner_type" "text" DEFAULT 'carousel'::"text",
    "auto_scroll" boolean DEFAULT true,
    "scroll_timing" integer DEFAULT 5000,
    "show_navigation_arrows" boolean DEFAULT true,
    "show_pagination_dots" boolean DEFAULT true,
    CONSTRAINT "homepage_settings_banner_type_check" CHECK (("banner_type" = ANY (ARRAY['carousel'::"text", 'static'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."homepage_settings" OWNER TO "postgres";


ALTER TABLE "public"."homepage_settings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."homepage_settings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."message_reports" (
    "id" bigint NOT NULL,
    "conversation_id" bigint NOT NULL,
    "message_id" bigint,
    "reported_by" "uuid" NOT NULL,
    "report_type" "text" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['message'::"text", 'conversation'::"text"]))),
    CONSTRAINT "message_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."message_reports" OWNER TO "postgres";


ALTER TABLE "public"."message_reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."message_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" bigint NOT NULL,
    "conversation_id" bigint NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_content_check" CHECK ((("char_length"("content") > 0) AND ("char_length"("content") <= 5000)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


ALTER TABLE "public"."messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."meta_oauth_pending" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "missionary_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "intent" "text" NOT NULL,
    "encrypted_payload" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meta_oauth_pending_intent_check" CHECK (("intent" = ANY (ARRAY['facebook'::"text", 'instagram'::"text"])))
);


ALTER TABLE "public"."meta_oauth_pending" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meta_oauth_states" (
    "state_token" "text" NOT NULL,
    "missionary_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "intent" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meta_oauth_states_intent_check" CHECK (("intent" = ANY (ARRAY['facebook'::"text", 'instagram'::"text"])))
);


ALTER TABLE "public"."meta_oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missionaries" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" character varying NOT NULL,
    "last_name" character varying NOT NULL,
    "email" "text",
    "phone_number" character varying,
    "country_of_residence" character varying,
    "destination_country" character varying,
    "mission_status" character varying,
    "open_to_visits" boolean DEFAULT false,
    "user_id" "uuid",
    "agency_id" bigint,
    "sending_church_id" bigint,
    "mission_field_church_id" bigint,
    "college_id" bigint,
    "biography" "text",
    "allow_direct_messages" boolean DEFAULT true,
    "visits_start_date" "date",
    "visits_end_date" "date",
    "stripe_account_id" "text",
    "payout_status" "text" DEFAULT 'not_started'::"text",
    "payout_setup_completed_at" timestamp with time zone,
    "is_managed_by_harvest21" boolean DEFAULT false,
    CONSTRAINT "chk_visits_date_range" CHECK (((("visits_start_date" IS NULL) AND ("visits_end_date" IS NULL)) OR (("visits_start_date" IS NOT NULL) AND ("visits_end_date" IS NOT NULL) AND ("visits_end_date" >= "visits_start_date")))),
    CONSTRAINT "missionaries_mission_status_check" CHECK ((("mission_status")::"text" = ANY (ARRAY[('On-Field'::character varying)::"text", ('Furlough'::character varying)::"text", ('Deputation'::character varying)::"text"]))),
    CONSTRAINT "missionaries_payout_status_check" CHECK (("payout_status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'enabled'::"text", 'restricted'::"text", 'incomplete'::"text"])))
);


ALTER TABLE "public"."missionaries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."missionaries"."open_to_visits" IS 'Indicates if the missionary is open to visits from supporters';



COMMENT ON COLUMN "public"."missionaries"."visits_start_date" IS 'First day open to in-person visits (when open_to_visits is true)';



COMMENT ON COLUMN "public"."missionaries"."visits_end_date" IS 'Last day open to in-person visits (when open_to_visits is true)';



ALTER TABLE "public"."missionaries" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."missionaries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."missionary_churches" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "missionary_id" bigint NOT NULL,
    "church_id" bigint NOT NULL,
    "relationship_type" "text" DEFAULT 'supporting'::"text",
    "is_active" boolean DEFAULT true,
    CONSTRAINT "missionary_churches_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['sending'::"text", 'supporting'::"text", 'partner'::"text"])))
);


ALTER TABLE "public"."missionary_churches" OWNER TO "postgres";


ALTER TABLE "public"."missionary_churches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."missionary_churches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."missionary_content_publications" (
    "id" bigint NOT NULL,
    "missionary_id" bigint NOT NULL,
    "page_id" bigint NOT NULL,
    "content_type" "text" NOT NULL,
    "source_table" "text",
    "source_id" bigint,
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "missionary_content_publications_content_type_check" CHECK (("content_type" = ANY (ARRAY['update_letter'::"text", 'prayer'::"text", 'photo'::"text", 'video'::"text", 'text_update'::"text"])))
);


ALTER TABLE "public"."missionary_content_publications" OWNER TO "postgres";


ALTER TABLE "public"."missionary_content_publications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."missionary_content_publications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."missionary_follower_content_ack" (
    "user_id" "uuid" NOT NULL,
    "missionary_id" bigint NOT NULL,
    "last_acknowledged_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."missionary_follower_content_ack" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missionary_followers" (
    "id" bigint NOT NULL,
    "missionary_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unfollowed_at" timestamp with time zone,
    "note" "text",
    CONSTRAINT "missionary_followers_note_check" CHECK (("char_length"("note") <= 100)),
    CONSTRAINT "missionary_followers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'unfollowed'::"text"])))
);


ALTER TABLE "public"."missionary_followers" OWNER TO "postgres";


ALTER TABLE "public"."missionary_followers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."missionary_followers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."missionary_missionary_followers" (
    "id" bigint NOT NULL,
    "follower_missionary_id" bigint NOT NULL,
    "followed_missionary_id" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unfollowed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    CONSTRAINT "missionary_missionary_followers_note_check" CHECK (("char_length"("note") <= 100)),
    CONSTRAINT "missionary_missionary_followers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'unfollowed'::"text"])))
);


ALTER TABLE "public"."missionary_missionary_followers" OWNER TO "postgres";


COMMENT ON TABLE "public"."missionary_missionary_followers" IS 'Tracks missionary-to-missionary following relationships';



COMMENT ON COLUMN "public"."missionary_missionary_followers"."follower_missionary_id" IS 'The missionary who is following';



COMMENT ON COLUMN "public"."missionary_missionary_followers"."followed_missionary_id" IS 'The missionary being followed';



COMMENT ON COLUMN "public"."missionary_missionary_followers"."status" IS 'Status of the follow request: pending, accepted, rejected, or unfollowed';



ALTER TABLE "public"."missionary_missionary_followers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."missionary_missionary_followers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."missionary_social_connections" (
    "id" bigint NOT NULL,
    "missionary_id" bigint NOT NULL,
    "facebook_page_id" "text",
    "facebook_page_name" "text",
    "instagram_business_account_id" "text",
    "instagram_username" "text",
    "encrypted_token_bundle" "text",
    "token_expires_at" timestamp with time zone,
    "facebook_status" "text" DEFAULT 'not_connected'::"text" NOT NULL,
    "instagram_status" "text" DEFAULT 'not_connected'::"text" NOT NULL,
    "last_facebook_verified_at" timestamp with time zone,
    "last_instagram_verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "missionary_social_connections_facebook_status_check" CHECK (("facebook_status" = ANY (ARRAY['not_connected'::"text", 'connected'::"text", 'reconnect_required'::"text"]))),
    CONSTRAINT "missionary_social_connections_instagram_status_check" CHECK (("instagram_status" = ANY (ARRAY['not_connected'::"text", 'connected'::"text", 'reconnect_required'::"text"])))
);


ALTER TABLE "public"."missionary_social_connections" OWNER TO "postgres";


ALTER TABLE "public"."missionary_social_connections" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."missionary_social_connections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "related_entity_type" "text",
    "related_entity_id" bigint,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "content_metadata" "jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


ALTER TABLE "public"."notifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."page_approvals" (
    "id" bigint NOT NULL,
    "page_id" bigint NOT NULL,
    "requested_by" "uuid",
    "approved_by" "uuid",
    "status" "text" DEFAULT 'Pending'::"text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "page_approvals_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'Agency Approved'::"text", 'Published'::"text", 'Unpublished'::"text"])))
);


ALTER TABLE "public"."page_approvals" OWNER TO "postgres";


ALTER TABLE "public"."page_approvals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."page_approvals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."page_donations" (
    "id" bigint NOT NULL,
    "donor_id" bigint,
    "page_id" bigint NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "transaction_ref" "text",
    "status" "text" DEFAULT 'Pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'one_time'::"text",
    "stripe_payment_intent_id" "text",
    "stripe_subscription_id" "text",
    "stripe_invoice_id" "text",
    "user_id" "uuid",
    "designation" "text",
    "donor_first_name" "text",
    "donor_last_name" "text",
    "donor_email" "text",
    "mission_agency_name" "text",
    CONSTRAINT "page_donations_designation_check" CHECK (("char_length"("designation") <= 50)),
    CONSTRAINT "page_donations_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'Complete'::"text", 'Failed'::"text", 'Refunded'::"text", 'Disputed'::"text"]))),
    CONSTRAINT "page_donations_type_check" CHECK ((("type" IS NULL) OR ("type" = ANY (ARRAY['one_time'::"text", 'recurring'::"text"]))))
);


ALTER TABLE "public"."page_donations" OWNER TO "postgres";


ALTER TABLE "public"."page_donations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."page_donations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."page_media" (
    "id" bigint NOT NULL,
    "page_id" bigint NOT NULL,
    "media_type" "text",
    "media_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "description" "text",
    "views" integer,
    "reactions" integer,
    "thumbnail_url" "text",
    "hashed_id" "text",
    CONSTRAINT "page_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."page_media" OWNER TO "postgres";


ALTER TABLE "public"."page_media" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."page_media_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."page_widgets" (
    "id" bigint NOT NULL,
    "page_id" bigint NOT NULL,
    "widget_type" "text",
    "widget_title" "text",
    "widget_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."page_widgets" OWNER TO "postgres";


ALTER TABLE "public"."page_widgets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."page_widgets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" bigint NOT NULL,
    "organization_type" "text" NOT NULL,
    "organization_id" bigint NOT NULL,
    "page_url" "text",
    "profile_photo_url" "text",
    "banner_photo_url" "text",
    "short_quote" "text",
    "about_text" "text",
    "intro_text" "text",
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "donation_percentage" real,
    "is_review" boolean,
    "template_content" "text",
    "video_hashed_id" character varying(255),
    "donation_mode" "text",
    "external_donation_url" "text",
    "page_template" "text",
    CONSTRAINT "pages_donation_mode_check" CHECK ((("donation_mode" IS NULL) OR ("donation_mode" = ANY (ARRAY['harvest21'::"text", 'external'::"text", 'off'::"text"])))),
    CONSTRAINT "pages_organization_type_check" CHECK (("organization_type" = ANY (ARRAY['church'::"text", 'college'::"text", 'agency'::"text", 'missionary'::"text", 'donor'::"text"])))
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


ALTER TABLE "public"."pages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."pages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."prayer_reactions" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prayer_id" bigint NOT NULL,
    "type" "text" DEFAULT 'amen'::"text" NOT NULL,
    CONSTRAINT "prayer_reactions_type_check" CHECK (("type" = 'amen'::"text"))
);


ALTER TABLE "public"."prayer_reactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."prayer_reactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."prayer_reactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."prayer_reactions_id_seq" OWNED BY "public"."prayer_reactions"."id";



CREATE TABLE IF NOT EXISTS "public"."prayer_updates" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prayer_id" bigint NOT NULL,
    "body" "text" NOT NULL
);


ALTER TABLE "public"."prayer_updates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."prayer_updates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."prayer_updates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."prayer_updates_id_seq" OWNED BY "public"."prayer_updates"."id";



CREATE TABLE IF NOT EXISTS "public"."prayers" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "page_id" bigint,
    "title" "text",
    "body" "text" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "amen_count" integer DEFAULT 0 NOT NULL,
    "update_count" integer DEFAULT 0 NOT NULL,
    "share_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "prayers_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'supporters'::"text"])))
);


ALTER TABLE "public"."prayers" OWNER TO "postgres";


COMMENT ON TABLE "public"."prayers" IS 'User-created prayer requests connected to auth.users.';



CREATE SEQUENCE IF NOT EXISTS "public"."prayers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."prayers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."prayers_id_seq" OWNED BY "public"."prayers"."id";



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."push_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."social_cross_post_attempts" (
    "id" bigint NOT NULL,
    "missionary_id" bigint NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" bigint NOT NULL,
    "platform" "text" NOT NULL,
    "status" "text" NOT NULL,
    "external_post_id" "text",
    "error_detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_cross_post_attempts_platform_check" CHECK (("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text"]))),
    CONSTRAINT "social_cross_post_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'posted'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."social_cross_post_attempts" OWNER TO "postgres";


ALTER TABLE "public"."social_cross_post_attempts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."social_cross_post_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."supporter_profiles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "country_of_residence" "text" NOT NULL,
    "phone_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_photo_url" "text",
    CONSTRAINT "supporter_profiles_country_of_residence_check" CHECK (("char_length"("country_of_residence") > 0)),
    CONSTRAINT "supporter_profiles_email_check" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "supporter_profiles_first_name_check" CHECK (("char_length"("first_name") > 0)),
    CONSTRAINT "supporter_profiles_last_name_check" CHECK (("char_length"("last_name") > 0))
);


ALTER TABLE "public"."supporter_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."supporter_profiles" IS 'Stores supporter-specific profile information for users with role 4 (SUPPORTER)';



COMMENT ON COLUMN "public"."supporter_profiles"."user_id" IS 'References auth.users(id) - unique per supporter';



COMMENT ON COLUMN "public"."supporter_profiles"."email" IS 'Supporter email, must be valid format';



COMMENT ON COLUMN "public"."supporter_profiles"."country_of_residence" IS 'Required field for supporter profile';



ALTER TABLE "public"."supporter_profiles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."supporter_profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" bigint NOT NULL,
    "role" character varying
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE "public"."user_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "role" smallint,
    "status" character varying DEFAULT 'Pending'::character varying,
    "first_name" character varying,
    "last_name" character varying,
    "email" "text" NOT NULL,
    "last_activity" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE "public"."users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."prayer_reactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."prayer_reactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."prayer_updates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."prayer_updates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."prayers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."prayers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."affiliated_churches"
    ADD CONSTRAINT "affiliated_churches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_followers"
    ADD CONSTRAINT "church_followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_followers"
    ADD CONSTRAINT "church_followers_unique" UNIQUE ("church_id", "user_id");



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colleges"
    ADD CONSTRAINT "colleges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_unique" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_unique_pair" UNIQUE ("missionary_id", "supporter_id");



ALTER TABLE ONLY "public"."donation_receipts"
    ADD CONSTRAINT "donation_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."donation_receipts"
    ADD CONSTRAINT "donation_receipts_receipt_number_key" UNIQUE ("receipt_number");



ALTER TABLE ONLY "public"."donors"
    ADD CONSTRAINT "donors_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."donors"
    ADD CONSTRAINT "donors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."footer_content"
    ADD CONSTRAINT "footer_content_page_type_key" UNIQUE ("page_type");



ALTER TABLE ONLY "public"."footer_content"
    ADD CONSTRAINT "footer_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homepage_banners"
    ADD CONSTRAINT "homepage_banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homepage_featured_sections"
    ADD CONSTRAINT "homepage_featured_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homepage_section_profiles"
    ADD CONSTRAINT "homepage_section_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homepage_section_profiles"
    ADD CONSTRAINT "homepage_section_profiles_section_id_profile_id_key" UNIQUE ("section_id", "profile_id");



ALTER TABLE ONLY "public"."homepage_settings"
    ADD CONSTRAINT "homepage_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_oauth_pending"
    ADD CONSTRAINT "meta_oauth_pending_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_oauth_states"
    ADD CONSTRAINT "meta_oauth_states_pkey" PRIMARY KEY ("state_token");



ALTER TABLE ONLY "public"."missionaries"
    ADD CONSTRAINT "missionaries_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."missionaries"
    ADD CONSTRAINT "missionaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missionary_churches"
    ADD CONSTRAINT "missionary_churches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missionary_content_publications"
    ADD CONSTRAINT "missionary_content_publications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missionary_follower_content_ack"
    ADD CONSTRAINT "missionary_follower_content_ack_pkey" PRIMARY KEY ("user_id", "missionary_id");



ALTER TABLE ONLY "public"."missionary_followers"
    ADD CONSTRAINT "missionary_followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missionary_followers"
    ADD CONSTRAINT "missionary_followers_unique" UNIQUE ("missionary_id", "user_id");



ALTER TABLE ONLY "public"."missionary_missionary_followers"
    ADD CONSTRAINT "missionary_missionary_followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missionary_missionary_followers"
    ADD CONSTRAINT "missionary_missionary_followers_unique" UNIQUE ("follower_missionary_id", "followed_missionary_id");



ALTER TABLE ONLY "public"."missionary_social_connections"
    ADD CONSTRAINT "missionary_social_connections_missionary_id_key" UNIQUE ("missionary_id");



ALTER TABLE ONLY "public"."missionary_social_connections"
    ADD CONSTRAINT "missionary_social_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_approvals"
    ADD CONSTRAINT "page_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_donations"
    ADD CONSTRAINT "page_donations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_media"
    ADD CONSTRAINT "page_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_widgets"
    ADD CONSTRAINT "page_widgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_org_unique" UNIQUE ("organization_type", "organization_id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_page_url_key" UNIQUE ("page_url");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prayer_reactions"
    ADD CONSTRAINT "prayer_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prayer_reactions"
    ADD CONSTRAINT "prayer_reactions_user_id_prayer_id_type_key" UNIQUE ("user_id", "prayer_id", "type");



ALTER TABLE ONLY "public"."prayer_updates"
    ADD CONSTRAINT "prayer_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prayers"
    ADD CONSTRAINT "prayers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_user_id_key" UNIQUE ("endpoint", "user_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_cross_post_attempts"
    ADD CONSTRAINT "social_cross_post_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_cross_post_attempts"
    ADD CONSTRAINT "social_cross_post_attempts_source_table_source_id_platform_key" UNIQUE ("source_table", "source_id", "platform");



ALTER TABLE ONLY "public"."supporter_profiles"
    ADD CONSTRAINT "supporter_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supporter_profiles"
    ADD CONSTRAINT "supporter_profiles_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."affiliated_churches"
    ADD CONSTRAINT "unique_missionary_church" UNIQUE ("missionary_id", "church_id");



ALTER TABLE ONLY "public"."missionary_churches"
    ADD CONSTRAINT "unique_missionary_churches_pair" UNIQUE ("missionary_id", "church_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_affiliated_churches_church_id" ON "public"."affiliated_churches" USING "btree" ("church_id");



CREATE INDEX "idx_affiliated_churches_created_at" ON "public"."affiliated_churches" USING "btree" ("created_at");



CREATE INDEX "idx_affiliated_churches_missionary_id" ON "public"."affiliated_churches" USING "btree" ("missionary_id");



CREATE INDEX "idx_church_followers_church" ON "public"."church_followers" USING "btree" ("church_id");



CREATE INDEX "idx_church_followers_created" ON "public"."church_followers" USING "btree" ("created_at");



CREATE INDEX "idx_church_followers_status" ON "public"."church_followers" USING "btree" ("status");



CREATE INDEX "idx_church_followers_unfollowed" ON "public"."church_followers" USING "btree" ("church_id", "status") WHERE ("status" <> 'unfollowed'::"text");



CREATE INDEX "idx_church_followers_user" ON "public"."church_followers" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_members_conversation" ON "public"."conversation_members" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_members_unread" ON "public"."conversation_members" USING "btree" ("user_id", "unread_count") WHERE ("unread_count" > 0);



CREATE INDEX "idx_conversation_members_user" ON "public"."conversation_members" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_missionary" ON "public"."conversations" USING "btree" ("missionary_id");



CREATE INDEX "idx_conversations_supporter" ON "public"."conversations" USING "btree" ("supporter_id");



CREATE INDEX "idx_conversations_updated" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_donation_receipts_donor_id" ON "public"."donation_receipts" USING "btree" ("donor_id");



CREATE INDEX "idx_donation_receipts_page_donation_id" ON "public"."donation_receipts" USING "btree" ("page_donation_id");



CREATE INDEX "idx_donation_receipts_receipt_number" ON "public"."donation_receipts" USING "btree" ("receipt_number");



CREATE INDEX "idx_donors_email" ON "public"."donors" USING "btree" ("email");



CREATE INDEX "idx_donors_is_active" ON "public"."donors" USING "btree" ("is_active");



CREATE INDEX "idx_donors_user_id" ON "public"."donors" USING "btree" ("user_id");



CREATE INDEX "idx_footer_content_updated_by" ON "public"."footer_content" USING "btree" ("updated_by");



CREATE INDEX "idx_mcp_missionary_published" ON "public"."missionary_content_publications" USING "btree" ("missionary_id", "published_at" DESC);



CREATE INDEX "idx_message_reports_reported_by" ON "public"."message_reports" USING "btree" ("reported_by");



CREATE INDEX "idx_message_reports_status" ON "public"."message_reports" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_created" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_meta_oauth_pending_expires" ON "public"."meta_oauth_pending" USING "btree" ("expires_at");



CREATE INDEX "idx_meta_oauth_states_expires" ON "public"."meta_oauth_states" USING "btree" ("expires_at");



CREATE INDEX "idx_missionaries_open_to_visits" ON "public"."missionaries" USING "btree" ("open_to_visits");



CREATE INDEX "idx_missionaries_open_to_visits_dates" ON "public"."missionaries" USING "btree" ("open_to_visits", "visits_start_date") WHERE ("open_to_visits" = true);



CREATE INDEX "idx_missionary_churches_church_id" ON "public"."missionary_churches" USING "btree" ("church_id");



CREATE INDEX "idx_missionary_churches_missionary_id" ON "public"."missionary_churches" USING "btree" ("missionary_id");



CREATE INDEX "idx_missionary_churches_relationship_type" ON "public"."missionary_churches" USING "btree" ("relationship_type");



CREATE INDEX "idx_missionary_followers_created" ON "public"."missionary_followers" USING "btree" ("created_at");



CREATE INDEX "idx_missionary_followers_missionary" ON "public"."missionary_followers" USING "btree" ("missionary_id");



CREATE INDEX "idx_missionary_followers_status" ON "public"."missionary_followers" USING "btree" ("status");



CREATE INDEX "idx_missionary_followers_unfollowed" ON "public"."missionary_followers" USING "btree" ("missionary_id", "status") WHERE ("status" <> 'unfollowed'::"text");



CREATE INDEX "idx_missionary_followers_user" ON "public"."missionary_followers" USING "btree" ("user_id");



CREATE INDEX "idx_missionary_missionary_followers_followed" ON "public"."missionary_missionary_followers" USING "btree" ("followed_missionary_id");



CREATE INDEX "idx_missionary_missionary_followers_follower" ON "public"."missionary_missionary_followers" USING "btree" ("follower_missionary_id");



CREATE INDEX "idx_missionary_missionary_followers_status" ON "public"."missionary_missionary_followers" USING "btree" ("status");



CREATE INDEX "idx_notifications_created" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_page_approvals_page_id" ON "public"."page_approvals" USING "btree" ("page_id");



CREATE INDEX "idx_page_donations_page_id" ON "public"."page_donations" USING "btree" ("page_id");



CREATE INDEX "idx_page_donations_stripe_invoice" ON "public"."page_donations" USING "btree" ("stripe_invoice_id") WHERE ("stripe_invoice_id" IS NOT NULL);



CREATE INDEX "idx_page_donations_stripe_payment_intent" ON "public"."page_donations" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "idx_page_donations_user_id" ON "public"."page_donations" USING "btree" ("user_id");



CREATE INDEX "idx_page_media_page_id" ON "public"."page_media" USING "btree" ("page_id");



CREATE INDEX "idx_page_widgets_page_id" ON "public"."page_widgets" USING "btree" ("page_id");



CREATE INDEX "idx_pages_created_at" ON "public"."pages" USING "btree" ("created_at");



CREATE INDEX "idx_pages_donation_mode" ON "public"."pages" USING "btree" ("donation_mode") WHERE ("donation_mode" IS NOT NULL);



CREATE INDEX "idx_pages_is_published" ON "public"."pages" USING "btree" ("is_published");



CREATE INDEX "idx_pages_org_type_id" ON "public"."pages" USING "btree" ("organization_type", "organization_id");



CREATE INDEX "idx_prayer_reactions_prayer" ON "public"."prayer_reactions" USING "btree" ("prayer_id");



CREATE INDEX "idx_prayer_updates_prayer" ON "public"."prayer_updates" USING "btree" ("prayer_id");



CREATE INDEX "idx_prayers_page" ON "public"."prayers" USING "btree" ("page_id");



CREATE INDEX "idx_prayers_published" ON "public"."prayers" USING "btree" ("is_published", "visibility");



CREATE INDEX "idx_prayers_user" ON "public"."prayers" USING "btree" ("user_id");



CREATE INDEX "idx_push_subscriptions_endpoint" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "idx_push_subscriptions_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_social_cross_post_missionary_created" ON "public"."social_cross_post_attempts" USING "btree" ("missionary_id", "created_at" DESC);



CREATE INDEX "idx_supporter_profiles_created_at" ON "public"."supporter_profiles" USING "btree" ("created_at");



CREATE INDEX "idx_supporter_profiles_email" ON "public"."supporter_profiles" USING "btree" ("email");



CREATE INDEX "idx_supporter_profiles_user_id" ON "public"."supporter_profiles" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uniq_donation_receipts_page_donation_id" ON "public"."donation_receipts" USING "btree" ("page_donation_id");



CREATE UNIQUE INDEX "uniq_page_donations_stripe_invoice_id" ON "public"."page_donations" USING "btree" ("stripe_invoice_id") WHERE ("stripe_invoice_id" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_page_donations_stripe_payment_intent_id" ON "public"."page_donations" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "set_church_followers_updated_at" BEFORE UPDATE ON "public"."church_followers" FOR EACH ROW EXECUTE FUNCTION "public"."update_church_followers_updated_at"();



CREATE OR REPLACE TRIGGER "set_supporter_profiles_updated_at" BEFORE UPDATE ON "public"."supporter_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_supporter_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prayers_updated_at" BEFORE UPDATE ON "public"."prayers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_react_count_del" AFTER DELETE ON "public"."prayer_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."bump_amen_count"();



CREATE OR REPLACE TRIGGER "trg_react_count_ins" AFTER INSERT ON "public"."prayer_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."bump_amen_count"();



CREATE OR REPLACE TRIGGER "trg_updates_count_del" AFTER DELETE ON "public"."prayer_updates" FOR EACH ROW EXECUTE FUNCTION "public"."bump_update_count"();



CREATE OR REPLACE TRIGGER "trg_updates_count_ins" AFTER INSERT ON "public"."prayer_updates" FOR EACH ROW EXECUTE FUNCTION "public"."bump_update_count"();



CREATE OR REPLACE TRIGGER "trigger_increment_unread_count" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."increment_unread_count"();



CREATE OR REPLACE TRIGGER "trigger_update_conversation_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_on_message"();



CREATE OR REPLACE TRIGGER "update_push_subscriptions_updated_at" BEFORE UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_subscription_updated_at"();



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_followers"
    ADD CONSTRAINT "church_followers_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_followers"
    ADD CONSTRAINT "church_followers_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."church_followers"
    ADD CONSTRAINT "church_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."colleges"
    ADD CONSTRAINT "colleges_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."donation_receipts"
    ADD CONSTRAINT "donation_receipts_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id");



ALTER TABLE ONLY "public"."donation_receipts"
    ADD CONSTRAINT "donation_receipts_page_donation_id_fkey" FOREIGN KEY ("page_donation_id") REFERENCES "public"."page_donations"("id");



ALTER TABLE ONLY "public"."donors"
    ADD CONSTRAINT "donors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."affiliated_churches"
    ADD CONSTRAINT "fk_church" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."affiliated_churches"
    ADD CONSTRAINT "fk_missionary" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_churches"
    ADD CONSTRAINT "fk_missionary_churches_church" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_churches"
    ADD CONSTRAINT "fk_missionary_churches_missionary" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."footer_content"
    ADD CONSTRAINT "footer_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."homepage_section_profiles"
    ADD CONSTRAINT "homepage_section_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homepage_section_profiles"
    ADD CONSTRAINT "homepage_section_profiles_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."homepage_featured_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id");



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id");



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_oauth_pending"
    ADD CONSTRAINT "meta_oauth_pending_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_oauth_pending"
    ADD CONSTRAINT "meta_oauth_pending_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_oauth_states"
    ADD CONSTRAINT "meta_oauth_states_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_oauth_states"
    ADD CONSTRAINT "meta_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionaries"
    ADD CONSTRAINT "missionaries_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missionaries"
    ADD CONSTRAINT "missionaries_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missionaries"
    ADD CONSTRAINT "missionaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missionary_content_publications"
    ADD CONSTRAINT "missionary_content_publications_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_content_publications"
    ADD CONSTRAINT "missionary_content_publications_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_follower_content_ack"
    ADD CONSTRAINT "missionary_follower_content_ack_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_follower_content_ack"
    ADD CONSTRAINT "missionary_follower_content_ack_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_followers"
    ADD CONSTRAINT "missionary_followers_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_followers"
    ADD CONSTRAINT "missionary_followers_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."missionary_followers"
    ADD CONSTRAINT "missionary_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_missionary_followers"
    ADD CONSTRAINT "missionary_missionary_followers_followed_fkey" FOREIGN KEY ("followed_missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_missionary_followers"
    ADD CONSTRAINT "missionary_missionary_followers_follower_fkey" FOREIGN KEY ("follower_missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missionary_missionary_followers"
    ADD CONSTRAINT "missionary_missionary_followers_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."missionary_social_connections"
    ADD CONSTRAINT "missionary_social_connections_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_approvals"
    ADD CONSTRAINT "page_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."page_approvals"
    ADD CONSTRAINT "page_approvals_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_approvals"
    ADD CONSTRAINT "page_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."page_donations"
    ADD CONSTRAINT "page_donations_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."page_donations"
    ADD CONSTRAINT "page_donations_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_donations"
    ADD CONSTRAINT "page_donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."page_media"
    ADD CONSTRAINT "page_media_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_widgets"
    ADD CONSTRAINT "page_widgets_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_reactions"
    ADD CONSTRAINT "prayer_reactions_prayer_id_fkey" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_reactions"
    ADD CONSTRAINT "prayer_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_updates"
    ADD CONSTRAINT "prayer_updates_prayer_id_fkey" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_updates"
    ADD CONSTRAINT "prayer_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayers"
    ADD CONSTRAINT "prayers_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayers"
    ADD CONSTRAINT "prayers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_cross_post_attempts"
    ADD CONSTRAINT "social_cross_post_attempts_missionary_id_fkey" FOREIGN KEY ("missionary_id") REFERENCES "public"."missionaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supporter_profiles"
    ADD CONSTRAINT "supporter_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_fkey" FOREIGN KEY ("role") REFERENCES "public"."user_roles"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Accepted followers can create conversations" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() = "supporter_id") AND "public"."is_missionary_follower"("missionary_id", "auth"."uid"()) AND (( SELECT "missionaries"."allow_direct_messages"
   FROM "public"."missionaries"
  WHERE ("missionaries"."id" = "conversations"."missionary_id")) = true)));



CREATE POLICY "Admins and Managers can access" ON "public"."user_roles" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "users"."user_id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY[1, 2]))))) WITH CHECK (("auth"."uid"() IN ( SELECT "users"."user_id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY[1, 2])))));



CREATE POLICY "Admins can delete all supporter profiles" ON "public"."supporter_profiles" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."user_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Admins can delete banners" ON "public"."homepage_banners" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can delete footer content" ON "public"."footer_content" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can insert banners" ON "public"."homepage_banners" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert footer content" ON "public"."footer_content" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update all supporter profiles" ON "public"."supporter_profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."user_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Admins can update all users" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "users_1"."user_id"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."role" = ANY (ARRAY[1, 2])))));



CREATE POLICY "Admins can update banners" ON "public"."homepage_banners" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update footer content" ON "public"."footer_content" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update homepage settings" ON "public"."homepage_settings" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins can update reports" ON "public"."message_reports" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."user_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Admins can view all banners" ON "public"."homepage_banners" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all reports" ON "public"."message_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."user_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Admins can view all supporter profiles" ON "public"."supporter_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."user_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Admins have full access to affiliated churches" ON "public"."affiliated_churches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Admins have full access to missionary churches" ON "public"."missionary_churches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "All" ON "public"."colleges" TO "authenticated" USING (("auth"."uid"() IN ( SELECT "users"."user_id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY[1, 2]))))) WITH CHECK (("auth"."uid"() IN ( SELECT "users"."user_id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY[1, 2])))));



CREATE POLICY "Allow user creation" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "users_1"."user_id"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."role" = ANY (ARRAY[1, 2]))))));



CREATE POLICY "Anyone can view active banners" ON "public"."homepage_banners" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view church followers" ON "public"."church_followers" FOR SELECT USING (true);



CREATE POLICY "Anyone can view followers" ON "public"."missionary_followers" FOR SELECT USING (true);



CREATE POLICY "Anyone can view footer content" ON "public"."footer_content" FOR SELECT USING (true);



CREATE POLICY "Anyone can view homepage settings" ON "public"."homepage_settings" FOR SELECT USING (true);



CREATE POLICY "Auth users can amen published public prayers" ON "public"."prayer_reactions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."prayers" "p"
  WHERE (("p"."id" = "prayer_reactions"."prayer_id") AND ("p"."is_published" = true) AND ("p"."visibility" = 'public'::"text") AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "Authenticated users can view profiles" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Church owners and admins can update follower status" ON "public"."church_followers" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."churches" "c"
  WHERE (("c"."id" = "church_followers"."church_id") AND ("c"."contact_user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))));



CREATE POLICY "Donors can read own receipts" ON "public"."donation_receipts" FOR SELECT TO "authenticated" USING ((("donor_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."donors" "d"
  WHERE (("d"."id" = "donation_receipts"."donor_id") AND ("d"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Members can send messages" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "messages"."conversation_id") AND ("conversation_members"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."missionaries" "m" ON (("c"."missionary_id" = "m"."id")))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("m"."allow_direct_messages" = true))))));



CREATE POLICY "Members can update conversations" ON "public"."conversations" FOR UPDATE USING ((("auth"."uid"() = "supporter_id") OR ("auth"."uid"() IN ( SELECT "missionaries"."user_id"
   FROM "public"."missionaries"
  WHERE ("missionaries"."id" = "conversations"."missionary_id")))));



CREATE POLICY "Members can view conversation messages" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "messages"."conversation_id") AND ("conversation_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionaries can create follow requests" ON "public"."missionary_missionary_followers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_missionary_followers"."follower_missionary_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionaries can delete their own affiliations" ON "public"."affiliated_churches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "affiliated_churches"."missionary_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionaries can delete their own church affiliations" ON "public"."missionary_churches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_churches"."missionary_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionaries can delete their own follow requests" ON "public"."missionary_missionary_followers" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_missionary_followers"."follower_missionary_id") AND ("m"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))));



CREATE POLICY "Missionaries can insert their own affiliations" ON "public"."affiliated_churches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "affiliated_churches"."missionary_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionaries can insert their own church affiliations" ON "public"."missionary_churches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_churches"."missionary_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionaries can update their own follow requests" ON "public"."missionary_missionary_followers" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_missionary_followers"."follower_missionary_id") AND ("m"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_missionary_followers"."followed_missionary_id") AND ("m"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))));



CREATE POLICY "Missionary owners and admins can update follower status" ON "public"."missionary_followers" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_followers"."missionary_id") AND ("m"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))));



CREATE POLICY "Missionary reads own cross post attempts" ON "public"."social_cross_post_attempts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "social_cross_post_attempts"."missionary_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Missionary reads own oauth pending" ON "public"."meta_oauth_pending" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Missionary reads own oauth states" ON "public"."meta_oauth_states" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Owner can delete prayers" ON "public"."prayers" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner can read own prayers" ON "public"."prayers" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Owner can read/create updates on own prayer" ON "public"."prayer_updates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."prayers" "p"
  WHERE (("p"."id" = "prayer_updates"."prayer_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."prayers" "p"
  WHERE (("p"."id" = "prayer_updates"."prayer_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Owner can update prayers" ON "public"."prayers" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner can view their own page" ON "public"."pages" FOR SELECT USING (((("organization_type" = 'missionary'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "pages"."organization_id") AND ("m"."user_id" = "auth"."uid"()))))) OR (("organization_type" = 'church'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."churches" "ch"
  WHERE (("ch"."id" = "pages"."organization_id") AND ("ch"."contact_user_id" = "auth"."uid"()))))) OR (("organization_type" = 'college'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."colleges" "co"
  WHERE (("co"."id" = "pages"."organization_id") AND ("co"."contact_user_id" = "auth"."uid"()))))) OR (("organization_type" = 'agency'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."agencies" "ag"
  WHERE (("ag"."id" = "pages"."organization_id") AND ("ag"."contact_user_id" = "auth"."uid"()))))) OR (("organization_type" = 'donor'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."donors" "d"
  WHERE (("d"."id" = "pages"."organization_id") AND ("d"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Owner or org contact can manage page" ON "public"."pages" USING (((("organization_type" = 'missionary'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "pages"."organization_id") AND ("m"."user_id" = "auth"."uid"()))))) OR (("organization_type" = 'church'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."churches" "ch"
  WHERE (("ch"."id" = "pages"."organization_id") AND ("ch"."contact_user_id" = "auth"."uid"()))))) OR (("organization_type" = 'college'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."colleges" "co"
  WHERE (("co"."id" = "pages"."organization_id") AND ("co"."contact_user_id" = "auth"."uid"()))))) OR (("organization_type" = 'agency'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."agencies" "ag"
  WHERE (("ag"."id" = "pages"."organization_id") AND ("ag"."contact_user_id" = "auth"."uid"()))))) OR (("organization_type" = 'donor'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."donors" "d"
  WHERE (("d"."id" = "pages"."organization_id") AND ("d"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Public can read published prayers" ON "public"."prayers" FOR SELECT USING ((("is_published" = true) AND ("deleted_at" IS NULL) AND ("visibility" = 'public'::"text")));



CREATE POLICY "Public can read updates of public prayers" ON "public"."prayer_updates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."prayers" "p"
  WHERE (("p"."id" = "prayer_updates"."prayer_id") AND ("p"."is_published" = true) AND ("p"."visibility" = 'public'::"text") AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "Public can view media of published pages" ON "public"."page_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pages" "p"
  WHERE (("p"."id" = "page_media"."page_id") AND ("p"."is_published" = true)))));



CREATE POLICY "Public can view published pages" ON "public"."pages" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Public can view widgets of published pages" ON "public"."page_widgets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pages" "p"
  WHERE (("p"."id" = "page_widgets"."page_id") AND ("p"."is_published" = true)))));



CREATE POLICY "Public read access for affiliated churches" ON "public"."affiliated_churches" FOR SELECT USING (true);



CREATE POLICY "Public read access for missionary churches" ON "public"."missionary_churches" FOR SELECT USING (true);



CREATE POLICY "Public read reactions of public prayers" ON "public"."prayer_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."prayers" "p"
  WHERE (("p"."id" = "prayer_reactions"."prayer_id") AND ("p"."is_published" = true) AND ("p"."visibility" = 'public'::"text") AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "Reactor can delete reaction" ON "public"."prayer_reactions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Service role can manage push subscriptions" ON "public"."push_subscriptions" USING (true) WITH CHECK (true);



CREATE POLICY "Supporters can delete own profile" ON "public"."supporter_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Supporters can insert own profile" ON "public"."supporter_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Supporters can update own profile" ON "public"."supporter_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Supporters can view own profile" ON "public"."supporter_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "System can create memberships" ON "public"."conversation_members" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can cancel their own pending church requests" ON "public"."church_followers" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can cancel their own pending requests" ON "public"."missionary_followers" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can create church follow requests" ON "public"."church_followers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create follow requests" ON "public"."missionary_followers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own push subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own push subscriptions" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can report messages" ON "public"."message_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reported_by"));



CREATE POLICY "Users can unfollow churches they follow" ON "public"."church_followers" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("status" = 'accepted'::"text")));



CREATE POLICY "Users can unfollow missionaries they follow" ON "public"."missionary_followers" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("status" = 'accepted'::"text")));



CREATE POLICY "Users can update own membership" ON "public"."conversation_members" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own push subscriptions" ON "public"."push_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own push subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "supporter_id") OR ("auth"."uid"() IN ( SELECT "missionaries"."user_id"
   FROM "public"."missionaries"
  WHERE ("missionaries"."id" = "conversations"."missionary_id")))));



CREATE POLICY "Users can view their own memberships" ON "public"."conversation_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own missionary following records" ON "public"."missionary_missionary_followers" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_missionary_followers"."follower_missionary_id") AND ("m"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."missionaries" "m"
  WHERE (("m"."id" = "missionary_missionary_followers"."followed_missionary_id") AND ("m"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY[1, 2])))))));



CREATE POLICY "Users manage own missionary content ack" ON "public"."missionary_follower_content_ack" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."affiliated_churches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agencies_delete_admin" ON "public"."agencies" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "agencies_insert_admin" ON "public"."agencies" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "agencies_select_public" ON "public"."agencies" FOR SELECT USING (true);



CREATE POLICY "agencies_update_admin_or_owner" ON "public"."agencies" FOR UPDATE USING (("public"."is_admin"() OR ("contact_user_id" = "auth"."uid"())));



ALTER TABLE "public"."church_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."churches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "churches_delete_admin" ON "public"."churches" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "churches_insert_admin" ON "public"."churches" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "churches_select_public" ON "public"."churches" FOR SELECT USING (true);



CREATE POLICY "churches_update_admin_or_owner" ON "public"."churches" FOR UPDATE USING (("public"."is_admin"() OR ("contact_user_id" = "auth"."uid"())));



ALTER TABLE "public"."colleges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "colleges_delete_admin" ON "public"."colleges" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "colleges_insert_admin" ON "public"."colleges" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "colleges_select_public" ON "public"."colleges" FOR SELECT USING (true);



CREATE POLICY "colleges_update_admin_or_owner" ON "public"."colleges" FOR UPDATE USING (("public"."is_admin"() OR ("contact_user_id" = "auth"."uid"())));



ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."donation_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."donors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "donors_delete_admin" ON "public"."donors" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "donors_insert_admin" ON "public"."donors" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "donors_select_public" ON "public"."donors" FOR SELECT USING (true);



CREATE POLICY "donors_update_admin_or_owner" ON "public"."donors" FOR UPDATE USING (("public"."is_admin"() OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."footer_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homepage_banners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homepage_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_oauth_pending" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_oauth_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missionaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "missionaries_delete_admin" ON "public"."missionaries" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "missionaries_insert_admin" ON "public"."missionaries" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "missionaries_select_public" ON "public"."missionaries" FOR SELECT USING (true);



CREATE POLICY "missionaries_update_admin_or_owner" ON "public"."missionaries" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."missionary_churches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missionary_content_publications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missionary_follower_content_ack" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missionary_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missionary_missionary_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missionary_social_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_donations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_widgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayer_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayer_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_cross_post_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supporter_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_amen_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_amen_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_amen_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_update_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_update_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_update_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_resend_follow_request"("p_missionary_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_resend_follow_request"("p_missionary_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_resend_follow_request"("p_missionary_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_send_direct_message"("p_missionary_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_send_direct_message"("p_missionary_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_send_direct_message"("p_missionary_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_church_follower_status"("p_church_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_church_follower_status"("p_church_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_church_follower_status"("p_church_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_id"("p_missionary_id" bigint, "p_supporter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_id"("p_missionary_id" bigint, "p_supporter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_id"("p_missionary_id" bigint, "p_supporter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_missionary_follower_count"("p_missionary_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_missionary_follower_count"("p_missionary_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_missionary_follower_count"("p_missionary_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_missionary_follower_status"("p_missionary_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_missionary_follower_status"("p_missionary_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_missionary_follower_status"("p_missionary_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_unread_messages"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_unread_messages"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_unread_messages"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_church_follower"("p_church_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_church_follower"("p_church_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_church_follower"("p_church_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_missionary_follower"("p_missionary_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_missionary_follower"("p_missionary_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_missionary_follower"("p_missionary_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_church_followers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_church_followers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_church_followers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_push_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_push_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_push_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_supporter_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_supporter_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supporter_profiles_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."affiliated_churches" TO "anon";
GRANT ALL ON TABLE "public"."affiliated_churches" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliated_churches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."affiliated_churches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."affiliated_churches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."affiliated_churches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."agencies" TO "anon";
GRANT ALL ON TABLE "public"."agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."agencies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agencies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agencies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agencies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."church_followers" TO "anon";
GRANT ALL ON TABLE "public"."church_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."church_followers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."church_followers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."church_followers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."church_followers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."churches" TO "anon";
GRANT ALL ON TABLE "public"."churches" TO "authenticated";
GRANT ALL ON TABLE "public"."churches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."churches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."churches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."churches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."colleges" TO "anon";
GRANT ALL ON TABLE "public"."colleges" TO "authenticated";
GRANT ALL ON TABLE "public"."colleges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."colleges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."colleges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."colleges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conversation_members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conversation_members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conversation_members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conversations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conversations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conversations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."donation_receipts" TO "anon";
GRANT ALL ON TABLE "public"."donation_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."donation_receipts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."donation_receipts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."donation_receipts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."donation_receipts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."donors" TO "anon";
GRANT ALL ON TABLE "public"."donors" TO "authenticated";
GRANT ALL ON TABLE "public"."donors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."donors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."donors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."donors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."footer_content" TO "anon";
GRANT ALL ON TABLE "public"."footer_content" TO "authenticated";
GRANT ALL ON TABLE "public"."footer_content" TO "service_role";



GRANT ALL ON SEQUENCE "public"."footer_content_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."footer_content_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."footer_content_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."homepage_banners" TO "anon";
GRANT ALL ON TABLE "public"."homepage_banners" TO "authenticated";
GRANT ALL ON TABLE "public"."homepage_banners" TO "service_role";



GRANT ALL ON SEQUENCE "public"."homepage_banners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."homepage_banners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."homepage_banners_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."homepage_featured_sections" TO "anon";
GRANT ALL ON TABLE "public"."homepage_featured_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."homepage_featured_sections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."homepage_featured_sections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."homepage_featured_sections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."homepage_featured_sections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."homepage_section_profiles" TO "anon";
GRANT ALL ON TABLE "public"."homepage_section_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."homepage_section_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."homepage_section_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."homepage_section_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."homepage_section_profiles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."homepage_settings" TO "anon";
GRANT ALL ON TABLE "public"."homepage_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."homepage_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."homepage_settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."homepage_settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."homepage_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."message_reports" TO "anon";
GRANT ALL ON TABLE "public"."message_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."message_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."message_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."message_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meta_oauth_pending" TO "anon";
GRANT ALL ON TABLE "public"."meta_oauth_pending" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_oauth_pending" TO "service_role";



GRANT ALL ON TABLE "public"."meta_oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."meta_oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."missionaries" TO "anon";
GRANT ALL ON TABLE "public"."missionaries" TO "authenticated";
GRANT ALL ON TABLE "public"."missionaries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."missionaries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."missionaries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."missionaries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."missionary_churches" TO "anon";
GRANT ALL ON TABLE "public"."missionary_churches" TO "authenticated";
GRANT ALL ON TABLE "public"."missionary_churches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."missionary_churches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."missionary_churches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."missionary_churches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."missionary_content_publications" TO "anon";
GRANT ALL ON TABLE "public"."missionary_content_publications" TO "authenticated";
GRANT ALL ON TABLE "public"."missionary_content_publications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."missionary_content_publications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."missionary_content_publications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."missionary_content_publications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."missionary_follower_content_ack" TO "anon";
GRANT ALL ON TABLE "public"."missionary_follower_content_ack" TO "authenticated";
GRANT ALL ON TABLE "public"."missionary_follower_content_ack" TO "service_role";



GRANT ALL ON TABLE "public"."missionary_followers" TO "anon";
GRANT ALL ON TABLE "public"."missionary_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."missionary_followers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."missionary_followers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."missionary_followers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."missionary_followers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."missionary_missionary_followers" TO "anon";
GRANT ALL ON TABLE "public"."missionary_missionary_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."missionary_missionary_followers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."missionary_missionary_followers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."missionary_missionary_followers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."missionary_missionary_followers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."missionary_social_connections" TO "anon";
GRANT ALL ON TABLE "public"."missionary_social_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."missionary_social_connections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."missionary_social_connections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."missionary_social_connections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."missionary_social_connections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."page_approvals" TO "anon";
GRANT ALL ON TABLE "public"."page_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."page_approvals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."page_approvals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."page_approvals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."page_approvals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."page_donations" TO "anon";
GRANT ALL ON TABLE "public"."page_donations" TO "authenticated";
GRANT ALL ON TABLE "public"."page_donations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."page_donations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."page_donations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."page_donations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."page_media" TO "anon";
GRANT ALL ON TABLE "public"."page_media" TO "authenticated";
GRANT ALL ON TABLE "public"."page_media" TO "service_role";



GRANT ALL ON SEQUENCE "public"."page_media_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."page_media_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."page_media_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."page_widgets" TO "anon";
GRANT ALL ON TABLE "public"."page_widgets" TO "authenticated";
GRANT ALL ON TABLE "public"."page_widgets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."page_widgets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."page_widgets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."page_widgets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pages" TO "anon";
GRANT ALL ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prayer_reactions" TO "anon";
GRANT ALL ON TABLE "public"."prayer_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."prayer_reactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prayer_reactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prayer_reactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prayer_reactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prayer_updates" TO "anon";
GRANT ALL ON TABLE "public"."prayer_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."prayer_updates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prayer_updates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prayer_updates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prayer_updates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prayers" TO "anon";
GRANT ALL ON TABLE "public"."prayers" TO "authenticated";
GRANT ALL ON TABLE "public"."prayers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prayers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prayers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prayers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."social_cross_post_attempts" TO "anon";
GRANT ALL ON TABLE "public"."social_cross_post_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_cross_post_attempts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."social_cross_post_attempts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."social_cross_post_attempts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."social_cross_post_attempts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supporter_profiles" TO "anon";
GRANT ALL ON TABLE "public"."supporter_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."supporter_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supporter_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supporter_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supporter_profiles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- Lookup/reference data: role catalog required by public.users.role FK
INSERT INTO "public"."user_roles" ("id", "role") VALUES
  (1, 'ADMIN'),
  (2, 'SUPER ADMIN'),
  (3, 'MISSIONARY'),
  (4, 'SUPPORTER'),
  (5, 'MISSION AGENCY'),
  (6, 'CHURCH'),
  (7, 'COLLEGE ADMIN')
ON CONFLICT ("id") DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.user_roles', 'id'),
  COALESCE((SELECT MAX(id) FROM "public"."user_roles"), 1)
);







