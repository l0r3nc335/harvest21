#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()   { echo -e "\n${GREEN}▶ $1${NC}"; }
warn()   { echo -e "${YELLOW}⚠  $1${NC}"; }
header() { echo -e "${BOLD}${CYAN}$1${NC}"; }
row()    { printf "  %-22s %s\n" "$1" "$2"; }

# ── 1. npm packages ──────────────────────────────────────────────────────────
step "Installing npm packages..."
pnpm install

# ── 2. Supabase local instance ───────────────────────────────────────────────
step "Starting local Supabase..."
if supabase status > /dev/null 2>&1; then
  warn "Supabase is already running — skipping start."
else
  supabase start
fi

# ── 3. Reset DB + run migrations + seed ─────────────────────────────────────
step "Resetting database and applying seed..."
supabase db reset --local

# ── Done — print seed summary ─────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✔ Cypress environment ready!${NC}"
echo ""

header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
header " SEEDED DATABASE ACCOUNTS"
header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${BOLD}┌─ supabase/seed.sql  (static seed, applied on db reset)${NC}"
echo ""
row "Role:" "Shared Missionary"
row "Email:" "shared@harvest21.com"
row "Password:" "password123"
row "Name:" "John Doe"
row "Destination:" "Chile"
row "Mission status:" "On-Field"
row "Page URL:" "/john-doe-chile"
echo ""
row "Church:" "First Baptist Church"
row "Church email:" "contact@firstbaptist.org"
row "Agency:" "Global Missions Agency"
row "Agency email:" "info@globalmissions.org"
row "College:" "Bible College  (Springfield, IL)"
echo ""

echo -e "  ${BOLD}┌─ cypress.config.ts  (seeded automatically before each Cypress run)${NC}"
echo ""
row "Role: Admin" "airken.99+admin@gmail.com  /  Test123!"
echo ""
row "Role: Missionary 1" "m1@h21test.local  /  Test123!"
row "Name:" "Alice Waller"
row "Page URL:" "/alice-waller"
row "Destination:" "Kenya (KE)  •  On-Field"
echo ""
row "Role: Missionary 2" "m2@h21test.local  /  Test123!"
row "Name:" "Bob Carter"
row "Page URL:" "/bob-carter"
row "Destination:" "Brazil (BR)  •  On-Field"
echo ""
row "Role: Supporter" "supporter@h21test.local  /  Test123!"
row "Name:" "Carol Smith"
echo ""
row "Role: Church contact" "church@h21test.local  /  Test123!"
row "Name:" "David Jones  (Grace Community Church)"
echo ""
row "Role: Agency contact" "agency@h21test.local  /  Test123!"
row "Name:" "Eve Brown  (Global Missions Agency)"
echo ""

header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
header " LOCAL SERVICES"
header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
row "Supabase API:" "http://127.0.0.1:54321"
row "Supabase Studio:" "http://127.0.0.1:54323"
row "Mailpit (email):" "http://127.0.0.1:54324"
row "App (after start):" "http://localhost:3000"
echo ""

header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
header " NEXT STEPS"
header "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. pnpm dev:cypress           # start Next.js with .env.cypress-local"
echo "  2. pnpm test:e2e:local        # run Cypress headless"
echo "     pnpm test:e2e:local:open   # open Cypress UI"
echo ""
