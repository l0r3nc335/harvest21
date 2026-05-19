"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[global-error]", error.digest, error.message);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorScreen status={500} incidentId={error.digest} reset={reset} />
      </body>
    </html>
  );
}
