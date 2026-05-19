import "server-only";
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/supabaseServiceRoleClient must never run in the browser");
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

let cached: ReturnType<typeof createClient> | null = null;

export function getServiceRoleSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase service role environment variables");
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
