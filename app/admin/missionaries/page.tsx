import { MissionariesPageClient } from "@/components/admin/MissionariesPage";
import { Suspense } from "react";
import { fetchMissionaries } from "./fetchActions";
import type { Missionary } from "@/types/missionary";

function TableLoadingFallback() {
  return <MissionariesPageClient initialMissionaries={[]} isInitialLoading={true} />;
}

async function MissionariesData() {
  const missionaries = await fetchMissionaries();
  return <MissionariesPageClient initialMissionaries={missionaries} isInitialLoading={false} />;
}

export default function MissionariesPage() {
  return (
    <Suspense fallback={<TableLoadingFallback />}>
      <MissionariesData />
    </Suspense>
  );
}
