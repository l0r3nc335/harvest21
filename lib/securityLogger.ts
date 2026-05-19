/**
 * Structured security event logger.
 *
 * Emits JSON logs to stdout and persists to public.security_events for
 * admin-readable audit history. Sensitive fields (tokens, passwords,
 * full IPs) are NEVER logged.
 */

import "server-only";

export type SecurityEvent =
  | "auth_failure"
  | "rate_limit_hit"
  | "input_validation_failure"
  | "forbidden_access"
  | "upload_rejected"
  | "cors_rejected"
  | "csrf_failure"
  | "server_error"
  | "suspicious_request";

interface SecurityLogEntry {
  level: "warn" | "error";
  event: SecurityEvent;
  ip?: string;
  ipCidr?: string;
  path?: string;
  method?: string;
  userId?: string;
  detail?: string;
  incidentId?: string;
  timestamp: string;
}

function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 2).join(":")}:x:x`;
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return "unknown";
}

function toCidr(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").slice(0, 4);
    while (parts.length < 4) parts.push("0");
    return `${parts.join(":")}::/64`;
  }
  const v4 = ip.split(".");
  if (v4.length === 4 && v4.every((p) => /^\d+$/.test(p))) {
    return `${v4[0]}.${v4[1]}.${v4[2]}.0/24`;
  }
  return null;
}

async function persist(entry: SecurityLogEntry): Promise<void> {
  try {
    const { getSupabaseServer } = await import("@/lib/supabaseServer");
    const supabase = await getSupabaseServer();
    await supabase.rpc("log_security_event", {
      p_event_type: entry.event,
      p_path: entry.path ?? null,
      p_method: entry.method ?? null,
      p_user_id: entry.userId ?? null,
      p_ip: entry.ip ?? null,
      p_ip_cidr: entry.ipCidr ?? null,
      p_detail: entry.detail ? { detail: entry.detail } : null,
      p_incident_id: entry.incidentId ?? null,
    });
  } catch {
    // Persistence must never bubble up — stdout log is the source of truth.
  }
}

export function logSecurityEvent(
  event: SecurityEvent,
  opts: {
    ip?: string;
    path?: string;
    method?: string;
    userId?: string;
    detail?: string;
    incidentId?: string;
  } = {}
): void {
  const entry: SecurityLogEntry = {
    level:
      event === "auth_failure" ||
      event === "forbidden_access" ||
      event === "server_error" ||
      event === "csrf_failure"
        ? "error"
        : "warn",
    event,
    ip: opts.ip ? maskIp(opts.ip) : undefined,
    ipCidr: opts.ip ? toCidr(opts.ip) ?? undefined : undefined,
    path: opts.path,
    method: opts.method,
    userId: opts.userId,
    detail: opts.detail,
    incidentId: opts.incidentId,
    timestamp: new Date().toISOString(),
  };

  if (entry.level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.warn(JSON.stringify(entry));
  }

  void persist(entry);
}
