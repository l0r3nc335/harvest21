import { ChurchesPageClient } from "@/components/admin/ChurchesPage";
import { Suspense } from "react";
import { fetchChurches } from "./fetchActions";

function TableLoadingFallback() {
  return <ChurchesPageClient initialChurches={[]} isInitialLoading={true} />;
}

async function ChurchesData() {
  const churches = await fetchChurches();
  return <ChurchesPageClient initialChurches={churches} isInitialLoading={false} />;
}

export default function ChurchesPage() {
  return (
    <Suspense fallback={<TableLoadingFallback />}>
      <ChurchesData />
    </Suspense>
  );
}
