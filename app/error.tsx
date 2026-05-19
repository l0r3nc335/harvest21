"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[route-error]", error.digest, error.message);
    }
  }, [error]);

  return <ErrorScreen status={500} incidentId={error.digest} reset={reset} />;
}
