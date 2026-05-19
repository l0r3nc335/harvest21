import { MessageReportsPage } from "@/components/admin/MessageReportsPage";
import { Suspense } from "react";
import { fetchMessageReports } from "./fetchActions";

function TableLoadingFallback() {
  return <MessageReportsPage reports={[]} isInitialLoading={true} />;
}

async function ReportsData() {
  const reports = await fetchMessageReports();
  return <MessageReportsPage reports={reports} isInitialLoading={false} />;
}

export default function MessageReportsAdminPage() {
  return (
    <Suspense fallback={<TableLoadingFallback />}>
      <ReportsData />
    </Suspense>
  );
}
