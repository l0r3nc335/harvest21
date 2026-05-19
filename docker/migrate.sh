#!/bin/sh
# docker/migrate.sh
# Runs as a short-lived init container.
# Applies all timestamped migrations then seed.sql, then exits.
# supabase-rest, supabase-auth, and h21-app depend on this container completing successfully.

set -e

PGHOST="${PGHOST:-supabase-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD

echo ""
echo "── Waiting for PostgreSQL ──────────────────────────────"
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q; do
  printf "."
  sleep 2
done
echo ""
echo "  PostgreSQL is ready."

# The supabase/postgres image takes extra time to initialize the auth/storage
# schemas after pg_isready returns. Wait for the auth.users table.
echo ""
echo "── Waiting for Supabase auth schema ────────────────────"
until psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
      -c "SELECT 1 FROM auth.users LIMIT 1;" > /dev/null 2>&1; do
  printf "."
  sleep 3
done
echo ""
echo "  auth schema is ready."

echo ""
echo "── Configuring Supabase system users ───────────────────"
# supabase_auth_admin / supabase_storage_admin are reserved roles created by
# the supabase/postgres image with no password. GoTrue and Storage need to
# authenticate as these roles, so we set their passwords using supabase_admin
# (a superuser). This is safe — these are local dev demo credentials only.
PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U supabase_admin -d "$PGDATABASE" \
     -c "ALTER USER supabase_auth_admin WITH PASSWORD '${PGPASSWORD}'; ALTER USER supabase_storage_admin WITH PASSWORD '${PGPASSWORD}';" \
     > /dev/null 2>&1 || true
echo "  System users configured."

echo ""
echo "── Running migrations ──────────────────────────────────"
# Only run timestamped migrations (20XXXXXX*.sql) in filename order.
# Un-timestamped files in the migrations dir are legacy duplicates — skip them.
for f in $(find /migrations -name "20*.sql" | sort); do
  echo "  → $(basename "$f")"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
       -v ON_ERROR_STOP=0 -q -f "$f" 2>&1 | grep -v "^$" || true
done

echo ""
echo "── Running seed.sql ────────────────────────────────────"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
     -v ON_ERROR_STOP=0 -q -f /seed.sql 2>&1 | grep -v "^$" || true

echo ""
echo "✅  Migrations and seed complete."
