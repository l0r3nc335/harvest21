#!/usr/bin/env bash
set -euo pipefail

# =============================================================
# Supabase DB + Storage backup (pg_dump-style)
#
# Produces timestamped dumps under supabase/backups/pg_dump/<ts>/
#   * roles.sql         - cluster role definitions (skipped with --skip-roles or --auth-only)
#   * schema.sql        - public schema (tables, policies, functions)
#   * data.sql          - public schema row data
#   * auth_data.sql     - auth.users + auth.identities (with --auth/--full/--auth-only)
#   * storage_data.sql  - storage bucket + object metadata (with --storage/--full)
#   * storage/<bucket>/ - actual object blobs (with --storage-blobs/--full)
#
# Prereqs:
#   * Supabase CLI installed
#   * Project linked (`supabase link --project-ref <ref>`) OR --db-url
#
# Usage:
#   ./scripts/backup-db.sh                   # public schema + roles + data
#   ./scripts/backup-db.sh --no-data         # public schema + roles only
#   ./scripts/backup-db.sh --schema          # public schema only
#   ./scripts/backup-db.sh --data-only       # only data.sql (public table rows; no schema, no roles)
#   ./scripts/backup-db.sh --auth            # + auth.users/identities (still dumps roles + public by default)
#   ./scripts/backup-db.sh --auth-only       # only auth_data.sql (no roles.sql, schema, data)
#   ./scripts/backup-db.sh --skip-roles      # omit roles.sql (cluster roles dump)
#   ./scripts/backup-db.sh --storage         # + storage metadata
#   ./scripts/backup-db.sh --storage-blobs   # + storage metadata AND file blobs
#   ./scripts/backup-db.sh --full            # everything
#   ./scripts/backup-db.sh --db-url "postgres://..."
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$PROJECT_ROOT/supabase/backups/pg_dump/$TIMESTAMP"

MODE="full-public"
INCLUDE_AUTH=0
AUTH_ONLY=0
SKIP_ROLES=0
INCLUDE_STORAGE_META=0
INCLUDE_STORAGE_BLOBS=0
DB_URL_ARG=""
PARALLEL_JOBS=4

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-data)        MODE="no-data"; shift ;;
    --schema)         MODE="schema"; shift ;;
    --data-only)      MODE="data-only"; SKIP_ROLES=1; shift ;;
    --auth)           INCLUDE_AUTH=1; shift ;;
    --auth-only)      AUTH_ONLY=1; INCLUDE_AUTH=1; SKIP_ROLES=1; shift ;;
    --skip-roles)     SKIP_ROLES=1; shift ;;
    --storage)        INCLUDE_STORAGE_META=1; shift ;;
    --storage-blobs)  INCLUDE_STORAGE_META=1; INCLUDE_STORAGE_BLOBS=1; shift ;;
    --full)           INCLUDE_AUTH=1; INCLUDE_STORAGE_META=1; INCLUDE_STORAGE_BLOBS=1; shift ;;
    --db-url)         DB_URL_ARG="--db-url $2"; shift 2 ;;
    --jobs)           PARALLEL_JOBS=$2; shift 2 ;;
    -h|--help)        sed -n '3,35p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not found." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "==> Output dir: $OUT_DIR"
echo "==> Mode: $MODE | auth=$INCLUDE_AUTH | auth_only=$AUTH_ONLY | skip_roles=$SKIP_ROLES | storage_meta=$INCLUDE_STORAGE_META | storage_blobs=$INCLUDE_STORAGE_BLOBS"
echo

cd "$PROJECT_ROOT"

if [[ "$AUTH_ONLY" -eq 1 ]]; then
  :
elif [[ "$SKIP_ROLES" -eq 1 ]]; then
  echo "==> Skipping roles.sql (--skip-roles / --auth-only)."
else
  echo "==> Dumping roles..."
  supabase db dump $DB_URL_ARG --role-only -f "$OUT_DIR/roles.sql"
fi

if [[ "$AUTH_ONLY" -eq 1 ]]; then
  echo "==> Skipping schema.sql + data.sql (--auth-only)."
elif [[ "$MODE" == "data-only" ]]; then
  echo "==> Dumping public-schema data only (--data-only; no schema.sql, no auth/storage rows)..."
  supabase db dump $DB_URL_ARG --data-only --use-copy --schema public -f "$OUT_DIR/data.sql"
else
  echo "==> Dumping public schema (RLS, functions, triggers)..."
  supabase db dump $DB_URL_ARG -f "$OUT_DIR/schema.sql"

  if [[ "$MODE" == "full-public" ]]; then
    echo "==> Dumping public data (excluding auth.audit_log_entries)..."
    supabase db dump $DB_URL_ARG --data-only --use-copy \
      --exclude auth.audit_log_entries \
      -f "$OUT_DIR/data.sql"
  fi
fi

if [[ "$INCLUDE_AUTH" -eq 1 ]]; then
  echo "==> Dumping auth.users + auth.identities..."
  supabase db dump $DB_URL_ARG \
    --schema auth \
    --data-only --use-copy \
    --exclude auth.sessions \
    --exclude auth.refresh_tokens \
    --exclude auth.mfa_factors \
    --exclude auth.mfa_challenges \
    --exclude auth.mfa_amr_claims \
    --exclude auth.sso_providers \
    --exclude auth.sso_domains \
    --exclude auth.saml_providers \
    --exclude auth.saml_relay_states \
    --exclude auth.flow_state \
    --exclude auth.one_time_tokens \
    --exclude auth.audit_log_entries \
    -f "$OUT_DIR/auth_data.sql"
fi

if [[ "$INCLUDE_STORAGE_META" -eq 1 ]]; then
  echo "==> Dumping storage.buckets + storage.objects metadata..."
  supabase db dump $DB_URL_ARG \
    --schema storage \
    --data-only --use-copy \
    -f "$OUT_DIR/storage_data.sql"
fi

if [[ "$INCLUDE_STORAGE_BLOBS" -eq 1 ]]; then
  echo "==> Dumping storage blobs (actual files)..."
  mkdir -p "$OUT_DIR/storage"

  BUCKETS=$(supabase storage ls ss:/// 2>/dev/null | awk '{print $NF}' | sed 's|/$||' | grep -v '^$' || true)

  if [[ -z "$BUCKETS" ]]; then
    echo "   (no buckets found or no access)"
  else
    while IFS= read -r bucket; do
      [[ -z "$bucket" ]] && continue
      echo "   -> bucket: $bucket"
      mkdir -p "$OUT_DIR/storage/$bucket"
      supabase storage cp -r "ss:///$bucket" "$OUT_DIR/storage/$bucket" \
        --jobs "$PARALLEL_JOBS" 2>&1 | sed 's/^/      /' || {
          echo "   WARN: failed to fully back up bucket '$bucket'" >&2
        }
    done <<< "$BUCKETS"
  fi
fi

if [[ "$MODE" == "schema" ]]; then
  rm -f "$OUT_DIR/roles.sql"
fi


echo
echo "==> Backup complete:"
du -sh "$OUT_DIR"/* 2>/dev/null || ls -lh "$OUT_DIR"

cat > "$OUT_DIR/README.md" <<EOF
# DB + Storage Backup — $TIMESTAMP

Generated by \`scripts/backup-db.sh\`.

## Files

- \`roles.sql\`         — cluster role + grant definitions
- \`schema.sql\`        — public schema, RLS policies, functions, triggers
- \`data.sql\`          — public table data
- \`auth_data.sql\`     — auth.users + auth.identities (persistent auth data)
- \`storage_data.sql\`  — storage.buckets + storage.objects metadata
- \`storage/<bucket>/\` — actual object blobs (if --storage-blobs)

## Notes

- Auth sessions/tokens/MFA excluded — transient, unsafe to restore.
- \`auth.users.encrypted_password\` IS included. Treat this dump as highly sensitive.
- Storage blobs are downloaded via Supabase Storage API (parallel jobs: configurable via \`--jobs\`).

## Restore

### DB
\`\`\`bash
psql "\$DATABASE_URL" -f roles.sql
psql "\$DATABASE_URL" -f schema.sql
psql "\$DATABASE_URL" -f data.sql
psql "\$DATABASE_URL" -f auth_data.sql       # optional
psql "\$DATABASE_URL" -f storage_data.sql    # optional
\`\`\`

### Storage blobs
\`\`\`bash
# Re-upload each bucket (run from this backup dir):
for bucket in storage/*/; do
  bucket_name=\$(basename "\$bucket")
  supabase storage cp -r "\$bucket" "ss:///\$bucket_name" --jobs 4
done
\`\`\`

Note: restoring blobs re-creates files but does NOT recreate bucket ACLs
or signed URL tokens. Make sure bucket metadata is restored first via
\`storage_data.sql\`.

For a partial RLS-only restore, use
\`supabase/backups/<ts>_rls_snapshot_restore.sql\` instead.
EOF

echo "==> Wrote $OUT_DIR/README.md"
