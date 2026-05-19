import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/auth-js";

if (typeof window !== "undefined") {
  throw new Error("lib/authAdmin must never run in the browser");
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

let cachedClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase admin environment variables");
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}

export interface AdminCreateUserInput {
  email: string;
  password?: string;
  emailConfirm?: boolean;
  userMetadata?: Record<string, unknown>;
}

export async function adminCreateUser(
  input: AdminCreateUserInput
): Promise<{ user: User | null; error: { message: string } | null }> {
  const client = getClient();
  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: input.emailConfirm ?? true,
    user_metadata: input.userMetadata,
  });
  return { user: data?.user ?? null, error: error ? { message: error.message } : null };
}

export async function adminDeleteUser(
  userId: string
): Promise<{ error: { message: string } | null }> {
  const client = getClient();
  const { error } = await client.auth.admin.deleteUser(userId);
  return { error: error ? { message: error.message } : null };
}

export async function adminSetPassword(
  userId: string,
  password: string
): Promise<{ error: { message: string } | null }> {
  const client = getClient();
  const { error } = await client.auth.admin.updateUserById(userId, { password });
  return { error: error ? { message: error.message } : null };
}

export async function adminUpdateUser(
  userId: string,
  attrs: { email?: string; password?: string; userMetadata?: Record<string, unknown> }
): Promise<{ user: User | null; error: { message: string } | null }> {
  const client = getClient();
  const { data, error } = await client.auth.admin.updateUserById(userId, {
    email: attrs.email,
    password: attrs.password,
    user_metadata: attrs.userMetadata,
  });
  return { user: data?.user ?? null, error: error ? { message: error.message } : null };
}

export async function adminGetUserByEmail(
  email: string
): Promise<{ user: User | null }> {
  const client = getClient();
  const { data } = await client.auth.admin.listUsers({ perPage: 1 });
  const users = (data?.users ?? []) as User[];
  const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  return { user: match };
}

export async function adminGlobalSignOut(
  userId: string
): Promise<{ error: { message: string } | null }> {
  const client = getClient();
  const { error } = await client.auth.admin.signOut(userId, "global");
  return { error: error ? { message: error.message } : null };
}

export async function adminGenerateRecoveryLink(
  email: string,
  redirectTo?: string
): Promise<{
  actionLink: string | null;
  hashedToken: string | null;
  error: { message: string } | null;
}> {
  const client = getClient();
  const { data, error } = await client.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  return {
    actionLink: data?.properties?.action_link ?? null,
    hashedToken: data?.properties?.hashed_token ?? null,
    error: error ? { message: error.message } : null,
  };
}
