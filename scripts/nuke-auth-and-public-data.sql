-- Nuke row data only: TRUNCATE ... RESTART IDENTITY CASCADE (tables stay).
-- Order: public (drops app rows incl. public.users; keeps public.user_roles) -> auth -> storage.objects.
-- Run as postgres (e.g. same connection as upload-db-data.sh). Destructive.

BEGIN;

SET LOCAL session_replication_role = 'replica';

DO $blk$
DECLARE
  q text;
BEGIN
  SELECT 'TRUNCATE TABLE '
    || string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
    || ' RESTART IDENTITY CASCADE'
  INTO q
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> 'user_roles';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;
END
$blk$;

DO $blk$
DECLARE
  q text;
BEGIN
  SELECT 'TRUNCATE TABLE '
    || string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
    || ' RESTART IDENTITY CASCADE'
  INTO q
  FROM pg_tables
  WHERE schemaname = 'auth';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;
END
$blk$;

TRUNCATE TABLE storage.objects RESTART IDENTITY CASCADE;

SET LOCAL session_replication_role = 'origin';

COMMIT;
