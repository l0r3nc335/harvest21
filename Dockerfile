# syntax=docker/dockerfile:1
# ── Stage: dev server ────────────────────────────────────────────────────────
# Runs `next dev` bound to 0.0.0.0 so the container port is reachable
# from the host. Environment variables are injected at runtime by
# docker-compose (env_file: .env.cypress-docker) — no secrets baked in.
#
# Usage (via docker-compose):
#   pnpm docker:build                 ← build + start (first time)
#   docker compose up -d             ← start (image already built)
#   docker compose down              ← stop
#   docker compose logs -f h21-app  ← tail app logs
# ─────────────────────────────────────────────────────────────────────────────

# node:22-slim (Debian bookworm) uses glibc, which is required for
# Next.js native ARM64 SWC binaries (@next/swc-linux-arm64-gnu).
# Alpine (musl) cannot load these binaries and falls back to broken WASM mode.
FROM node:22-slim

WORKDIR /app

# Install dependencies in a cached layer — only re-runs when lockfile changes.
# BuildKit cache mount: /root/.npm persists across builds so retries and
# subsequent builds reuse already-downloaded packages.
# Retry loop handles transient ECONNRESET on Docker's virtual network.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set maxsockets 3 \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && for i in 1 2 3; do \
      npm ci --prefer-offline 2>/dev/null || npm ci && break \
      || (echo "npm ci attempt $i failed — retrying in 15s..." && sleep 15); \
    done

# Copy application source (.dockerignore excludes .env* and node_modules)
COPY . .

# Next.js dev port
EXPOSE 3000

# --hostname 0.0.0.0 makes Next.js bind to all interfaces so Docker
# can route host:3001 → container:3000
CMD ["npx", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
