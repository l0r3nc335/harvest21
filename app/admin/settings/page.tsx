import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

function LoadingFallback() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="h-8 w-64 bg-zinc-200 rounded animate-pulse mb-2"></div>
        <div className="h-4 w-96 bg-zinc-200 rounded animate-pulse"></div>
      </div>
      <div className="flex gap-6">
        <div className="w-64 bg-zinc-100 h-96 rounded animate-pulse"></div>
        <div className="flex-1 space-y-4">
          <div className="h-64 bg-zinc-100 rounded animate-pulse"></div>
          <div className="h-64 bg-zinc-100 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

async function AdminSettingsData() {
  const supabase = await getSupabaseServer();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Authentication Error</h1>
          <p className="text-zinc-600">Please log in to access settings.</p>
        </div>
      </div>
    );
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, role")
    .eq("user_id", user.id)
    .single();

  if (userError || !userData) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Profile Not Found</h1>
          <p className="text-zinc-600">Unable to load your profile data.</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminSettingsClient
        user={{
          id: user.id,
          email: user.email || "",
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
        }}
      />
    </Suspense>
  );
}

export default async function AdminSettingsPage() {
  return <AdminSettingsData />;
}

