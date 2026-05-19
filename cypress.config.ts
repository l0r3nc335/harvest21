import { defineConfig } from 'cypress'
import { createClient } from '@supabase/supabase-js'

// Env-var overrides let the same config serve both:
//   Local Supabase CLI (defaults below)
//   Docker stack: CYPRESS_SUPABASE_URL=http://supabase-kong:8000, demo JWT keys
const LOCAL_SUPABASE_URL = process.env.CYPRESS_SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Standard Supabase local-dev demo JWTs (public knowledge; same as docker-compose / Taskfile.yml).
// For hosted projects, set CYPRESS_SERVICE_ROLE_KEY in the environment — never commit real keys.
const DEMO_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const DEMO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const LOCAL_SERVICE_ROLE_KEY =
  process.env.CYPRESS_SERVICE_ROLE_KEY ?? DEMO_SERVICE_ROLE_KEY
const LOCAL_ANON_KEY = process.env.CYPRESS_ANON_KEY ?? DEMO_ANON_KEY

/** Create auth user via public signup (works with local GoTrue ES256; admin API does not accept sb_secret bearer). */
async function authAdminCreateUser(email: string, password: string) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: LOCAL_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const msg = String(body.msg || body.message || body.error_description || '')
    if (
      res.status === 400 ||
      res.status === 422 ||
      msg.toLowerCase().includes('already') ||
      msg.toLowerCase().includes('registered')
    ) {
      return { id: null, alreadyExisted: true }
    }
    throw new Error(`signup(${email}) HTTP ${res.status}: ${JSON.stringify(body)}`)
  }
  const user = body.user as Record<string, unknown> | undefined
  const id = user?.id as string | undefined
  if (!id) throw new Error(`signup(${email}): missing user id in ${JSON.stringify(body)}`)
  return { id, alreadyExisted: false }
}

async function authAdminGetUserId(email: string, password: string): Promise<string> {
  // Sign in to get the user ID for an existing user
  const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: LOCAL_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error(`signIn(${email}) failed: ${JSON.stringify(body)}`)
  return (body.user as Record<string, string>).id
}
const MAILPIT_URL = process.env.CYPRESS_MAILPIT_URL ?? 'http://127.0.0.1:54324'

// Test account definitions
const TEST_ACCOUNTS = {
  admin: {
    email: 'airken.99+admin@gmail.com',
    password: 'Test123!',
  },
  missionary1: {
    email: 'm1@h21test.local',
    password: 'Test123!',
    firstName: 'Alice',
    lastName: 'Waller',
    pageUrl: 'alice-waller',
    destinationCountry: 'KE',
    missionStatus: 'On-Field',
  },
  missionary2: {
    email: 'm2@h21test.local',
    password: 'Test123!',
    firstName: 'Bob',
    lastName: 'Carter',
    pageUrl: 'bob-carter',
    destinationCountry: 'BR',
    missionStatus: 'On-Field',
  },
  supporter: {
    email: 'supporter@h21test.local',
    password: 'Test123!',
    firstName: 'Carol',
    lastName: 'Smith',
  },
  church: {
    email: 'church@h21test.local',
    password: 'Test123!',
    firstName: 'David',
    lastName: 'Jones',
    churchName: 'Grace Community Church',
  },
  agency: {
    email: 'agency@h21test.local',
    password: 'Test123!',
    firstName: 'Eve',
    lastName: 'Brown',
    agencyName: 'Global Missions Agency',
  },
}

function getAdminClient() {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Seed helpers ────────────────────────────────────────────────────────────

async function createAuthUser(email: string, password: string, _role: number) {
  const { id, alreadyExisted } = await authAdminCreateUser(email, password)
  if (alreadyExisted || !id) {
    // User already exists — sign in to get their ID
    const existingId = await authAdminGetUserId(email, password)
    return { id: existingId, alreadyExisted: true }
  }
  return { id, alreadyExisted: false }
}

async function ensurePublicUser(userId: string, role: number, firstName: string, lastName: string, email: string) {
  const supabase = getAdminClient()
  const { data: existing } = await supabase.from('users').select('id').eq('user_id', userId).maybeSingle()
  if (existing) {
    // Reset name in case tests modified it
    await supabase.from('users').update({ first_name: firstName, last_name: lastName }).eq('id', existing.id)
    return existing.id
  }

  const { data, error } = await supabase
    .from('users')
    .insert({ user_id: userId, role, first_name: firstName, last_name: lastName, email, status: 'Active' })
    .select('id')
    .single()
  if (error) throw new Error(`insert public.users(${email}): ${error.message}`)
  return data.id
}

async function seedMissionary(acc: typeof TEST_ACCOUNTS.missionary1) {
  const supabase = getAdminClient()
  const { id: userId } = await createAuthUser(acc.email, acc.password, 3)
  await ensurePublicUser(userId, 3, acc.firstName, acc.lastName, acc.email)

  // Check by email (unique column) — user_id may differ if auth user was recreated
  const { data: existingM, error: selectErr } = await supabase
    .from('missionaries').select('id, user_id').eq('email', acc.email).maybeSingle()
  if (selectErr) console.warn(`seedMissionary select error (${acc.email}): ${selectErr.message}`)
  if (existingM) {
    // Keep user_id in sync if auth user was recreated
    if (existingM.user_id !== userId) {
      await supabase.from('missionaries').update({ user_id: userId }).eq('id', existingM.id)
    }
    // Also reset first/last name in case tests modified them
    await supabase.from('missionaries').update({ first_name: acc.firstName, last_name: acc.lastName }).eq('id', existingM.id)
    // Ensure page_url is reset and page is published so public URL works
    await supabase.from('pages').update({ page_url: acc.pageUrl, is_published: true }).eq('organization_id', existingM.id).eq('organization_type', 'missionary')
    return { missionaryId: existingM.id, pageUrl: acc.pageUrl }
  }

  const { data: mRow, error: mErr } = await supabase
    .from('missionaries')
    .insert({
      first_name: acc.firstName, last_name: acc.lastName, email: acc.email,
      destination_country: acc.destinationCountry, mission_status: acc.missionStatus,
      country_of_residence: 'US', open_to_visits: false,
      agency_id: 1, sending_church_id: 1, mission_field_church_id: 1, user_id: userId,
    })
    .select('id').single()
  if (mErr) throw new Error(`insert missionaries(${acc.email}): ${mErr.message}`)

  const { error: pErr } = await supabase.from('pages').insert({
    organization_type: 'missionary', organization_id: mRow.id, page_url: acc.pageUrl, is_published: true,
  })
  if (pErr) throw new Error(`insert pages(${acc.pageUrl}): ${pErr.message}`)

  return { missionaryId: mRow.id, pageUrl: acc.pageUrl }
}

async function seedSupporter(acc: typeof TEST_ACCOUNTS.supporter) {
  const supabase = getAdminClient()
  const { id: userId } = await createAuthUser(acc.email, acc.password, 4)
  await ensurePublicUser(userId, 4, acc.firstName, acc.lastName, acc.email)

  const { data: existing } = await supabase.from('supporter_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (existing) return { userId }

  const { error } = await supabase.from('supporter_profiles').insert({
    user_id: userId, first_name: acc.firstName, last_name: acc.lastName, email: acc.email, country_of_residence: 'US',
  })
  if (error) throw new Error(`insert supporter_profiles(${acc.email}): ${error.message}`)
  return { userId }
}

async function seedChurchContact(acc: typeof TEST_ACCOUNTS.church) {
  const supabase = getAdminClient()
  const { id: userId } = await createAuthUser(acc.email, acc.password, 6)
  await ensurePublicUser(userId, 6, acc.firstName, acc.lastName, acc.email)

  const { data: existing } = await supabase.from('churches').select('id').eq('contact_user_id', userId).maybeSingle()
  if (!existing) await supabase.from('churches').update({ contact_user_id: userId }).eq('id', 1)
  return { userId }
}

async function seedAgencyContact(acc: typeof TEST_ACCOUNTS.agency) {
  const supabase = getAdminClient()
  const { id: userId } = await createAuthUser(acc.email, acc.password, 5)
  await ensurePublicUser(userId, 5, acc.firstName, acc.lastName, acc.email)

  const { data: existing } = await supabase.from('agencies').select('id').eq('contact_user_id', userId).maybeSingle()
  if (!existing) await supabase.from('agencies').update({ contact_user_id: userId }).eq('id', 1)
  return { userId }
}

// ─── Cypress config ───────────────────────────────────────────────────────────

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    pageLoadTimeout: 30000,
    env: {
      MAILPIT_URL,
      LOCAL_SUPABASE_URL,
      LOCAL_ANON_KEY,
      testAccounts: TEST_ACCOUNTS,
    },
    setupNodeEvents(on, config) {
      on('task', {
        // ── Seed all test accounts ──────────────────────────────────────────
        async seedTestAccounts() {
          const results: Record<string, unknown> = {}

          results.missionary1 = await seedMissionary(TEST_ACCOUNTS.missionary1)
          results.missionary2 = await seedMissionary(TEST_ACCOUNTS.missionary2)
          results.supporter = await seedSupporter(TEST_ACCOUNTS.supporter)
          results.church = await seedChurchContact(TEST_ACCOUNTS.church)
          results.agency = await seedAgencyContact(TEST_ACCOUNTS.agency)

          console.log('✅ Test accounts seeded:', JSON.stringify(results, null, 2))
          return results
        },

        // ── Create a follow request (supporter → missionary) ─────────────
        async createFollowRequest({
          supporterEmail,
          missionaryId,
        }: {
          supporterEmail: string
          missionaryId: number
        }) {
          const supabase = getAdminClient()
          const { data: supporter } = await supabase.from('users').select('user_id').eq('email', supporterEmail).maybeSingle()
          if (!supporter) throw new Error(`Supporter ${supporterEmail} not found`)

          const { data: existing } = await supabase
            .from('missionary_followers')
            .select('id, status')
            .eq('user_id', supporter.user_id)
            .eq('missionary_id', missionaryId)
            .maybeSingle()
          if (existing) return { followId: existing.id, status: existing.status }

          const { data, error } = await supabase
            .from('missionary_followers')
            .insert({ user_id: supporter.user_id, missionary_id: missionaryId, status: 'pending' })
            .select('id')
            .single()
          if (error) throw new Error(`createFollowRequest: ${error.message}`)
          return { followId: data.id, status: 'pending' }
        },

        // ── Accept a follow request ───────────────────────────────────────
        async acceptFollowRequest({ followId }: { followId: number }) {
          const supabase = getAdminClient()
          const { error } = await supabase
            .from('missionary_followers')
            .update({ status: 'accepted' })
            .eq('id', followId)
          if (error) throw new Error(`acceptFollowRequest: ${error.message}`)
          return { accepted: true }
        },

        // ── Reset follower status ─────────────────────────────────────────
        async resetFollowerStatus({
          supporterEmail,
          missionaryId,
        }: {
          supporterEmail: string
          missionaryId: number
        }) {
          const supabase = getAdminClient()
          const { data: supporter } = await supabase.from('users').select('user_id').eq('email', supporterEmail).maybeSingle()
          if (!supporter) return { deleted: false }

          await supabase
            .from('missionary_followers')
            .delete()
            .eq('user_id', supporter.user_id)
            .eq('missionary_id', missionaryId)
          return { deleted: true }
        },

        // ── Get missionary ID by email ────────────────────────────────────
        async getMissionaryId({ email }: { email: string }) {
          const supabase = getAdminClient()
          const { data, error } = await supabase
            .from('missionaries')
            .select('id')
            .eq('email', email)
            .maybeSingle()
          if (error || !data) throw new Error(`getMissionaryId(${email}): not found`)
          const { data: pageRow } = await supabase.from('pages').select('page_url').eq('organization_id', data.id).eq('organization_type', 'missionary').maybeSingle()
          return { id: data.id, pageUrl: (pageRow as any)?.page_url }
        },

        // ── Mailpit: get latest email for address ─────────────────────────
        async getMailpitEmail({ to }: { to: string }) {
          const url = `${MAILPIT_URL}/api/v1/messages?query=to:${encodeURIComponent(to)}&limit=1`
          const res = await fetch(url)
          const json = await res.json() as { messages?: Array<{ ID: string; Subject: string }> }
          return json.messages?.[0] ?? null
        },

        // ── Mailpit: clear all messages ───────────────────────────────────
        async clearMailpit() {
          await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' })
          return null
        },

        // ── Verify follow request exists in DB ────────────────────────
        async getFollowerCount({ missionaryId }: { missionaryId: number }) {
          const supabase = getAdminClient()
          const { data, error } = await supabase
            .from('missionary_followers')
            .select('id, user_id, status')
            .eq('missionary_id', missionaryId)
          if (error) return { count: -1, error: error.message }
          return { count: data?.length ?? 0, rows: data }
        },

        log(msg: string) {
          console.log(msg)
          return null
        },
      })
      return config
    },
  },
})
