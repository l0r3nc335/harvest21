import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Client-side Supabase client
 * Use this in:
 * - Client Components ("use client")
 * - Browser contexts
 * - Components that need auth state management
 * 
 * Uses createBrowserClient to sync session to cookies for server-side access
 * For server-side usage, use getSupabaseServer() from ./supabaseServer
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);


