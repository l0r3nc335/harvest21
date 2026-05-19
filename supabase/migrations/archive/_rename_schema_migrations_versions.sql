-- HELPER SCRIPT (NOT A MIGRATION). Filename starts with '_' so Supabase CLI ignores it.
--
-- Purpose:
--   Reconcile supabase_migrations.schema_migrations after the bulk rename of
--   non-standard migration filenames to the YYYYMMDDHHMMSS_name.sql format.
--
-- Status on the connected project (checked via list_migrations at rename time):
--   Only one row exists: version = '20251210162934' (name = 'remote_schema').
--   None of the renamed files were tracked by Supabase CLI on this project,
--   so no UPDATE is required there.
--
-- HOW TO USE on any other environment (staging / prod / branch):
--   1. Inspect what is registered:
--        SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
--   2. For every row whose `version` matches an OLD prefix on the left side
--      below, run the matching UPDATE. Skip rows that do not match - they
--      were applied manually (via SQL editor) and never tracked.
--   3. After updating, the next `supabase db push` will see the renamed
--      files as already-applied and will not try to re-run them.
--
-- All renames (OLD version  ->  NEW version):

-- Malformed timestamped files
UPDATE supabase_migrations.schema_migrations SET version = '20260320202631' WHERE version = '20260320';
-- (20251210145018 keeps its prefix; only the suffix changed - no DB update needed.)

-- Non-timestamped files (had no version row unless inserted manually).
-- These UPDATEs are no-ops on a clean project; provided for completeness:
UPDATE supabase_migrations.schema_migrations SET version = '20260416000100' WHERE version = 'add_footer_audit_fields';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000200' WHERE version = 'fix_missionary_unfollow_rls';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000300' WHERE version = 'add_unfollowed_status';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000400' WHERE version = 'add_open_to_visits_field';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000500' WHERE version = 'add_church_followers_updated_at';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000600' WHERE version = 'add_state_to_churches';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000700' WHERE version = 'update_missionary_header_title_to_personal_bio';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000800' WHERE version = 'update_missionary_join_title_text';
UPDATE supabase_migrations.schema_migrations SET version = '20260416000900' WHERE version = 'add_state_to_agencies';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001000' WHERE version = 'create_missionary_missionary_followers';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001100' WHERE version = 'create_missionary_churches_pivot';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001200' WHERE version = 'update_is_missionary_follower_for_missionary_following';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001300' WHERE version = 'add_is_managed_by_harvest21';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001400' WHERE version = 'add_page_template_to_pages';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001500' WHERE version = 'add_note_to_follow_requests';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001600' WHERE version = 'add_designation_to_page_donations';
UPDATE supabase_migrations.schema_migrations SET version = '20260416001700' WHERE version = 'add_donor_fields_to_page_donations';
