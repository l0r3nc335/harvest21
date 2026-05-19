import { CollegesPageClient } from "@/components/admin/CollegesPage";
import { Suspense } from "react";
import { fetchColleges } from "./fetchActions";

function TableLoadingFallback() {
  return <CollegesPageClient initialColleges={[]} isInitialLoading={true} />;
}

async function CollegesData() {
  const colleges = await fetchColleges();
  return <CollegesPageClient initialColleges={colleges} isInitialLoading={false} />;
}

export default function CollegesPage() {
  return (
    <Suspense fallback={<TableLoadingFallback />}>
      <CollegesData />
    </Suspense>
  );
}
