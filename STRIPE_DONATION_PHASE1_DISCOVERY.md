# Phase 1 — Project & Donate Button Discovery

## 1. Project structure

| Item | Finding |
|------|--------|
| **Router** | App Router only (`app/`). No Pages Router. |
| **API routes** | Under `app/api/`: auth, contact, get-page-data, storage, user-profile, wistia, etc. No Stripe or donation API yet. |
| **Server actions** | Used in `app/[page_url]/actions.ts`, `app/settings/actions.ts`, `app/admin/**/actions.ts`, `app/church-affiliation-actions.ts`. |
| **Auth** | Supabase via `lib/supabaseServer.ts` (server), `lib/supabaseClient.ts` (client). Session in middleware `utils/supabase/middleware.ts`. Roles in `users.role`: 1/2 admin, 3 missionary, 4 supporter (donor), 5 agency. `getUserProfile()` in `lib/navbarHelpers.ts` returns role, page_url, etc. |
| **Stripe** | None. No `stripe` in package.json; no Stripe env or routes. |

## 2. Existing Donate button

| Location | File | Behavior |
|----------|------|----------|
| **Missionary public page** | `components/missionary/MissionaryPublicView.tsx` | Two identical Donate `<Button>`s: (1) inside church block ~L639–665, (2) inside non-church block ~L734–744. Both `onClick` → `toast.success("Donate functionality coming soon!")`. No navigation, no donor PII. |
| **Props/data** | Passed from `app/[page_url]/page.tsx` | `MissionaryPublicView` receives `missionary`, `page`, `media`, `widgets`, `donations`, `initialUserProfile`, `isOwner`, `followerStatus`. Data from `getMissionaryPreviewBySlug(slug)` in `app/[page_url]/actions.ts`. No `donation_mode` or `external_donation_url` in types or fetch. |
| **CTA order** | Same flex/grid as other CTAs | Order: Follow → Direct Message → Tell Others → Donate. Must remain unchanged. |
| **Footer** | `components/Footer.tsx` | Single link: `<Link href="/donate">Donate</Link>`. No missionary context. |
| **Donate page** | `app/donate/page.tsx` | Server component; renders footer “donate” content (title + sections). No Stripe, no form. |

## 3. Donation mode impact (to implement)

- **Donation mode** does not exist yet. Required: exactly one of (1) Harvest 21 / Stripe, (2) External link, (3) Donations Off.
- **Button visibility**: When “Donations Off” → hide Donate everywhere on that missionary page. When Harvest 21 or External → show only to **supporters** (role 4); hide for non-logged-in and non-supporter.
- **Button click**: Harvest 21 → internal route to donation page (with missionary/page context). External → warning modal then open link in new tab. Donations Off → button not rendered.

## 4. Safe extension points (zero regression)

- **Data layer**  
  - Add `donation_mode` and `external_donation_url` to **pages** (missionary page) or **missionaries**. Prefer **pages**: one row per missionary public page; keeps missionary table smaller and donation config with page.  
  - Extend `getMissionaryPreviewBySlug` to select and return these fields (and only expose to public view what’s needed).  
  - Missionary settings: add “Donation options” under or next to “Affiliation Information” in `MissionaryAccountBasicsTab` (or dedicated section); save to same table as above.

- **MissionaryPublicView**  
  - Add optional props: `donationMode: 'harvest21' \| 'external' \| 'off'`, `externalDonationUrl: string \| null`.  
  - When `donationMode === 'off'`: do not render Donate button.  
  - When Harvest 21: Donate click → `router.push(/donate?page_id=...)` (or similar).  
  - When External: Donate click → show modal (“You’ll leave Harvest 21…”), then `window.open(externalDonationUrl)`.  
  - Restrict Donate visibility to supporters only: render Donate only if `initialUserProfile?.role === 4`.  
  - Keep existing CTA order and styling; only change visibility and onClick.

- **Footer**  
  - Leave as-is: `<Link href="/donate">Donate</Link>` (no query). Always Harvest 21; not tied to a missionary.

- **Donate page**  
  - Optional query: `page_id` or `missionary_id` for “donate to this missionary.” Default: generic Harvest 21 donation (no missionary).  
  - New client component for form (Stripe Elements, amounts, one-time vs monthly); page stays server component that loads layout and passes query params.

- **API / server**  
  - New API or server actions: create PaymentIntent (one-time), create Subscription (monthly), with idempotency keys.  
  - New webhook route: `app/api/webhooks/stripe/route.ts` (or similar); verify signature, idempotent handling, write to `donors` / `page_donations` only from webhook.

## 5. Existing DB (relevant)

- **donors** (id, user_id, first_name, last_name, email, … total_donated, is_active).  
- **page_donations** (id, donor_id, page_id, amount, currency, transaction_ref, status Pending|Complete|Failed, created_at). No `type` (one-time vs recurring) or Stripe IDs in current schema; additive migration needed for Stripe and receipts.  
- **notifications** (id, user_id, type, title, message, …). Used for missionary net-amount notifications (no donor identity).  
- **pages**: has `donation_percentage` (from agency landing migration); no `donation_mode` or `external_donation_url` yet.

## 6. Confidence

- Project structure & Donate button location: **98%**.  
- Extension points and regression safety: **95%** (pending schema and exact supporter check in one place).
