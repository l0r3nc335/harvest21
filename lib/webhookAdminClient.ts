import "server-only";
import { createClient } from "@supabase/supabase-js";

type WebhookAdminSupabase = ReturnType<typeof createClient>;

/**
 * Service-role Supabase client reserved for Stripe webhook processing where no
 * user session is present. This is the ONLY module in the Next.js app that is
 * allowed to construct a service-role client for database access.
 *
 * Access is locked down by ESLint (`no-restricted-imports`) and a CI grep
 * guard. Allowed consumers are limited to:
 *   - app/api/webhooks/stripe/route.ts
 *   - lib/donationHelpers.ts
 *   - lib/donationReceipt.ts
 *   - lib/stripeDonationEmails.ts
 *   - lib/oneTimeDonationSideEffects.ts
 *   - lib/stripeRecurringDonationPersist.ts
 *
 * All other server-side code MUST use `getSupabaseServer()` (RLS-enforced) or
 * the narrow auth admin helpers in `lib/authAdmin.ts`.
 *
 * TODO: migrate the Stripe webhook to a Supabase Edge Function and remove
 * SUPABASE_SERVICE_ROLE_KEY from the Next.js runtime entirely.
 */

if (typeof window !== "undefined") {
  throw new Error("lib/webhookAdminClient must never run in the browser");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (process.env.NODE_ENV === "production") {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production"
    );
  }
}

let cached: WebhookAdminSupabase | null = null;

export function getWebhookAdminClient(): WebhookAdminSupabase {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase admin environment variables");
  }
  if (!cached) {
    cached = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cached;
}

export type WebhookAdminClient = WebhookAdminSupabase;
