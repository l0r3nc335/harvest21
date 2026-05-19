# Data Dictionary

## 1. Document overview

| Field | Value |
|--------|--------|
| **Project name** | harvest21-frontend |
| **Description** | Next.js (App Router) web application for Harvest 21: missionary, church, agency, and college public pages; supporter accounts; donations via Stripe; direct messaging; followers; media (Wistia, Supabase Storage); and related workflows. Primary persistence is **Supabase (PostgreSQL)**. This repository does not use Prisma. |
| **Version** | 0.1.0 (`package.json`) |
| **Date** | 2026-03-24 |
| **Author** | Engineering / technical documentation (derived from codebase and schema) |

---

## 2. Database tables / models

Conventions: **Required** = NOT NULL or primary key. Types reflect PostgreSQL unless noted. Source: `.cursor/rules/database-schema.mdc`, `supabase/migrations/`.

### 2.1 Core identity

#### `users`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | identity | Primary key | `1` |
| user_id | uuid | Yes | — | Links to `auth.users(id)` | UUID |
| role | smallint | Yes | — | FK → `user_roles(id)` | `4` |
| status | varchar | No | `'Pending'` | Application account status | `Active` |
| first_name | varchar | No | — | Given name | `Jane` |
| last_name | varchar | No | — | Family name | `Doe` |
| email | text | Yes | — | Unique contact / login identity in app | `jane@example.com` |
| last_activity | timestamptz | No | — | Last recorded activity | ISO-8601 |

#### `user_roles`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK, unique | `3` |
| role | varchar | Yes | — | Human-readable role name | `missionary` |

---

### 2.2 People & organizations

#### `missionaries`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | identity | PK | `42` |
| user_id | uuid | No | — | FK → `auth.users` | UUID |
| agency_id | bigint | No | — | FK → `agencies` | `2` |
| college_id | bigint | No | — | FK → `colleges` | `1` |
| sending_church_id | bigint | No | — | Church reference | `10` |
| mission_field_church_id | bigint | No | — | Church reference | `11` |
| first_name | varchar | Yes | — | Required name | `John` |
| last_name | varchar | Yes | — | Required name | `Smith` |
| email | text | No | UNIQUE | Contact | `john@example.org` |
| phone_number | varchar | No | — | Phone | `+1…` |
| country_of_residence | varchar | No | — | Country | `US` |
| destination_country | varchar | No | — | Field country | `KE` |
| mission_status | varchar | No | — | `On-Field` / `Furlough` / `Deputation` | `On-Field` |
| open_to_visits | boolean | No | `false` | Visit availability flag | `true` |
| visits_start_date | date | No | — | Visit window start | `2026-01-01` |
| visits_end_date | date | No | — | Visit window end | `2026-06-30` |
| allow_direct_messages | boolean | No | `true` | DMs allowed | `true` |
| biography | text | No | — | Long-form bio | — |
| stripe_account_id | text | No | — | Stripe Connect account | `acct_…` |
| payout_status | text | No | — | `not_started` / `pending` / `enabled` / `restricted` / `incomplete` | `enabled` |
| is_managed_by_harvest21 | boolean | No | — | Platform-managed flag | `false` |

#### `supporter_profiles`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | identity | PK | `1` |
| user_id | uuid | Yes | — | UNIQUE → `auth.users` | UUID |
| first_name | text | Yes | — | Profile first name | `Jane` |
| last_name | text | Yes | — | Profile last name | `Doe` |
| email | text | Yes | — | Profile email | `jane@example.com` |
| country_of_residence | text | Yes | — | Country | `US` |
| phone_number | text | No | — | Optional phone | — |
| profile_photo_url | text | No | — | Public image URL | `https://…` |

#### `agencies`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | identity | PK | `1` |
| contact_user_id | uuid | No | — | FK → `auth.users` | UUID |
| name | varchar | Yes | — | Agency name | `Example Missions` |
| email, address, city, state, country, website | text | No | — | Contact & location | — |
| phone_number, contact_person_phone_number | varchar/text | No | — | Phones | — |
| is_managed_by_harvest21 | boolean | No | — | Platform flag | `false` |

#### `churches`

Same general pattern as agencies: `id`, `contact_user_id` → `auth.users`, `name` NOT NULL, contact/address fields, `is_managed_by_harvest21`.

#### `colleges`

`id`, `contact_user_id`, `name` NOT NULL, email/address/city/country/website/phone.

---

### 2.3 Pages & publishing

#### `pages`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | identity | PK | `100` |
| organization_type | text | Yes | — | `church` / `college` / `agency` / `missionary` / `donor` | `missionary` |
| organization_id | bigint | Yes | — | FK to org row | `42` |
| page_url | text | Yes | UNIQUE | Public slug | `john-smith` |
| profile_photo_url | text | No | — | Avatar | URL |
| banner_photo_url | text | No | — | Hero image | URL |
| short_quote, about_text, intro_text, name | text | No | — | Page copy | — |
| is_published | boolean | No | — | Live vs draft | `true` |
| donation_mode | text | No | — | `harvest21` / `external` / `off` | `harvest21` |
| external_donation_url | text | No | — | External donate link | URL |
| donation_percentage | real | No | — | Fee/split | `0.05` |
| page_template | text | No | — | Template identifier | — |
| template_content | text | No | — | Serialized template JSON | — |
| video_hashed_id | varchar | No | — | Wistia id | `abc123` |
| is_review | boolean | No | — | Review mode | `false` |

#### `page_approvals`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| page_id | bigint | Yes | — | FK → `pages` | `100` |
| requested_by | uuid | No | — | FK → `auth.users` | UUID |
| approved_by | uuid | No | — | FK → `auth.users` | UUID |
| status | text | No | — | `Pending` / `Agency Approved` / `Published` / `Unpublished` | `Published` |

#### `page_media`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| page_id | bigint | Yes | — | FK → `pages` | `100` |
| media_type | text | Yes | — | `image` / `video` | `video` |
| media_url | text | Yes | — | Asset URL | `https://…` |
| description | text | No | — | Caption | — |
| thumbnail_url | text | No | — | Thumbnail | URL |
| hashed_id | text | No | — | Provider id | — |
| views | integer | No | — | View count | `0` |
| reactions | integer | No | — | Reaction count | `0` |

#### `page_widgets`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| page_id | bigint | Yes | — | FK → `pages` | `100` |
| widget_type | text | No | — | Widget kind | `update_letter` |
| widget_title | text | No | — | Title | — |
| widget_data | jsonb | No | — | Payload (e.g. PDF URL, thumbnails) | `{}` |

---

### 2.4 Donations

#### `donors`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `9` |
| user_id | uuid | No | — | FK → `auth.users` | UUID |
| first_name | text | Yes | — | Billing name | `Jane` |
| last_name | text | Yes | — | Billing name | `Doe` |
| email | text | Yes | UNIQUE | Contact | `jane@…` |
| phone_number, country, city, address, postal_code | text | No | — | Address | — |
| organization_name | text | No | — | Org on file | — |
| donation_preference | text | No | — | Preference text | — |
| total_donated | numeric | No | `0` | Running total | `250.00` |
| is_active | boolean | No | `true` | Active donor | `true` |
| stripe_customer_id | text | No | — | Stripe customer | `cus_…` |

#### `page_donations`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `500` |
| page_id | bigint | Yes | — | FK → `pages` | `100` |
| donor_id | bigint | No | — | FK → `donors` | `9` |
| user_id | uuid | No | — | FK → `auth.users` | UUID |
| amount | numeric | Yes | — | Amount | `50.00` |
| currency | text | No | `USD` | Currency code | `USD` |
| status | text | No | — | `Pending` / `Complete` / `Failed` / `Refunded` / `Disputed` | `Complete` |
| type | text | No | — | `one_time` / `recurring` | `one_time` |
| stripe_payment_intent_id | text | No | — | Stripe PI | `pi_…` |
| stripe_subscription_id | text | No | — | Stripe sub | `sub_…` |
| stripe_invoice_id | text | No | — | Stripe invoice | `in_…` |
| transaction_ref | text | No | — | Reference | — |

#### `donation_receipts`

Links `page_donation_id` → `page_donations`, `donor_id` → `donors`; `amount`, `currency`, `receipt_number` (UNIQUE), `delivery_status`: `pending` / `sent` / `delivered` / `failed`.

---

### 2.5 Followers & affiliations

#### `missionary_followers`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| missionary_id | bigint | Yes | — | FK → `missionaries` | `42` |
| user_id | uuid | Yes | — | FK → `auth.users` | UUID |
| reviewed_by | uuid | No | — | Moderator | UUID |
| status | text | No | — | `pending` / `accepted` / `rejected` / `unfollowed` | `accepted` |

#### `missionary_missionary_followers`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| follower_missionary_id | bigint | Yes | — | FK → `missionaries` | `10` |
| followed_missionary_id | bigint | Yes | — | FK → `missionaries` | `42` |
| reviewed_by | uuid | No | — | Moderator | UUID |
| status | text | No | — | Same enum as above | `pending` |

#### `church_followers`

`church_id` → `churches`, `user_id` → `auth.users`, `reviewed_by`, `status` (`pending` / `accepted` / `rejected` / `unfollowed`).

#### `affiliated_churches`

`missionary_id` → `missionaries`, `church_id` → `churches`.

#### `missionary_churches`

`missionary_id`, `church_id`, `relationship_type`: `sending` / `supporting` / `partner`, `is_active` boolean.

---

### 2.6 Messaging

#### `conversations`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| missionary_id | bigint | Yes | — | FK → `missionaries` | `42` |
| supporter_id | uuid | Yes | — | FK → `auth.users` | UUID |
| last_message_at | timestamptz | No | — | Sort / preview | ISO-8601 |
| last_message_preview | text | No | — | Snippet | `Hello…` |
| last_message_sender_id | uuid | No | — | Last sender | UUID |

#### `conversation_members`

`conversation_id` → `conversations`, `user_id` → `auth.users`, `unread_count` (default 0), `last_read_at`.

#### `messages`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| conversation_id | bigint | Yes | — | FK → `conversations` | `1` |
| sender_id | uuid | Yes | — | FK → `auth.users` | UUID |
| content | text | Yes | — | Body (schema: 1–5000 chars) | `Hi there` |
| is_read | boolean | No | — | Read flag | `false` |

#### `message_reports`

`conversation_id`, `message_id`, `reported_by`, `reviewed_by`, `report_type`: `message` / `conversation`, `status`: `pending` / `reviewed` / `resolved`.

---

### 2.7 Notifications & content tracking

#### `notifications`

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | — | PK | `1` |
| user_id | uuid | Yes | — | Recipient | UUID |
| type | text | Yes | — | Notification category | `follow_request` |
| title | text | Yes | — | Short title | `New follower` |
| message | text | Yes | — | Body | — |
| related_entity_type | text | No | — | Entity kind for deep links | `page` |
| related_entity_id | bigint | No | — | Entity id | `100` |
| is_read | boolean | No | — | Read state | `false` |
| read_at | timestamptz | No | — | When read | ISO-8601 |
| content_metadata | jsonb | No | — | e.g. `{ "focus", "tab" }` for missionary content UI | `{"tab":"videos"}` |

#### `missionary_content_publications` (migration `20260324120000_…`)

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| id | bigint | Yes | identity | PK | `1` |
| missionary_id | bigint | Yes | — | FK → `missionaries` | `42` |
| page_id | bigint | Yes | — | FK → `pages` | `100` |
| content_type | text | Yes | — | `update_letter` / `prayer` / `photo` / `video` | `video` |
| source_table | text | No | — | `page_media` / `page_widgets` / `prayers` | `page_media` |
| source_id | bigint | No | — | Row in source table | `12` |
| published_at | timestamptz | Yes | `now()` | When published | ISO-8601 |

#### `missionary_follower_content_ack` (same migration)

| Field | Data type | Required | Default | Description | Example |
|-------|-----------|----------|---------|-------------|---------|
| user_id | uuid | Yes | — | Composite PK → `auth.users` | UUID |
| missionary_id | bigint | Yes | — | Composite PK → `missionaries` | `42` |
| last_acknowledged_at | timestamptz | Yes | `now()` | Last “caught up” time | ISO-8601 |

---

### 2.8 Prayer wall

#### `prayers`

`user_id` → `auth.users`, `page_id` → `pages`, `title`, `body` NOT NULL, `is_published` default true, `visibility`: `public` / `private` / `supporters`, counters (`amen_count`, etc.), `deleted_at` for soft delete.

#### `prayer_reactions`

`user_id`, `prayer_id`, `type`: `amen` only.

#### `prayer_updates`

`user_id`, `prayer_id`, `body` NOT NULL.

---

### 2.9 Homepage & footer

#### `homepage_banners`

`banner_type`: `carousel` / `static` / `video`, `is_active`, `display_order`, `location`, `description`, `image_url`, `scroll_duration` (default 5000).

#### `homepage_settings`

`banner_type`, `auto_scroll`, `scroll_timing`, `show_navigation_arrows`, `show_pagination_dots`.

#### `footer_content`

`page_type` UNIQUE: `about_us`, `statement_of_faith`, `donate`, `faq`, `contact_us`, `privacy_policy`, `terms_of_use`; `title`, `content` NOT NULL; `updated_by` → `auth.users`.

*(Additional footer link tables may exist per migrations; align with live DB if they diverge from the core schema doc.)*

#### Featured homepage sections (migration `20260320_…`)

`homepage_featured_sections`, `homepage_section_profiles` (section ↔ missionary/church/agency profiles with `display_order`).

---

### 2.10 Other

#### `push_subscriptions`

`user_id`, `endpoint`, `p256dh`, `auth` NOT NULL, `user_agent`.

---

## 3. API data structures

Base URL: same origin as the Next.js app. Auth: session cookies (Supabase) where noted.

### 3.1 Authentication & account

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signin` | POST | Email/password sign-in; sets cookies. |
| `/api/auth/signout` | POST | Clears Supabase session and related cookies. |
| `/api/auth/signup-supporter` | POST | Creates auth user, `users` row (role 4), `supporter_profiles`. |
| `/api/activate-account` | POST | Sets password from activation JWT payload. |
| `/api/verify-activation-token` | POST | Validates activation token; returns `userId`, `email`. |
| `/api/send-activation-email` | POST | Triggers activation email flow (implementation-specific). |
| `/api/send-reset-email` | POST | Password reset email flow. |

**POST `/api/auth/signin`**

- **Body:** `{ "email": string, "password": string }`
- **Response (200):** `{ "success": true, "user": SupabaseUser, "session": Session }`
- **Errors:** `400` missing fields; `401` bad credentials; `403` inactive account (`accountDisabled: true`); `500` server error.

**POST `/api/auth/signup-supporter`**

- **Body:** `{ "firstName", "lastName", "email", "password", "countryOfResidence" }` (all required)
- **Response (200):** `{ "success": true, "message": string, "user": User, "session": Session | null }`
- **Validation:** password length ≥ 8.

**POST `/api/activate-account`**

- **Body:** `{ "token": string, "password": string }`
- **Response:** `{ "success": true, "message": string }` or `{ "success": false, "message": string }`

**POST `/api/verify-activation-token`**

- **Body:** `{ "token": string }`
- **Response (200):** `{ "success": true, "userId": string, "email": string }`

---

### 3.2 User & page helpers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user-profile` | GET | Current user navbar profile (requires session). |
| `/api/get-page-id` | GET | `pageId` for current user’s org page. |
| `/api/get-page-data` | POST | Resolve `organization_type`, `organization_id` from `pageId`. |
| `/api/check-unpublished-owner` | GET | `?slug=` — whether session user owns unpublished page for slug. |

**GET `/api/user-profile`**

- **Response (200):** `NavbarUserProfile`: `{ id, first_name, last_name, email, role, profile_photo_url, page_url }`
- **401** if unauthenticated.

**GET `/api/get-page-id`**

- **Response:** `{ "pageId": number }` or `404` with `{ "error": string }`.

**POST `/api/get-page-data`**

- **Body:** `{ "pageId": number }`
- **Response:** `{ "organization_type": string, "organization_id": number }`

**GET `/api/check-unpublished-owner?slug=…`**

- **Response:** `{ "isOwnerUnpublished": boolean }`

---

### 3.3 Donations & Stripe

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/donate/create-payment-intent` | POST | Creates Stripe PaymentIntent or subscription setup; rate-limited by IP. |
| `/api/webhooks/stripe` | POST | Stripe webhook (signature-verified); updates DB and emails. |
| `/api/stripe-connect/create-account` | POST | Express Connect onboarding link for logged-in missionary. |
| `/api/stripe-connect/account-status` | GET | Payout/status sync for missionary Stripe account. |

**POST `/api/donate/create-payment-intent`**

- **Body:** `{ "amountCents": number, "pageId"?: number|null, "idempotencyKey"?: string, "frequency"?: "one_time"|"monthly", "billing"?: { "firstName"?, "lastName"?, "email"? } }`
- **Rules:** `amountCents` ≥ 100; monthly requires authenticated user; guest one-time requires valid `billing.email`.
- **Response (one-time):** `{ "clientSecret": string }`
- **Response (monthly):** `{ "clientSecret": string, "subscriptionId": string }`
- **503** if Stripe not configured.

---

### 3.4 Media & storage

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/page-media` | POST | Insert `page_media` video row; notifies followers. |
| `/api/page-media` | DELETE | `?id=` — delete row and storage objects when under Supabase public bucket. |
| `/api/page-widgets` | DELETE | `?id=` — delete widget and related storage files. |
| `/api/storage/signed-upload` | POST | Signed upload URL for `h21-dev` bucket. |
| `/api/photos` | GET | Photo listing (query params per route). |
| `/api/videos` | GET | Video listing (query params per route). |

**POST `/api/page-media`**

- **Body:** `{ "pageId": number, "mediaUrl": string, "description"?: string, "thumbnailUrl"?: string }`
- **Response:** `{ "success": true, "data": PageMediaRow }`

**POST `/api/storage/signed-upload`**

- **Body:** `{ "organizationType": OrganizationType, "organizationId": number, "fileName": string, "folder"?: string }`
- **Response:** `{ "success": true, "signedUrl": string, "path": string, "publicUrl": string }`

---

### 3.5 Wistia

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wistia/config` | GET | Wistia configuration for client. |
| `/api/wistia/token` | GET | Upload/auth token. |
| `/api/wistia/upload-credentials` | POST | Credentials for direct upload. |
| `/api/wistia/upload` | POST | Server-side upload handler. |
| `/api/wistia/delete` | DELETE | Delete remote asset. |
| `/api/wistia/callback` | GET | Provider callback. |
| `/api/wistia/projects` | GET | List projects. |
| `/api/wistia/folders` | POST | Folder operations. |
| `/api/wistia/move-video` | POST | Move video between folders/projects. |

*(Exact query/body shapes are defined in each `route.ts`; treat as integration-specific.)*

---

### 3.6 Missionaries & followers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/missionaries/following` | GET | Paginated list of who the current missionary follows (missionaries + churches). |
| `/api/missionaries/[id]/followers/users` | GET | Paginated supporter followers for missionary `id`. |
| `/api/missionaries/[id]/followers/missionaries` | GET | Paginated missionary followers for missionary `id`. |

**GET `/api/missionaries/following`**

- **Query:** `limit` (1–50, default 10), `page` (default 1).
- **Response:** `PaginatedResponse<MissionaryFollowingItem>`: `{ items, page, limit, total, hasMore }`

**GET `/api/missionaries/[id]/followers/users`**

- **Query:** `limit`, `page` (same caps).
- **Response:** `PaginatedResponse<UserFollowerItem>`

**GET `/api/missionaries/[id]/followers/missionaries`**

- **Query:** `limit`, `page`.
- **Response:** `PaginatedResponse<MissionaryFollowerItem>`

---

### 3.7 Contact

**POST `/api/contact`**

- **Body:** `{ "name": string, "email": string, "message": string }` (all required)
- **Response:** `{ "success": true, "message": string, "messageId"?: string }` or error with `success: false`.

---

## 4. TypeScript interfaces / types

Location: `types/` (application DTOs and UI shapes; not auto-generated from DB).

| Name | File | Description / key fields |
|------|------|---------------------------|
| `User`, `UserRole` | `user.ts` | App user list row: `id`, `user_id`, names, `email`, `role`, `status`, `last_activity`. |
| `Missionary` | `missionary.ts` | Admin list row: `id`, `name`, `missionStatus`, `accountStatus`, `payoutStatus`, etc. |
| `Donor` | `donor.ts` | Donor summary for admin views. |
| `Transaction` | `transaction.ts` | Ledger-style transaction with Stripe ids and receipt fields. |
| `Conversation`, `Message`, `MessageWithSender`, `ConversationWithDetails`, etc. | `messaging.ts` | Messaging models and params (`SendMessageParams`, `ReportMessageParams`). |
| `Agency`, `AgencyPage`, `AgencyAboutUsContent`, `AgencyPublicViewData` | `agency.ts` | Agency entity + public page bundle. |
| `Church`, `ChurchPage`, `ChurchAboutUsContent`, `ChurchPublicViewData`, `ChurchFollower`, … | `church.ts` | Church entity, followers, public view. |
| `College` | `college.ts` | Minimal list item type. |
| `SupporterProfile`, `SignUpSupporterData`, `FollowItem`, `ActionResult` | `supporter.ts` | Supporter profile and follow lists. |
| `MissionaryFollower`, `Notification`, `FollowerWithUser` | `follow.ts` | Follow + notification shapes. |
| `MissionaryFollowItem`, `MissionaryFollows`, `MissionaryFollowerWithMissionary` | `missionary-following.ts` | Missionary-to-missionary follow UI. |
| `SearchResultBase`, `GlobalSearchResponse`, … | `search.ts` | Global search API response. |
| `PaginatedResponse`, `UserFollowerItem`, `MissionaryFollowerItem`, `MissionaryFollowingItem` | `pagination.ts` | Shared pagination wrappers. |
| `TemplateConfig`, `TemplateContentState`, … | `template.ts` | Page template editor configuration. |
| `MissionaryPublicationContentType`, `NotificationContentMetadata`, … | `missionaryContent.ts` | Content notifications / badges. |
| `HomepageBanner`, `FooterContent`, `FeaturedSectionWithProfiles`, … | `homepage.ts` | Homepage and footer CMS shapes. |

**Relationships (types ↔ domain):** Types mirror Supabase rows conceptually but often rename fields (camelCase), combine joins (e.g. `ConversationWithDetails`), or narrow enums for UI. `NavbarUserProfile` aggregates `users` + role-specific `pages` / `supporter_profiles` (`lib/navbarHelpers.ts`).

---

## 5. Relationships

### 5.1 Entity relationships (summary)

- **auth.users** 1:0..1 **users** (`users.user_id`)
- **users** N:1 **user_roles**
- **missionaries** N:1 **agencies**, N:1 **colleges** (optional)
- **pages** N:1 organization (`organization_type` + `organization_id`) — polymorphic to missionary, church, agency, college, donor
- **page_donations** N:1 **pages**, N:0..1 **donors**, N:0..1 **auth.users**
- **donation_receipts** N:1 **page_donations**
- **missionary_followers** N:1 **missionaries**, N:1 **auth.users**
- **missionary_missionary_followers** N:N **missionaries** (follower / followed)
- **church_followers** N:1 **churches**, N:1 **auth.users**
- **conversations** N:1 **missionaries**, N:1 **auth.users** (supporter); **messages** N:1 **conversations**
- **missionary_content_publications** N:1 **missionaries**, N:1 **pages**
- **missionary_follower_content_ack** composite PK (**auth.users**, **missionaries**)

### 5.2 Foreign keys

Enforced FKs are on Supabase/Postgres (see migrations). Schema doc notes some church IDs on **missionaries** without enforced FK.

### 5.3 Data flow (high level)

1. **Browser** → Next.js **Server Components / Route Handlers** → **Supabase** (RLS) or **getSupabaseAdmin** for trusted server actions.
2. **Payments:** Client → `/api/donate/create-payment-intent` → Stripe → webhook `/api/webhooks/stripe` → **page_donations**, **donors**, emails.
3. **Uploads:** Client → `/api/storage/signed-upload` → direct upload to bucket → URLs persisted in **page_media** / widgets.
4. **Auth:** `/api/auth/*` sets HTTP-only cookies consumed by `@supabase/ssr` on subsequent requests.

---

## 6. Data validation rules

| Area | Rules |
|------|--------|
| Sign-in | `email` and `password` required (`/api/auth/signin`). |
| Supporter signup | All of `firstName`, `lastName`, `email`, `password`, `countryOfResidence`; password ≥ 8 characters. |
| Activation / password set | `token` + `password`; password ≥ 8. |
| Guest donation | Valid email regex for `billing.email` when unauthenticated one-time (`create-payment-intent`). |
| Donation amount | `amountCents` number ≥ 100. |
| Monthly donation | Authenticated session required. |
| Contact form | `name`, `email`, `message` all required. |
| Page media POST | `pageId` and `mediaUrl` required. |
| Signed upload | `organizationType`, `organizationId`, `fileName` required. |
| Messages (DB) | `content` length 1–5000 per schema reference. |
| Follower APIs | `limit` clamped 1–50, `page` ≥ 1. |

**Business rules (inferred from code):** Inactive `users.status` blocks login. Stripe Connect onboarding restricted to users with a **missionaries** row. Rate limiting on payment intent creation by client IP.

---

## 7. Notes & assumptions

- **Schema truth:** The canonical database is PostgreSQL in Supabase; this document aligns with the workspace **database-schema** rule and checked migrations. Tables added only in unlisted migrations may differ—compare `supabase/migrations/` and production.
- **No Prisma:** All persistence is accessed via Supabase JS clients (`lib/supabaseServer.ts`, etc.).
- **API inventory:** Every file under `app/api/**/route.ts` should be reviewed when adding new endpoints; Wistia routes are especially environment-dependent.
- **Role IDs:** Signup hard-codes supporter role `4`; missionary role `3` appears in navbar helper—confirm against `user_roles` in DB.
- **Enums:** Some UI types use different casing than DB (e.g. mission status); map at integration boundaries.

---

*End of Data Dictionary.*
