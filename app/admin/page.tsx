import { getSupabaseServer } from "@/lib/supabaseServer";
import { SignInForm } from "@/components/auth/SignInForm";
import { Dashboard } from "@/components/admin/Dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-zinc-900 text-zinc-100">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-white p-6 text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-100">
            <h1 className="mb-6 text-center text-lg font-semibold">
              Harvest21 Admin Portal
            </h1>
            <SignInForm />
          </div>
        </div>
      </div>
    );
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAuthorized = userRow?.role === 1 || userRow?.role === 2;

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-zinc-900">Access denied</p>
          <p className="text-sm text-zinc-500">Admin privileges are required.</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
