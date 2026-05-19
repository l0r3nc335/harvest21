import { AgenciesPageClient } from "@/components/admin/AgenciesPage";
import { Suspense } from "react";
import { fetchAgencies } from "./fetchActions";

function TableLoadingFallback() {
  return <AgenciesPageClient initialAgencies={[]} isInitialLoading={true} />;
}

async function AgenciesData() {
  const agencies = await fetchAgencies();
  return <AgenciesPageClient initialAgencies={agencies} isInitialLoading={false} />;
}

export default function AgenciesPage() {
  return (
    <Suspense fallback={<TableLoadingFallback />}>
      <AgenciesData />
    </Suspense>
  );
}
