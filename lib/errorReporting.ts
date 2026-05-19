/**
 * Server-side error reporter. Issues an opaque `incidentId` that can be
 * shown to users; the full error detail stays in server logs only.
 *
 * Safe to import from Edge Middleware — uses `console.error` only.
 * Production builds keep `console.error` (see next.config.ts
 * `compiler.removeConsole.exclude: ['error']`) so incidents are preserved
 * while other console calls are stripped.
 */

export interface IncidentContext {
  path?: string;
  method?: string;
  userId?: string;
  ip?: string;
  extra?: Record<string, unknown>;
}

export interface Incident {
  incidentId: string;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause instanceof Error ? err.cause.message : err.cause,
    };
  }
  return { value: String(err) };
}

export function reportServerError(
  err: unknown,
  ctx: IncidentContext = {}
): Incident {
  const incidentId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const entry = {
    level: "error",
    event: "server_error",
    incidentId,
    path: ctx.path,
    method: ctx.method,
    userId: ctx.userId,
    ip: ctx.ip,
    error: serializeError(err),
    extra: ctx.extra,
    timestamp: new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  console.error(JSON.stringify(entry));

  return { incidentId };
}
