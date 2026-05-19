#!/usr/bin/env bash
set -euo pipefail
set -o pipefail

# Apply data-only dumps + optional Storage blobs (same layout as backup-db.sh).
# Expects auth_data.sql, data.sql, storage_data.sql in --dir; optional storage/<bucket>/...
#
# Usage:
#   ./scripts/upload-db-data.sh --ref <project_ref> --pw '<db_password>' --dir <path/to/backup>
#   ./scripts/upload-db-data.sh --ref <ref> --pw '<pw>' --stamp 20260422_075822
#     → <repo>/supabase/backups/pg_dump/20260422_075822
#   ./scripts/upload-db-data.sh ... --bucket h21-dev --jobs 8
#
# Order: auth_data.sql → data.sql → storage_data.sql → upload files listed in storage.objects (if storage/ exists)
# For each row (bucket_id, name), uploads: backup_dir/storage/<bucket_id>/<name> → ss:///<bucket_id>/<name>
# (matches Dashboard: bucket h21-dev + path agencies/1/videos/file.mp4 from name column)
# SQL: psql to db.<ref>.supabase.co. Blobs: supabase storage cp --experimental (needs supabase login + link to --ref).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REF=""
PW=""
DIR=""
STAMP=""
BUCKET=""
PARALLEL_JOBS=4
SKIP_BLOBS=0
TRUNCATE_AUDIT_LOG=1
SKIP_AUTH_DATA=0
SKIP_DATA=0
SKIP_STORAGE_DATA=0
FILTER_AUTH_DUPS=1
UPSERT_AUTH=0
FILTER_WORK=""
UPSERT_WORK=""

usage() {
  cat <<EOF
Usage: $0 --ref <project_ref> --pw <database_password> (--dir <backup_dir> | --stamp <folder>) [scope flags] [options]

  --stamp <folder>  backup at <repo>/supabase/backups/pg_dump/<folder> (same files as --dir)
  --dir <path>      full path to backup folder (exclusive with --stamp)

  Scope flags (combinable; default = upload everything that exists):
    --auth-only         only apply auth_data.sql (skips data.sql, storage_data.sql, blobs)
    --data-only         only apply data.sql        (skips auth_data.sql, storage_data.sql, blobs)
    --storage-only      only apply storage_data.sql + blobs (skips auth_data.sql, data.sql)
    --skip-auth-data    skip auth_data.sql
    --skip-data         skip data.sql
    --skip-storage-data skip storage_data.sql
    --skip-blobs        skip uploading storage/<bucket>/... blobs

  Files used per scope (only the relevant ones must exist):
    auth_data.sql, data.sql, storage_data.sql; blobs in storage/<bucket_id>/<name>
  Blobs: rows from storage.objects after storage_data.sql; each file
    backup_dir/storage/<bucket_id>/<name> e.g. .../h21-dev/agencies/1/videos/demo.mp4
  → ss:///<bucket_id>/<name>

  --bucket <name>   only upload objects whose bucket_id matches (default: all buckets)
  --jobs N          parallel blob uploads (default: 4)

  --keep-audit-log  do not truncate auth.audit_log_entries before data.sql (default: truncate to avoid duplicate PK)

  --no-filter-auth-dups  apply SQL as-is (default: skip COPY rows when id exists for any public/auth/storage table whose sole PK column is id, plus auth.users email dedupe)

  --upsert-auth     apply auth_data.sql via TEMP staging + UPSERT so existing
                    auth.users rows get their encrypted_password (and related
                    fields) refreshed from the dump. Skips the row-skip filter
                    for auth_data.sql. Use together with --auth-only or the
                    default full-upload flow.

  Blob upload requires: supabase CLI, supabase login, supabase link --project-ref <same as --ref>
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="${2:-}"; shift 2 ;;
    --pw)  PW="${2:-}"; shift 2 ;;
    --dir) DIR="${2:-}"; shift 2 ;;
    --stamp) STAMP="${2:-}"; shift 2 ;;
    --bucket) BUCKET="${2:-}"; shift 2 ;;
    --jobs) PARALLEL_JOBS="${2:-}"; shift 2 ;;
    --skip-blobs) SKIP_BLOBS=1; shift ;;
    --keep-audit-log) TRUNCATE_AUDIT_LOG=0; shift ;;
    --skip-auth-data) SKIP_AUTH_DATA=1; shift ;;
    --skip-data) SKIP_DATA=1; shift ;;
    --skip-storage-data) SKIP_STORAGE_DATA=1; shift ;;
    --auth-only)
      SKIP_DATA=1; SKIP_STORAGE_DATA=1; SKIP_BLOBS=1
      TRUNCATE_AUDIT_LOG=0
      shift ;;
    --data-only)
      SKIP_AUTH_DATA=1; SKIP_STORAGE_DATA=1; SKIP_BLOBS=1
      shift ;;
    --storage-only)
      SKIP_AUTH_DATA=1; SKIP_DATA=1
      TRUNCATE_AUDIT_LOG=0
      shift ;;
    --no-filter-auth-dups) FILTER_AUTH_DUPS=0; shift ;;
    --upsert-auth) UPSERT_AUTH=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$REF" || -z "$PW" ]]; then
  echo "ERROR: --ref and --pw are required." >&2
  usage 1
fi

if [[ -n "$DIR" && -n "$STAMP" ]]; then
  echo "ERROR: use either --dir or --stamp, not both." >&2
  exit 1
fi

if [[ -z "$DIR" && -z "$STAMP" ]]; then
  echo "ERROR: provide --dir <path> or --stamp <folder under supabase/backups/pg_dump/>." >&2
  usage 1
fi

if [[ -n "$STAMP" ]]; then
  if [[ "$STAMP" == *"/"* || "$STAMP" == *".."* ]]; then
    echo "ERROR: --stamp must be a single folder name (no / or ..)." >&2
    exit 1
  fi
  DIR="${PROJECT_ROOT}/supabase/backups/pg_dump/${STAMP}"
fi

if ! [[ "$PARALLEL_JOBS" =~ ^[0-9]+$ ]] || (( PARALLEL_JOBS < 1 )); then
  echo "ERROR: --jobs must be a positive integer." >&2
  exit 1
fi

if [[ ! -d "$DIR" ]]; then
  echo "ERROR: backup directory not found: $DIR" >&2
  exit 1
fi

DIR="$(cd "$DIR" && pwd)"

REQUIRED_FILES=()
[[ "$SKIP_AUTH_DATA"    -eq 0 ]] && REQUIRED_FILES+=("auth_data.sql")
[[ "$SKIP_DATA"         -eq 0 ]] && REQUIRED_FILES+=("data.sql")
[[ "$SKIP_STORAGE_DATA" -eq 0 ]] && REQUIRED_FILES+=("storage_data.sql")

if (( ${#REQUIRED_FILES[@]} == 0 )) && [[ "$SKIP_BLOBS" -eq 1 ]]; then
  echo "ERROR: nothing to do (all SQL skipped and --skip-blobs)." >&2
  exit 1
fi

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$DIR/$f" ]]; then
    echo "ERROR: missing file: $DIR/$f" >&2
    exit 1
  fi
done

if ! command -v psql >/dev/null 2>&1; then
  for _pq in \
    "/opt/homebrew/opt/libpq/bin" \
    "/usr/local/opt/libpq/bin" \
    "/Applications/Postgres.app/Contents/Versions/latest/bin"; do
    if [[ -x "${_pq}/psql" ]]; then
      PATH="${_pq}:${PATH}"
      export PATH
      break
    fi
  done
fi
if ! command -v psql >/dev/null 2>&1 && command -v pg_dump >/dev/null 2>&1; then
  _pq="$(dirname "$(command -v pg_dump)")"
  if [[ -x "${_pq}/psql" ]]; then
    PATH="${_pq}:${PATH}"
    export PATH
  fi
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found. brew install libpq then add to PATH, e.g.:" >&2
  echo "  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"   # Apple Silicon" >&2
  echo "  export PATH=\"/usr/local/opt/libpq/bin:\$PATH\"     # Intel" >&2
  exit 1
fi

HOST="${PGHOST_OVERRIDE:-db.${REF}.supabase.co}"
PORT="${PGPORT_OVERRIDE:-5432}"
DBNAME=postgres
DBUSER="${PGUSER_OVERRIDE:-postgres}"

cleanup() {
  [[ -n "${FILTER_WORK:-}" && -d "$FILTER_WORK" ]] && rm -rf "$FILTER_WORK"
  [[ -n "${UPSERT_WORK:-}" && -d "$UPSERT_WORK" ]] && rm -rf "$UPSERT_WORK"
  unset PGPASSWORD 2>/dev/null || true
  unset PGSSLMODE 2>/dev/null || true
}
trap cleanup EXIT

export PGPASSWORD="$PW"
export PGSSLMODE=require

psql_db() {
  psql -v ON_ERROR_STOP=1 \
    -h "$HOST" -p "$PORT" -U "$DBUSER" -d "$DBNAME" \
    "$@"
}

run_sql() {
  local file="$1"
  echo "==> Applying $(basename "$file")..."
  psql_db -f "$file"
}

run_sql_inline() {
  echo "==> $1"
  psql_db -c "$2"
}

write_skip_key_files() {
  local d="${1:?}"
  local sk="${d}/all_skips.tsv"
  local plan="${d}/plan.sql"

  : >"$sk"

  psql_db -At -F $'\t' -c "
WITH cand AS (
  SELECT DISTINCT n.nspname AS sch, c.relname AS rel
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indrelid = c.oid
                  AND (i.indisprimary OR i.indisunique)
                  AND array_length(i.indkey, 1) = 1
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
  WHERE n.nspname IN ('public', 'auth', 'storage')
    AND c.relkind = 'r'
    AND a.attname = 'id'
)
SELECT format(
  E'COPY (SELECT %L AS tbl, lower(id::text) AS rid FROM %I.%I) TO STDOUT;',
  sch || '.' || rel, sch, rel
)
FROM cand
ORDER BY sch, rel;
" >"$plan" || true

  if [[ -s "$plan" ]]; then
    psql -v ON_ERROR_STOP=0 \
      -h "$HOST" -p "$PORT" -U "$DBUSER" -d "$DBNAME" \
      -q -t -A -f "$plan" >"$sk" 2>/dev/null || true
  fi

  { psql_db -At -c "SELECT lower(trim(email)) FROM auth.users WHERE email IS NOT NULL AND trim(email) <> '';" || true; } >"$d/e"

  { psql_db -At -c "
SELECT n.nspname || '.' || c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'auth', 'storage')
  AND NOT has_table_privilege('postgres', c.oid, 'INSERT');
" || true; } >"$d/no_insert"

  echo "   skip-list rows: $(wc -l <"$sk" | tr -d ' ')   email-list rows: $(wc -l <"$d/e" | tr -d ' ')   no-insert tables: $(wc -l <"$d/no_insert" | tr -d ' ')"
}

filter_sql_dedupe_copy() {
  local src="$1" out="$2" skfile="$3" efile="$4" nifile="$5"
  awk -v skfile="$skfile" -v efile="$efile" -v nifile="$nifile" '
function load_ids(path, arr,   line) {
  while ((getline line < path) > 0) {
    gsub(/\r/, "", line)
    sub(/^[ \t]+/, "", line)
    sub(/[ \t]+$/, "", line)
    if (line != "") arr[line] = 1
  }
  close(path)
}
function load_skips(path,   line, p, tbl, rid, rnorm) {
  while ((getline line < path) > 0) {
    gsub(/\r/, "", line)
    p = index(line, "\t")
    if (p > 0) {
      tbl = substr(line, 1, p - 1)
      rid = substr(line, p + 1)
      sub(/[ \t]+$/, "", rid)
      rnorm = lc_email(rid)
      SK[tbl SUBSEP rnorm] = 1
    }
  }
  close(path)
}
function named_col_index_from_copy(line, want,   s, rest, n, arr, i) {
  s = index(line, "(")
  if (match(line, /\)[[:space:]]+FROM[[:space:]]+stdin[[:space:]]*;/) == 0 || RSTART <= s) return 0
  rest = substr(line, s + 1, RSTART - s - 1)
  gsub(/"/, "", rest)
  n = split(rest, arr, ",")
  for (i = 1; i <= n; i++) {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", arr[i])
    if (arr[i] == want) return i
  }
  return 0
}
function lc_email(s,   t) {
  t = s
  gsub(/^[ \t]+|[ \t]+$/, "", t)
  gsub(/A/, "a", t); gsub(/B/, "b", t); gsub(/C/, "c", t); gsub(/D/, "d", t)
  gsub(/E/, "e", t); gsub(/F/, "f", t); gsub(/G/, "g", t); gsub(/H/, "h", t)
  gsub(/I/, "i", t); gsub(/J/, "j", t); gsub(/K/, "k", t); gsub(/L/, "l", t)
  gsub(/M/, "m", t); gsub(/N/, "n", t); gsub(/O/, "o", t); gsub(/P/, "p", t)
  gsub(/Q/, "q", t); gsub(/R/, "r", t); gsub(/S/, "s", t); gsub(/T/, "t", t)
  gsub(/U/, "u", t); gsub(/V/, "v", t); gsub(/W/, "w", t); gsub(/X/, "x", t)
  gsub(/Y/, "y", t); gsub(/Z/, "z", t)
  return t
}
function copy_quoted_target(line,   a, n) {
  if (substr(line, 1, 5) != "COPY ") return ""
  n = split(line, a, "\"")
  if (n < 5) return ""
  if (a[3] != ".") return ""
  return a[2] "." a[4]
}
function allow_schema(ct,   z) {
  split(ct, z, ".")
  if (length(z) < 2) return 0
  return (z[1] == "public" || z[1] == "auth" || z[1] == "storage")
}
BEGIN {
  FS = "\t"
  OFS = "\t"
  load_skips(skfile)
  load_ids(efile, E)
  load_ids(nifile, NOINS)
  mode = 0
  curtbl = ""
  ididx = 0
  eidx = 0
}
{
  if (mode == 0) {
    ct = copy_quoted_target($0)
    if (ct != "" && allow_schema(ct)) {
      if (ct in NOINS) {
        mode = 2
        next
      }
      ididx = named_col_index_from_copy($0, "id")
      if (ididx > 0) {
        mode = 1
        curtbl = ct
        eidx = 0
        delete SEENID
        if (ct == "auth.users") {
          eidx = named_col_index_from_copy($0, "email")
          delete SEEN
        }
        print
        next
      }
    }
    print
    next
  }
  if (mode == 2) {
    if ($0 == "\\.") {
      mode = 0
      curtbl = ""
    }
    next
  }
  if ($0 == "\\.") {
    if (curtbl == "auth.users") delete SEEN
    delete SEENID
    mode = 0
    curtbl = ""
    print
    next
  }
  pk = $(ididx)
  sub(/^[ \t]+|[ \t]+$/, "", pk)
  pknorm = lc_email(pk)
  if ((curtbl SUBSEP pknorm) in SK) next
  if ((curtbl SUBSEP pknorm) in SEENID) next
  if (curtbl == "auth.users" && eidx > 0) {
    eml = lc_email($(eidx))
    if (eml != "" && eml in E) next
    if (eml != "" && eml in SEEN) next
    if (eml != "") SEEN[eml] = 1
  }
  SEENID[pknorm] = 1
  print
}
' "$src" >"$out"
}

transform_auth_for_upsert() {
  local src="$1" out="$2"

  cat >"$out" <<'SQL_HEADER'
BEGIN;
SET LOCAL session_replication_role = replica;

CREATE TEMP TABLE _stg_auth_users      (LIKE auth.users      INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TEMP TABLE _stg_auth_identities (LIKE auth.identities INCLUDING DEFAULTS) ON COMMIT DROP;

SQL_HEADER

  awk '
  BEGIN { mode = 0 }
  {
    if (mode == 0) {
      if ($0 ~ /^COPY "auth"\."users" \(/) {
        line = $0
        sub(/COPY "auth"\."users"/, "COPY _stg_auth_users", line)
        print line
        mode = 1
        next
      }
      if ($0 ~ /^COPY "auth"\."identities" \(/) {
        line = $0
        sub(/COPY "auth"\."identities"/, "COPY _stg_auth_identities", line)
        print line
        mode = 1
        next
      }
      print
      next
    }
    print
    if ($0 == "\\.") mode = 0
  }
  ' "$src" >>"$out"

  cat >>"$out" <<'SQL_FOOTER'

UPDATE auth.users u SET
  encrypted_password  = s.encrypted_password,
  email_confirmed_at  = COALESCE(s.email_confirmed_at, u.email_confirmed_at),
  raw_app_meta_data   = s.raw_app_meta_data,
  raw_user_meta_data  = s.raw_user_meta_data,
  updated_at          = GREATEST(s.updated_at, u.updated_at),
  last_sign_in_at     = COALESCE(s.last_sign_in_at, u.last_sign_in_at),
  banned_until        = s.banned_until,
  is_anonymous        = s.is_anonymous
FROM _stg_auth_users s
WHERE lower(u.email) = lower(s.email)
  AND u.id <> s.id;

DELETE FROM _stg_auth_users s
USING auth.users u
WHERE lower(u.email) = lower(s.email) AND u.id <> s.id;

DO $upsert_users$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO col_list
  FROM pg_attribute
  WHERE attrelid = 'auth.users'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attgenerated = '';

  EXECUTE format(
    'INSERT INTO auth.users (%1$s) SELECT %1$s FROM _stg_auth_users '
    'ON CONFLICT (id) DO UPDATE SET '
    '  encrypted_password  = EXCLUDED.encrypted_password, '
    '  email               = EXCLUDED.email, '
    '  email_confirmed_at  = COALESCE(EXCLUDED.email_confirmed_at, auth.users.email_confirmed_at), '
    '  raw_app_meta_data   = EXCLUDED.raw_app_meta_data, '
    '  raw_user_meta_data  = EXCLUDED.raw_user_meta_data, '
    '  updated_at          = GREATEST(EXCLUDED.updated_at, auth.users.updated_at), '
    '  last_sign_in_at     = COALESCE(EXCLUDED.last_sign_in_at, auth.users.last_sign_in_at), '
    '  phone               = EXCLUDED.phone, '
    '  phone_confirmed_at  = EXCLUDED.phone_confirmed_at, '
    '  banned_until        = EXCLUDED.banned_until, '
    '  is_anonymous        = EXCLUDED.is_anonymous, '
    '  is_sso_user         = EXCLUDED.is_sso_user, '
    '  role                = EXCLUDED.role, '
    '  aud                 = EXCLUDED.aud',
    col_list
  );
END
$upsert_users$;

DELETE FROM _stg_auth_identities s
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

DO $upsert_identities$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO col_list
  FROM pg_attribute
  WHERE attrelid = 'auth.identities'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attgenerated = '';

  EXECUTE format(
    'INSERT INTO auth.identities (%1$s) SELECT %1$s FROM _stg_auth_identities '
    'ON CONFLICT DO NOTHING',
    col_list
  );
END
$upsert_identities$;

COMMIT;
SQL_FOOTER
}

echo "==> Target: $DBUSER@$HOST:$PORT/$DBNAME"
echo "==> From dir: $DIR"
echo

if [[ "$SKIP_AUTH_DATA" -eq 1 ]]; then
  echo "==> Skipping auth_data.sql (--skip-auth-data)."
elif [[ "$UPSERT_AUTH" -eq 1 ]]; then
  UPSERT_WORK="$(mktemp -d)"
  echo "==> Applying auth_data.sql via TEMP staging + UPSERT (refreshes encrypted_password on existing users)..."
  transform_auth_for_upsert "$DIR/auth_data.sql" "$UPSERT_WORK/upsert.sql"
  if ! psql_db -f "$UPSERT_WORK/upsert.sql"; then
    echo "ERROR: auth_data.sql upsert failed. Inspect $UPSERT_WORK/upsert.sql or try --skip-auth-data." >&2
    exit 1
  fi
  rm -rf "$UPSERT_WORK"
  UPSERT_WORK=""
elif [[ "$FILTER_AUTH_DUPS" -eq 1 ]]; then
  FILTER_WORK="$(mktemp -d)"
  write_skip_key_files "$FILTER_WORK"
  echo "==> Applying auth_data.sql (skipping COPY rows when id exists for any table with sole PK=id in public/auth/storage; auth.users email dedupe)..."
  filter_sql_dedupe_copy "$DIR/auth_data.sql" "$FILTER_WORK/filtered.sql" \
    "$FILTER_WORK/all_skips.tsv" "$FILTER_WORK/e" "$FILTER_WORK/no_insert"
  if ! psql_db -f "$FILTER_WORK/filtered.sql"; then
    echo "ERROR: auth_data.sql failed after row filter. Try --no-filter-auth-dups or --skip-auth-data." >&2
    exit 1
  fi
  rm -rf "$FILTER_WORK"
  FILTER_WORK=""
else
  echo "==> Applying auth_data.sql..."
  if ! psql_db -f "$DIR/auth_data.sql"; then
    echo "ERROR: auth_data.sql failed. Try --skip-auth-data or enable default row filter (omit --no-filter-auth-dups)." >&2
    exit 1
  fi
fi

if [[ "$SKIP_DATA" -eq 1 ]]; then
  echo "==> Skipping data.sql (--skip-data / --auth-only / --storage-only)."
else
  if [[ "$TRUNCATE_AUDIT_LOG" -eq 1 ]]; then
    run_sql_inline "Truncating auth.audit_log_entries (prevents duplicate key vs dump)..." \
      "TRUNCATE auth.audit_log_entries;"
  fi

  if [[ "$FILTER_AUTH_DUPS" -eq 1 ]]; then
    FILTER_WORK="$(mktemp -d)"
    write_skip_key_files "$FILTER_WORK"
    echo "==> Applying data.sql (same skip list refreshed after auth import)..."
    filter_sql_dedupe_copy "$DIR/data.sql" "$FILTER_WORK/data_filtered.sql" \
      "$FILTER_WORK/all_skips.tsv" "$FILTER_WORK/e" "$FILTER_WORK/no_insert"
    if ! psql_db -f "$FILTER_WORK/data_filtered.sql"; then
      echo "ERROR: data.sql failed after row filter. Try --no-filter-auth-dups." >&2
      exit 1
    fi
    rm -rf "$FILTER_WORK"
    FILTER_WORK=""
  else
    run_sql "$DIR/data.sql"
  fi
fi

if [[ "$SKIP_STORAGE_DATA" -eq 1 ]]; then
  echo "==> Skipping storage_data.sql (--skip-storage-data / --auth-only / --data-only)."
else
  if [[ "$FILTER_AUTH_DUPS" -eq 1 ]]; then
    FILTER_WORK="$(mktemp -d)"
    write_skip_key_files "$FILTER_WORK"
    echo "==> Applying storage_data.sql (same skip list refreshed)..."
    filter_sql_dedupe_copy "$DIR/storage_data.sql" "$FILTER_WORK/storage_filtered.sql" \
      "$FILTER_WORK/all_skips.tsv" "$FILTER_WORK/e" "$FILTER_WORK/no_insert"
    if ! psql_db -f "$FILTER_WORK/storage_filtered.sql"; then
      echo "ERROR: storage_data.sql failed after row filter. Try --no-filter-auth-dups." >&2
      exit 1
    fi
    rm -rf "$FILTER_WORK"
    FILTER_WORK=""
  else
    run_sql "$DIR/storage_data.sql"
  fi
fi

if [[ "$SKIP_BLOBS" -eq 0 && -d "$DIR/storage" ]]; then
  if ! command -v supabase >/dev/null 2>&1; then
    echo "ERROR: supabase CLI not found; install it or use --skip-blobs." >&2
    exit 1
  fi
  echo
  echo "==> Uploading storage blobs (storage.objects → local storage/<bucket_id>/<name> → ss:///)..."
  cd "$PROJECT_ROOT"

  bucket_filter_sql=""
  if [[ -n "$BUCKET" ]]; then
    bucket_filter_sql="AND bucket_id = '${BUCKET//\'/\'\'}'"
  fi

  list_tmp="$(mktemp)"
  PGPASSWORD="$PW" PGSSLMODE=require psql_db -At -F $'\t' -c \
    "SELECT bucket_id, name FROM storage.objects
     WHERE name IS NOT NULL AND name <> '' AND bucket_id IS NOT NULL
     ${bucket_filter_sql}
     ORDER BY bucket_id, name;" >"$list_tmp"

  uploaded=0
  missing=0
  pending=0

  while IFS= read -r row || [[ -n "${row:-}" ]]; do
    [[ -z "${row:-}" ]] && continue
    IFS=$'\t' read -r bucket_id object_name <<<"$row"
    [[ -z "${bucket_id:-}" || -z "${object_name:-}" ]] && continue
    if [[ "$object_name" =~ (^|/)\.\.(/|$) ]]; then
      echo "   SKIP (unsafe path): $bucket_id / $object_name" >&2
      continue
    fi
    local_file="$DIR/storage/${bucket_id}/${object_name}"
    if [[ ! -f "$local_file" ]]; then
      missing=$((missing + 1))
      continue
    fi
    (
      set +e
      set -o pipefail
      supabase --workdir "$PROJECT_ROOT" storage cp --experimental \
        "$local_file" "ss:///${bucket_id}/${object_name}" 2>&1 | sed 's/^/      /'
      exit "${PIPESTATUS[0]}"
    ) &
    pending=$((pending + 1))
    if (( pending % PARALLEL_JOBS == 0 )); then
      wait || true
    fi
    uploaded=$((uploaded + 1))
  done <"$list_tmp"
  wait || true
  rm -f "$list_tmp"

  echo "   attempted=$uploaded  missing_local=$missing  (parallel jobs: $PARALLEL_JOBS; check logs above for failures)"
elif [[ "$SKIP_BLOBS" -eq 1 ]]; then
  echo
  echo "==> Skipping storage blobs (--skip-blobs)."
else
  echo
  echo "==> No $DIR/storage directory; blob upload skipped."
fi

echo
echo "==> Done."
