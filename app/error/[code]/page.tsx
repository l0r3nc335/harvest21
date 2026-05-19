import { notFound } from "next/navigation";
import ErrorScreen, { type ErrorStatus } from "@/components/errors/ErrorScreen";

const ALLOWED: ReadonlySet<number> = new Set([400, 401, 403, 404, 429, 500, 503]);

type Params = Promise<{ code: string }>;

export default async function ErrorByCodePage({ params }: { params: Params }) {
  const { code } = await params;
  const numeric = Number(code);
  if (!ALLOWED.has(numeric)) {
    notFound();
  }
  return <ErrorScreen status={numeric as ErrorStatus} />;
}
