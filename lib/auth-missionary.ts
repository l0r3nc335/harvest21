import { getSupabaseServer } from "@/lib/supabaseServer";

export async function getMissionaryIdForAuthedUser(): Promise<number | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const admin = await getSupabaseServer();
  const { data: m } = await admin.from("missionaries").select("id").eq("user_id", user.id).maybeSingle();
  return (m?.id as number | undefined) ?? null;
}
