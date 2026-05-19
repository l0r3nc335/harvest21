import Link from "next/link";

export type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500 | 503;

type Props = {
  status: ErrorStatus;
  incidentId?: string;
  reset?: () => void;
  homeHref?: string;
};

const GENERIC_COPY: Record<ErrorStatus, { title: string; body: string }> = {
  400: {
    title: "Something wasn't right with that request.",
    body: "Please check the address and try again.",
  },
  401: {
    title: "You need to sign in to continue.",
    body: "Please log in and try again.",
  },
  403: {
    title: "You don't have access to this page.",
    body: "If you believe this is a mistake, contact support.",
  },
  404: {
    title: "We couldn't find that page.",
    body: "The page you were looking for may have moved or no longer exists.",
  },
  429: {
    title: "Too many requests.",
    body: "Please wait a moment and try again.",
  },
  500: {
    title: "Something went wrong on our end.",
    body: "We've been notified and are looking into it.",
  },
  503: {
    title: "We're temporarily unavailable.",
    body: "Please try again shortly.",
  },
};

export function ErrorScreen({ status, incidentId, reset, homeHref = "/" }: Props) {
  const copy = GENERIC_COPY[status] ?? GENERIC_COPY[500];

  return (
    <div
      data-error-status={status}
      data-incident={incidentId}
      className="min-h-screen flex items-center justify-center bg-zinc-50 px-6 py-12"
    >
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#D3AF37]/10 text-[#D3AF37] text-2xl font-semibold mb-6">
          H21
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">
          {copy.title}
        </h1>
        <p className="text-zinc-600 mb-8">{copy.body}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-md bg-[#D3AF37] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#c19d2d] transition-colors"
          >
            Return home
          </Link>
          {reset && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
        {incidentId && (
          <p className="mt-8 text-xs text-zinc-400">
            Reference: <span className="font-mono">{incidentId}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default ErrorScreen;
