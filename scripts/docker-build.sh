#!/usr/bin/env bash
# scripts/docker-build.sh
# Builds the Next.js Docker image and starts the full self-contained test stack.
#
# Usage:
#   bash scripts/docker-build.sh          # build + start everything
#   bash scripts/docker-build.sh --no-cache  # force full rebuild (no layer cache)
#
# What it does:
#   1. Verifies Docker is running
#   2. Builds the h21-app image (pass --no-cache to force fresh build)
#   3. Starts all services: Supabase (DB + Auth + REST + Kong + Studio + Mailpit) + Next.js
#   4. Tails migrate container logs so you can watch migrations apply
#   5. Waits up to 3 minutes for http://localhost:3001 to be healthy
#   6. Prints access URLs on success
#
# Port map:
#   http://localhost:3001   → Next.js app  (run Cypress tests against this)
#   http://localhost:54321  → Supabase API (Cypress seeding tasks)
#   http://localhost:54323  → Supabase Studio
#   http://localhost:54324  → Mailpit inbox

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NO_CACHE=""

# ── Parse flags ──────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE="--no-cache" ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

cd "$PROJECT_DIR"

# ── 1. Verify Docker is running ───────────────────────────────────────────────
echo ""
echo "── Checking Docker ─────────────────────────────────────"
if ! docker info > /dev/null 2>&1; then
  echo "❌  Docker is not running."
  echo "    Please start Docker Desktop and try again."
  exit 1
fi
echo "  Docker is running."

# ── 2. Create a low-MTU build network (prevents ECONNRESET during npm install) ─
docker network create \
  --opt com.docker.network.driver.mtu=1450 \
  h21-build-net 2>/dev/null || true

# ── 3. Build the h21-app image ───────────────────────────────────────────────
echo ""
echo "── Building h21-app image ──────────────────────────────"
if [ -n "$NO_CACHE" ]; then
  echo "  (--no-cache: skipping all build cache)"
fi
docker compose build $NO_CACHE h21-app
echo "  Image built successfully."

# ── 4. Start the full stack ───────────────────────────────────────────────────
echo ""
echo "── Starting all services ───────────────────────────────"
docker compose up -d
echo "  Services started."

# ── 5. Watch migration logs ───────────────────────────────────────────────────
echo ""
echo "── Migration output ─────────────────────────────────────"
timeout 60 docker compose logs -f supabase-migrate 2>/dev/null || true
echo ""

# ── 6. Wait for http://localhost:3001 ────────────────────────────────────────
echo "── Waiting for Next.js app ─────────────────────────────"
READY=0
for i in $(seq 1 36); do
  if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    READY=1
    break
  fi
  printf "  attempt %d/36 — not ready yet...\n" "$i"
  sleep 5
done

if [ "$READY" -eq 0 ]; then
  echo ""
  echo "❌  App did not become healthy within 3 minutes."
  echo ""
  echo "    Check service status:"
  echo "      docker compose ps"
  echo ""
  echo "    Tail all logs:"
  echo "      docker compose logs -f"
  echo ""
  echo "    Tail app logs only:"
  echo "      docker compose logs -f h21-app"
  exit 1
fi

# ── 7. Success ────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅  Stack is up and healthy!"
echo ""
echo "  Next.js app      →  http://localhost:3001"
echo "  Supabase API     →  http://localhost:54321"
echo "  Supabase Studio  →  http://localhost:54323"
echo "  Mailpit inbox    →  http://localhost:54324"
echo ""
echo "  Run Cypress tests:"
echo "    pnpm test:e2e:docker          # headless"
echo "    pnpm test:e2e:docker:open     # interactive"
echo ""
echo "  Stop the stack:"
echo "    docker compose down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
