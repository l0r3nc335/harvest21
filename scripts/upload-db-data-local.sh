#!/usr/bin/env bash
set -euo pipefail

# Upload pg_dump data-only backups to the LOCAL Supabase CLI database.
#
# Differences vs upload-db-data.sh (cloud):
#   - No SSL (local loopback).
#   - Connects as `supabase_admin` (local superuser) so the dump's
#     `SET session_replication_role = replica` statement is permitted.
#   - No --ref, no project lookup, no pooler.
#   - No blob upload (use `supabase storage` CLI separately if needed).
#
# Local defaults (matches `supabase start`):
#   host  127.0.0.1
#   port  54322
#   user  supabase_admin
#   pw    postgres
#   db    postgres
#
# Usage:
#   ./scripts/upload-db-data-local.sh --stamp 20260422_075822
#   ./scripts/upload-db-data-local.sh --dir /path/to/backup
#   ./scripts/upload-db-data-local.sh --stamp <folder> --data-only
#   ./scripts/upload-db-data-local.sh --stamp <folder> --reset   # truncate first
#
# Files expected inside backup folder (any subset is OK):
#   auth_data.sql     (auth.users, auth.identities, etc.)
#   data.sql          (public.* tables)
#   storage_data.sql  (storage.buckets, storage.objects rows)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DIR=""
STAMP=""
SKIP_AUTH=0
SKIP_DATA=0
SKIP_STORAGE=0
RESET=0

HOST="${PGHOST_OVERRIDE:-127.0.0.1}"
PORT="${PGPORT_OVERRIDE:-54322}"
DBUSER="${PGUSER_OVERRIDE:-supabase_admin}"
DBPASS="${PGPASSWORD_OVERRIDE:-postgres}"
DBNAME="${PGDATABASE_OVERRIDE:-postgres}"

usage() {
  cat <<EOF
Usage: $0 (--stamp <folder> | --dir <path>) [flags]

  --stamp <folder>   backup at <repo>/supabase/backups/pg_dump/<folder>
  --dir <path>       full path to backup folder (exclusive with --stamp)

  Scope flags (combinable; default = apply everything that exists):
    --auth-only        only auth_data.sql
    --data-only        only data.sql
    --storage-only     only storage_data.sql
    --skip-auth        skip auth_data.sql
    --skip-data        skip data.sql
    --skip-storage     skip storage_data.sql

  --reset            truncate auth + public + storage rows before loading
                     (clean slate; avoids duplicate PK errors)

Connection (overridable via env):
  PGHOST_OVERRIDE     default 127.0.0.1
  PGPORT_OVERRIDE     default 54322
  PGUSER_OVERRIDE     default supabase_admin
  PGPASSWORD_OVERRIDE default postgres
  PGDATABASE_OVERRIDE default postgres

Examples:
  # Full load on a clean DB
  $0 --stamp 20260422_075822 --reset

  # Only public data
  $0 --stamp 20260422_075822 --data-only
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stamp) STAMP="${2:-}"; shift 2 ;;
    --dir)   DIR="${2:-}"; shift 2 ;;
    --auth-only)    SKIP_DATA=1; SKIP_STORAGE=1; shift ;;
    --data-only)    SKIP_AUTH=1; SKIP_STORAGE=1; shift ;;
    --storage-only) SKIP_AUTH=1; SKIP_DATA=1; shift ;;
    --skip-auth)    SKIP_AUTH=1; shift ;;
    --skip-data)    SKIP_DATA=1; shift ;;
    --skip-storage) SKIP_STORAGE=1; shift ;;
    --reset)        RESET=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
done

if [[ -n "$STAMP" && -n "$DIR" ]]; then
  echo "ERROR: pass only one of --stamp or --dir" >&2
  exit 1
fi

if [[ -z "$STAMP" && -z "$DIR" ]]; then
  echo "ERROR: --stamp or --dir is required" >&2
  usage 1
fi

if [[ -n "$STAMP" ]]; then
  DIR="${PROJECT_ROOT}/supabase/backups/pg_dump/${STAMP}"
fi

if [[ ! -d "$DIR" ]]; then
  echo "ERROR: backup dir not found: $DIR" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  for p in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
    if [[ -x "$p/psql" ]]; then
      export PATH="$p:$PATH"
      break
    fi
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found. Install via: brew install libpq" >&2
  exit 1
fi

export PGPASSWORD="$DBPASS"
export PGSSLMODE=disable

psql_db() {
  psql -v ON_ERROR_STOP=1 \
    -h "$HOST" -p "$PORT" -U "$DBUSER" -d "$DBNAME" \
    "$@"
}

run_sql_inline() {
  echo "==> $1"
  psql_db -c "$2"
}

run_sql_file() {
  local file="$1"
  echo "==> Applying $(basename "$file")..."
  psql_db -f "$file"
}

echo "==> Target: ${DBUSER}@${HOST}:${PORT}/${DBNAME}"
echo "==> From dir: $DIR"

if ! psql_db -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "ERROR: cannot connect to ${HOST}:${PORT} as ${DBUSER}. Is 'supabase start' running?" >&2
  exit 1
fi

if [[ "$RESET" -eq 1 ]]; then
  echo "==> Resetting data (truncate auth.*, public.*, storage.*)..."
  # Order: child tables first, but TRUNCATE ... CASCADE handles it.
  # We only wipe rows; schema stays intact (migrations already applied).
  psql_db <<'SQL'
BEGIN;
SET LOCAL session_replication_role = replica;

-- Public tables: truncate all user-defined tables in public schema
DO $$
DECLARE
  r RECORD;
  tbls TEXT := '';
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    tbls := tbls || format('%I.%I,', 'public', r.tablename);
  END LOOP;
  IF tbls <> '' THEN
    tbls := rtrim(tbls, ',');
    EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', tbls);
  END IF;
END $$;

-- Storage: wipe objects then buckets (order matters without cascade)
TRUNCATE TABLE storage.objects RESTART IDENTITY CASCADE;
TRUNCATE TABLE storage.buckets RESTART IDENTITY CASCADE;

-- Auth: wipe identity/session/user data. Keep schema migrations.
TRUNCATE TABLE
  auth.identities,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_factors,
  auth.mfa_challenges,
  auth.mfa_amr_claims,
  auth.one_time_tokens,
  auth.flow_state,
  auth.users
RESTART IDENTITY CASCADE;

COMMIT;
SQL
fi

applied_any=0

if [[ "$SKIP_AUTH" -eq 0 && -f "$DIR/auth_data.sql" ]]; then
  run_sql_file "$DIR/auth_data.sql"
  applied_any=1
fi

if [[ "$SKIP_DATA" -eq 0 && -f "$DIR/data.sql" ]]; then
  run_sql_file "$DIR/data.sql"
  applied_any=1
fi

if [[ "$SKIP_STORAGE" -eq 0 && -f "$DIR/storage_data.sql" ]]; then
  run_sql_file "$DIR/storage_data.sql"
  applied_any=1
fi

if [[ "$applied_any" -eq 0 ]]; then
  echo "WARN: nothing to apply (all scopes skipped or files missing)" >&2
  exit 2
fi

echo "==> Done."
