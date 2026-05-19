import { LoginPageClient } from "./LoginPageClient";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    const isAdmin = userData?.role === 1 || userData?.role === 2;
    redirect(isAdmin ? "/admin" : "/settings");
  }

  return <LoginPageClient />;
}

