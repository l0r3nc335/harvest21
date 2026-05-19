# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the project root (`h21-front-end-nextjs/`).

### Development
```bash
pnpm install            # Install dependencies
pnpm dev                # Dev server with .env.develop
pnpm dev:local          # Dev server with .env.local
pnpm dev:staging        # Dev server with .env.staging
```

### Build & Start
```bash
pnpm build              # Build with default env
pnpm build:prod         # Build with .env.prod
pnpm build:staging      # Build with .env.staging
pnpm start:prod         # Start production server
```

### Lint
```bash
pnpm lint               # Run ESLint checks
```

### E2E Tests (Cypress)
```bash
pnpm test:e2e           # Headless (requires running dev server)
pnpm test:e2e:open      # Interactive Cypress UI
pnpm test:e2e:headed    # Visible browser
pnpm test:e2e:chrome    # Chrome specifically
```

## Architecture

### Tech Stack
- **Next.js** (App Router) + **TypeScript** + **TailwindCSS 4** + **Radix UI**
- **Supabase** for auth, database (PostgreSQL), and file storage
- **Mailgun** for transactional email, **Wistia** for video hosting
- **E2E**: Cypress | **Load testing**: k6 (see `k6-tests/`)

### Directory Layout
```
app/                  # Next.js App Router — routing and pages only
  [page_url]/         # Dynamic public missionary/org profile pages
  admin/              # Protected admin portal
  api/                # API route handlers
  auth/               # Auth flow pages
components/           # React components (admin/, auth/, missionary/, ui/, etc.)
lib/                  # Utilities, Supabase clients, server actions
  supabaseClient.ts   # Browser-side Supabase client
  supabaseServer.ts   # Server-side Supabase client
  *Actions.ts         # Server actions (mutations)
  *Helpers.ts         # Utility/helper functions
hooks/                # Custom React hooks
types/                # TypeScript interfaces (one file per domain entity)
cypress/              # E2E tests, fixtures, support commands
k6-tests/             # Load testing scripts and GitHub Actions workflows
middleware.ts         # Session management and route protection
```

### Key Architectural Rules

**Server vs. Client Components**
- Pages (`page.tsx`) must always be Server Components — never add `"use client"` to a page file
- Extract interactive/stateful UI into separate Client Components with `"use client"`
- Fetch data server-side in page/layout components using the server Supabase client

**Supabase**
- Use `lib/supabaseServer.ts` for server-side data fetching and server actions
- Use `lib/supabaseClient.ts` for client-side subscriptions and auth
- Always validate Supabase responses and handle errors before using data

**Data Mutations**
- All mutations go through Server Actions (`lib/*Actions.ts`) — no direct API calls from client components for write operations

**File/Naming Conventions**
- Folders and files: `kebab-case`
- Components and hooks: `PascalCase` (e.g., `UserCard.tsx`, `useAuth.ts`)
- Constants: `UPPER_SNAKE_CASE`
- Imports grouped: React → Next.js → Libraries → Local, using `@/` absolute paths

### Cypress Testing Conventions
- Use `data-cy` attributes for all element selectors — **never** CSS classes or IDs
- Naming: `data-cy="input-{fieldName}"`, `data-cy="button-{action}"`, `data-cy="form-{formName}"`
- Never use `cy.wait(milliseconds)` — always wait for elements or intercepted network requests
- Use `cy.intercept()` for API mocking; store fixtures in `cypress/fixtures/`
- Custom commands live in `cypress/support/commands.ts`

### Environment Variables
Environment files (`.env.develop`, `.env.staging`, `.env.prod`) are required to run the app. Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-side Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — server-only admin access (never expose to client)
- `MAILGUN_API_KEY`, `WISTIA_API_TOKEN`, `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL` — base URL used in email links

### Notable Integrations
- **Tiptap** rich text editor used in content creation forms
- **@dnd-kit** for drag-and-drop reordering
- **FFmpeg** (`@ffmpeg/ffmpeg`) for in-browser video processing before upload
- **Wistia API** for video hosting — videos are uploaded to Wistia, not Supabase Storage
- **ClickUp API** optional integration (controlled by `CLICKUP_ENABLED` env var)
- **Supabase Realtime** powers the direct messaging system
