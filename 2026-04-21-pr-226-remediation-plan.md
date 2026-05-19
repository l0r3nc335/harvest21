# PR #226 — Remediation Plan (v2)

| Field | Value |
|--------|--------|
| **Last reviewed** | 2026-04-21 |
| **Branch tip** | `5055173` on `m4-testing` |
| **Since v1** | `f910f98` · `5f36dab` · `5055173` |
| **Deps** | `next@^16.2.4`, `nodemailer@^8.0.5` — `npm audit` 0 |

**Scope:** Lahat ng review items — status, dahilan, files, fix, UX effect. May mga linya na kailangan **desisyon** bago i-code.

---

## Contents

| # | Section |
|---|---------|
| 1 | [Status buod (lahat ng phase)](#1-status-buod-lahat-ng-phase) |
| 2 | [Labels (Done / Partial / Open)](#2-labels) |
| 3 | [Phase 0 — Unblock](#3-phase-0--unblock) |
| 4 | [Phase 1 — Authorization](#4-phase-1--authorization) |
| 5 | [Phase 2 — Fail-closed](#5-phase-2--fail-closed) |
| 6 | [Phase 3 — Credentials](#6-phase-3--credentials) |
| 7 | [Phase 4 — Stripe](#7-phase-4--stripe) |
| 8 | [Phase 5 — Storage](#8-phase-5--storage) |
| 9 | [Phase 6 — RLS](#9-phase-6--rls) |
| 10 | [Phase 7 — CSP](#10-phase-7--csp) |
| 11 | [Phase 8 — Tests / CI](#11-phase-8--tests--ci) |
| 12 | [Desisyon](#12-desisyon) |
| 13 | [PR order + effort](#13-pr-order--effort) |
| 14 | [Commands + checklist table](#14-commands--checklist-table) |

---

## 1. Status buod (lahat ng phase)

| Phase | Status | Tapos na | Kulang pa |
|-------|--------|----------|------------|
| **0** Unblock | Done | merge OK, CORS image, `poweredByHeader`, `dangerouslyAllowSVG`, `removeConsole` + error, dead exports | — |
| **1** Auth | Partial | admin page RSC + role; generic errors sa ilang API | **3 server actions walang auth**; walang `FORCE RLS` |
| **2** Fail-closed | Partial | `CSRF_SECRET` throw sa prod; null-byte sa path | rate limit catch, Upstash, XFF, `Buffer` middleware, `dynamic` layout, `.maybeSingle`, IPv6 mask |
| **3** Credentials | Partial | signup/signin hygiene, `validate-password`, server `checkPassword` signup | **reset = `updateUser` sa browser**; activation zxcvbn; token sa URL; email rate signin |
| **4** Stripe | Open | — | dedup table, refund receipt, amount, receipt #, idempotency, `after()` webhook |
| **5** Storage | Partial | signed-upload: auth, ownership, path | bytes, `owner=auth.uid()` policies, isang allowlist |
| **6** RLS | Open | `is_admin()` sa baseline | views + invoker, column REVOKE, `security_events.ip`, FORCE RLS, anon audit |
| **7** CSP | Open | — | strict-dynamic, SameSite Strict, CSRF rotate, fail-closed client, Vary, frame-src |
| **8** CI | Open | — | pre-commit markers, `tsc`+build, supabase lint, integration tests |

---

## 2. Labels

| Label | Kahulugan |
|-------|-----------|
| **Done** | Na-merge / nasa tree na |
| **Partial** | May ginawa, may kulang |
| **Open** | Hindi pa o hindi na-verify |
| **Decision** | Kailangan pumili bago code |

---

## 3. Phase 0 — Unblock

| ID | Status | Ano | Files / detalye |
|----|--------|-----|-----------------|
| 0.1 | Done `5055173` | `next.config` OK; security headers site-wide; walang maluwag na `/_next/image` CORS | `next.config.ts` ~23, ~27–30, ~44, ~46–53 |
| 0.2–0.7 | Done `f910f98` / `5f36dab` | Dead exports, typo, bawas `console.log`, `ErrorScreen` | — |

---

## 4. Phase 1 — Authorization

| ID | Status | Issue | Scope / files | Risk | UX | Next step |
|----|--------|-------|---------------|------|-----|-----------|
| 1.1 | Done | Admin page may role check | `app/admin/page.tsx` ~28–34 | — | None | Optional: `requireRole()` helper |
| 1.2 | **Open** | Server Actions = POST; page gate lang | `homepage-settings/actions.ts` (7), `missionaries/[id]/actions.ts` (19), `lib/pageActions.ts` | **Mataas** — `getSupabaseAdmin()` walang auth | None | `requireAdminOrStaff()` una sa bawat export; `pageActions` → `requireAuth` + ownership |
| 1.3 | Partial | Activation hindi admin-only; token galing body | `send-activation-email` | Session user pwede abuse token | None | `requireAdminOrStaff()`; server token mula `userId` |
| 1.4 | Partial | Rate limit IP lang | `contact` route | — | None | Key `ip:email`; reject `\r\n` sa email |
| 1.5 | Open | Walang `FORCE RLS` | Migration: users, donors, `page_donations`, receipts, `security_events`, org tables | Owner bypass RLS | None | `ALTER TABLE … FORCE ROW LEVEL SECURITY` |

---

## 5. Phase 2 — Fail-closed

| ID | Status | Issue | Where | Risk | UX | Next step |
|----|--------|-------|-------|------|-----|-----------|
| 2.1 | Open | Walang `try/catch` sa Upstash `limit` | `lib/rateLimit.ts` ~95–97 | Outage = di enforced limit | None | try/catch; fail **closed** auth/pay/email |
| 2.2 | Open | Walang Upstash env → in-memory per instance | `lib/rateLimit.ts` ~14, 30–62 | Maling config = weak limit | None | prod: throw kung walang env |
| 2.3 | Open | XFF leftmost = client controlled | `lib/rateLimit.ts` ~74–80 | Spoof IP / bypass | None | `ipAddress(request)` o trusted hop |
| 2.4 | Partial | CSRF off kapag `NODE_ENV !== production` | `middleware.ts` ~19–23 | Staging preview risk | Dev friction | `CSRF_ENFORCEMENT` env; audit `fetch` |
| 2.5 | Done `5f36dab` | CSRF secret | `lib/csrf.ts` ~18–28 | — | None | — |
| 2.6 | Open / verify | `securityLogger.persist` | — | — | — | Re-read code |
| 2.7 | Partial | Zod error buo sa `security_events` | `signin` at iba | Possible password sa logs | None | `scrubZod` → codes/paths only |
| 2.8 | Open | `stripeResourceMissing` | — | Data loss swallow | — | Per original review |
| 2.9 | Partial | Single-decode `..` slip | `middleware.ts` ~34 | Traversal | None | Regex `(\.\.[\\/])` sa once-decoded |
| 2.10 | Open | `Buffer.from` sa middleware | `middleware.ts` ~133 | Edge vs Node | None | `runtime=nodejs` o `btoa` |
| 2.11 | Open | Layout nonce + cache | `app/layout.tsx` | Stale nonce / CSP | None | `export const dynamic = 'force-dynamic'` |
| 2.12 | Partial | `.single()` throws | `send-reset-email` ~42, `signed-upload` ~103, ~109 | Mishandle zero rows | None | `.maybeSingle()` + error handling |
| 2.13 | Open | IPv6 `maskIp` | — | — | — | Implement |

---

## 6. Phase 3 — Credentials

| ID | Status | Issue | Where | Risk | UX | Next step |
|----|--------|-------|-------|------|-----|-----------|
| 3.1 | Open | Signin rate limit IP only | signin route | Stuffing + proxies | None | Email-keyed limit |
| 3.2 | Done `5f36dab` | Generic signin message | `signin/route.ts` ~66–68 | — | None | Inactive user msg OK (post-auth) |
| 3.3 | Done `5f36dab` | Stripped signup | `signup-supporter` | Minor enum: `user_already_exists` | Low | Optional: generic lahat |
| 3.4 | Open | Timing oracle reset email | `send-reset-email` ~44–49 | User enumeration | None | `after()` send o constant-time |
| 3.5 | Open | Token sa query string | email + `ResetPasswordForm` | Leak sa logs/referrer | None | `tokenId` + server exchange |
| 3.6 | **Open** | **`updateUser` sa browser** | `ResetPasswordForm` ~87–89 | **Bypass zxcvbn** | Mas strikto password | Server action + cookie + token table |
| 3.7 | Open | Local signOut lang | rolls to 3.6 | — | Sign out everywhere | Kasama 3.6 |
| 3.8 | Open | Activation walang zxcvbn | `activate-account` ~42–45 | Weak passwords pass | None | `checkPassword` bago admin update |
| 3.9 | Verify | Double-decode token | `verify-activation-token` | — | — | Fresh read |
| 3.10 | Open | `validate-password` DoS | route | Long body + shared limit | None | max 128 chars; dedicated limiter |
| 3.11 | Open | Meter debounce 450ms | UI | Self-DoS | None | Tune + limiter |
| 3.12 | Partial | Duplicate min length | maraming file | Drift | None | One constant |
| 3.13 | Verify | Header injection contact | `contact/route.ts` | — | — | Verify |

---

## 7. Phase 4 — Stripe

| ID | Status | Topic | Notes / next step |
|----|--------|-------|---------------------|
| 4.1–4.2 | Open | Webhook dedup | Table `stripe_webhook_events`; `ON CONFLICT DO NOTHING`; retention |
| 4.3 | Open | Amount | `invoice.amount_paid` first; metadata fallback + warn |
| 4.4 | Open | Receipt # | Deterministic + unique index |
| 4.5 | Open | Idempotency | Huwag `Date.now()` lang; rolling window |
| 4.6–4.7 | Open | Refund / dispute | Receipt void + email — **Decision:** copy |
| 4.8 | Open | Webhook speed | `after()` para Gmail / notify |
| 4.9 | Open | Receipt race | `UPDATE … WHERE sent_at IS NULL RETURNING` |
| 4.10 | Open | `ensureDonationFromPaymentIntent` | Align o delete dead code |
| 4.11–4.14 | Open | Hygiene | $0 guard, duplication, `escapeHtml`, logs |

---

## 8. Phase 5 — Storage

| ID | Status | Topic | Notes / next step |
|----|--------|-------|---------------------|
| 5.1 | Open | Allowlists | Isang source of truth (5 files ngayon) |
| 5.2 | Open | GIF vs MIME | Align o tanggalin dead path |
| 5.3 | Open | MP4 `ftyp` | iPhone variants |
| 5.4 | Open | Walang extension | `uploadValidation.ts` ~171–175 |
| 5.5 | Open | `sanitizeFilename` | Multi-dot `shell.php.jpg` |
| 5.6 | Partial / Done core | Signed URL ownership | **Done:** auth + path `orgType/orgId`. **Kulang:** byte validate, `expectedMime` sa signed URL |
| 5.7 | Open | Storage RLS | `owner = auth.uid()` sa INSERT/UPDATE |
| 5.8–5.9 | Open | `rich-content/` | Path + owner sa policy |
| 5.10 | Open | Index / cast | `id::text` sa RLS — sequential scan; numeric cast o index |

---

## 9. Phase 6 — RLS

| ID | Status | Topic | Next step |
|----|--------|-------|-----------|
| 6a.1 | Done | `is_admin()` | Baseline migration ~262 |
| 6a.2 | Open | Function grants | `REVOKE … PUBLIC, anon`; grant authenticated + service_role |
| 6a.3 | Open | `users` updates | Column-level `REVOKE UPDATE` role/status; simplify policy |
| 6a.4 | Open | `church_followers` | RLS on? buong policy set |
| 6a.5–6 | Open | `security_events` | Revoke UPDATE/DELETE; `ip` → `inet`; retention; mask |
| **6b** | **Open + Decision** | **Public views / invoker** | Option 1 invoker + anon policy · 2 functions · 3 document. **UX risk:** maling predicate = blank public pages |
| 6c | Open | Anon grants | Comment bawat `GRANT … TO anon` |

---

## 10. Phase 7 — CSP

| ID | Status | Item | Notes |
|----|--------|------|-------|
| 7.1 | Open | `strict-dynamic` | Test GTM / Stripe chains |
| 7.2 | Open | style-src | Alisin `unsafe-inline` kung nonce OK |
| 7.3 | Open | CSRF cookie | `SameSite=Strict` `lib/csrf.ts` ~113 |
| 7.4 | Open | CSRF rotate | Pagkatapos login |
| 7.5 | Open | Client CSRF | Throw kung walang token sa mutation |
| 7.6–9 | Open | Misc | Cookie parse, `Vary: Origin`, `frame-src 'self'`, EXEMPT audit |

---

## 11. Phase 8 — Tests / CI

| ID | What | Command / notes |
|----|------|-------------------|
| 8.1 | Pre-commit merge markers | `grep` `<<<<<<<` `=======` `>>>>>>>` sa staged |
| 8.2 | CI build | `tsc --noEmit && next build` — required sa branch |
| 8.3 | Supabase lint | `supabase db lint --level=error` |
| 8.4 | Integration tests | Original Phase 8 list |

---

## 12. Desisyon

| # | Tanong | Choices |
|---|--------|---------|
| 1 | Phase **6b** public views | Option 1 / 2 / 3 — may visibility column sa base tables? |
| 2 | Phase **3.1** email rate | Soft backoff vs hard 429; CAPTCHA scope? |
| 3 | Phase **2.4** CSRF | Audit muna lahat mutating `fetch` o flip env agad? |
| 4 | Phase **4.6** refund email | Sino magda-draft ng copy? |
| 5 | Phase **5.6** MIME | `expectedMime` sa signed URL o bucket lang? |

---

## 13. PR order + effort

| PR | Days (estimate) | Items | UX / sign-off |
|----|-----------------|-------|----------------|
| **A** | 1–2 | 1.2, 2.1–2.3, 2.9–2.11 | Minimal |
| **B** | 3–5 | 3.6, 3.7, 3.8 | Reset + global signout |
| **C** | 3–5 | Phase 4 core | Refund emails |
| **D** | ~1 week | Phase 6 | **6b** decision + smoke tests |
| **E** | 3–5 | Phase 5 polish + Phase 7 | CSP testing |
| **F** | ongoing | Phase 8 | Hook muna |

**Effort:** ~3–4 weeks isang dev; ~2 weeks dalawa (parallel).

---

## 14. Commands + checklist table

```bash
git fetch origin && git log --oneline 5055173..origin/m4-testing
grep -nE '^(<{7}|={7}|>{7})' next.config.ts
grep -nE 'getUser|requireAuth|requireAdmin' app/admin/homepage-settings/actions.ts
grep -n checkPassword app/api/activate-account/route.ts
grep -n stripe_webhook_events supabase/migrations/*.sql
```

| Phase / item | Done? | Commit / note |
|--------------|-------|----------------|
| 0 Unblock | Yes | `5055173` |
| 1.1 Admin page | Yes | `5f36dab` |
| **1.2 Admin actions auth** | **No** | **Highest authz risk** |
| 1.3–1.5 activation, contact, FORCE RLS | No | — |
| 2.5 CSRF secret hard fail | Yes | `5f36dab` |
| 2.1–2.3 rate + IP | No | — |
| 2.9–2.13 middleware, maskIp, maybeSingle | No | — |
| 3.2–3.3 signin/signup | Yes | `5f36dab` |
| 3.1 email signin limit | No | — |
| 3.4–3.8 reset + activation | No | — |
| 4 Stripe all | No | — |
| 5.6 signed-upload ownership | Yes | `5f36dab` |
| 5.1–5.5, 5.7–5.10 | No | — |
| 6 RLS + 6b decision | No | — |
| 7 CSP | No | — |
| 8 tests / CI | No | start: merge-marker hook |
