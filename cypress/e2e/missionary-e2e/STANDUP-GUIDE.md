# Missionary E2E Test Suite — Standup Guide

**Branch:** `m4-develop-missionary-e2e`
**Date:** 2026-04-09
**Duration to run full suite:** ~4–6 minutes

---

## What Was Built

A full end-to-end test suite for the missionary features of Harvest21. Covers the complete user lifecycle across four roles: **admin**, **missionary**, **supporter**, and **cross-role independence**.

### Test Files (6 spec files, 72 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `00-admin-create-entities.cy.ts` | 12 | Admin panel, missionary/donor creation, seeded accounts |
| `missionary/01-settings-account.cy.ts` | 9 | Account tab, name fields, email, save, security tab |
| `missionary/02-settings-page-details.cy.ts` | 9 | Page URL, biography, mission status, preview button |
| `missionary/04-followers.cy.ts` | 9 | Follower list, approve/deny requests, DB state |
| `missionary/05-messaging.cy.ts` | 4 | Conversation list, message compose, send |
| `supporter/01-follow-and-message.cy.ts` | 10 | Follow flow, pending state, approval, messaging |
| `cross-missionary/01-two-missionary-comparison.cy.ts` | 8 | M1/M2 isolation, page URLs, follower independence |

**Current pass rate: 70/72 (97%)**

### Infrastructure Built

- **Seed tasks** in `cypress.config.ts`: `seedMissionary`, `seedPublicUser`, `getMissionaryId`, `createFollowRequest`, `acceptFollowRequest`, `resetFollowerStatus`, `getFollowerCount`
- **Auth caching** via `cy.session()` with `cacheAcrossSpecs: true` — login once per role per suite run
- **Custom commands**: `cy.loginAs(role)`, `cy.navigateToSettingsTab(tabId)`, `cy.login(email, password)`
- Two seeded test missionaries: **Alice Waller** (`/alice-waller`) and **Bob Carter** (`/bob-carter`)
- One seeded test supporter: **Carol Smith**
- Separate UI-test accounts for admin-creation tests (`ui-test-m1@h21test.local`)

### Key Bugs Found and Fixed

1. **`note` column missing from local DB** — `missionary_followers` table lacked the `note` column; applied migration manually
2. **`listUsers()` admin API fails locally** — switched all user lookups to `from('users').select('user_id').eq('email', ...)`
3. **Supabase join syntax `page:pages(page_url)` silently returns null** — split into two separate queries
4. **`is_published: false` on seeded pages** — public missionary pages returned 404-equivalent UI; seed now sets `is_published: true`
5. **Fixed-position sidebar tabs** — `should('be.visible')` fails for position:fixed elements outside viewport; changed to `should('exist')` + `click({ force: true })`
6. **Page URL stored in `<input value>` not as text** — `cy.contains()` can't find it; changed to `cy.get('input[placeholder="page-url"]').should('have.value', ...)`
7. **Seed idempotency** — seed now upserts by email (unique), resets name/page_url on re-run instead of failing on duplicate key

---

## Running the Suite

```bash
# Full suite (headless)
pnpm cypress run --spec "cypress/e2e/missionary-e2e/**/*.cy.ts"

# Interactive (headed)
pnpm cypress open

# Single spec
pnpm cypress run --spec "cypress/e2e/missionary-e2e/missionary/01-settings-account.cy.ts"
```

---

## Local Environment Requirements

### 1. Local Supabase

```bash
supabase start
```

Verify it's running:
```bash
supabase status
```

Expected:
- API URL: `http://127.0.0.1:54321`
- DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Anon key and service_role key available

### 2. Apply All Migrations

The local DB must have all migrations applied, including any that were added after the last `supabase start`:

```bash
supabase db reset   # WARNING: destroys local data — re-seeds from migrations
```

Or apply a specific migration manually:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "ALTER TABLE public.missionary_followers ADD COLUMN IF NOT EXISTS note text CHECK (char_length(note) <= 100);"
```

**Known required column:** `missionary_followers.note` — if missing, follow request submissions silently fail.

### 3. Dev Server

```bash
pnpm dev:cypress
```

This starts Next.js on `http://localhost:3000` with Cypress-compatible env vars.

### 4. Environment Files

Required files (not committed):
- `.env.local` — must include Supabase URL, anon key, service_role key
- `cypress.env.json` — must include:

```json
{
  "testAccounts": {
    "admin": { "email": "admin@h21test.local", "password": "..." },
    "missionary1": { "email": "m1@h21test.local", "password": "..." },
    "missionary2": { "email": "m2@h21test.local", "password": "..." },
    "supporter": { "email": "supporter@h21test.local", "password": "..." }
  }
}
```

### 5. Seed Data

The `cypress.config.ts` `setupNodeEvents` block auto-seeds before tests run. It creates:
- Auth users for all 4 test accounts (if they don't exist)
- Missionary records for M1 and M2
- Public pages with `is_published: true`
- A `users` table entry (public profile) for the supporter

The seed is **idempotent** — safe to run multiple times.

### 6. Test Agencies and Churches

The admin-creation tests expect `Test Agency` and `Test Church` to exist in the DB. Seed these manually or via migration before running `00-admin-create-entities.cy.ts`.

---

## Live Server Requirements

### 1. Supabase Project

- All migrations applied (including `note` column on `missionary_followers`)
- RLS policies in place:
  - `missionary_followers`: policy allowing anyone to view (`USING (true)`) — required for follower count visibility
  - Standard auth policies for all other tables

### 2. Test Accounts on Live Server

Create the same 4 test accounts in the live Supabase Auth dashboard:
- `admin@h21test.local`
- `m1@h21test.local`
- `m2@h21test.local`
- `supporter@h21test.local`

Assign correct roles and seed missionary/page records for M1 and M2.

### 3. Environment Variables for CI

In your CI provider (e.g., GitHub Actions), set:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CYPRESS_BASE_URL=https://your-deployed-app.com
```

And the `cypress.env.json` contents as CI secrets.

### 4. Running Against Staging/Prod

```bash
CYPRESS_BASE_URL=https://staging.harvest21.org pnpm cypress run \
  --spec "cypress/e2e/missionary-e2e/**/*.cy.ts"
```

**Caution:** The seed tasks write to the DB. Use a dedicated test project or staging environment — never run against production.

---

## Known Issues (2 tests currently failing)

### 1. `missionary/02-settings-page-details` — Page URL shows wrong value after full suite run

**Test:** "page URL field shows alice-waller"
**Symptom:** Input shows `aliceupdated-waller` instead of `alice-waller`
**Root cause:** `settings-account` spec saves name as "AliceUpdated" then reverts to "Alice" — but the save action appears to also update `pages.page_url` to a slug derived from the name. The DB seed resets it, but if tests run in order, the settings-account test runs first and corrupts the page URL before the page-details test reads it.
**Fix needed:** Investigate `updateCurrentMissionaryDetails` server action — determine if it syncs `pages.page_url`. If yes, the account tab save should not auto-update page URL when explicitly set.

### 2. `supporter/01-follow-and-message` — `button-follow-pending` not found

**Test:** "submitting follow request changes button state to Pending"
**Symptom:** Follow modal submits but the button doesn't transition to `[data-cy="button-follow-pending"]`
**Root cause:** Either the modal submit button selector is wrong, or the button state update is async and needs longer timeout, or the follow request API is failing silently.
**Fix needed:** Add network intercept to verify the follow request API call succeeds; increase timeout on pending button check.

---

## Quick Checklist Before Running Tests

- [ ] `supabase start` — local Supabase is running
- [ ] `pnpm dev:cypress` — dev server is running on port 3000
- [ ] `cypress.env.json` exists with test account credentials
- [ ] `missionary_followers.note` column exists in local DB
- [ ] `Test Agency` and `Test Church` exist in DB (for admin tests)
- [ ] No leftover auth sessions from a previous run (`cypress/fixtures/` cleared if needed)
