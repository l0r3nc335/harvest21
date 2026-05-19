import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { fetchFeaturedSections } from "./fetchActions";
import { FeaturedSectionsClient } from "@/components/admin/FeaturedSectionsClient";

async function FeaturedSectionsData() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const result = await fetchFeaturedSections();

  if (!result.success) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
          <p className="text-red-500">{result.error || "Failed to load featured sections"}</p>
        </div>
      </div>
    );
  }

  return <FeaturedSectionsClient sections={result.data ?? []} />;
}

function LoadingFallback() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-zinc-200 rounded w-1/4"></div>
        <div className="h-48 bg-zinc-200 rounded"></div>
        <div className="h-48 bg-zinc-200 rounded"></div>
      </div>
    </div>
  );
}

export default async function FeaturedSectionsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FeaturedSectionsData />
    </Suspense>
  );
}
