import { NextRequest, NextResponse } from "next/server";
import { runMetaOAuthCallback } from "@/lib/meta-oauth-callback-logic";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";

function appBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

function redirectToSettings(query: Record<string, string>) {
  const u = new URL("/settings", appBase());
  u.searchParams.set("tab", "social-media-connection");
  Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v));
  return NextResponse.redirect(u.toString());
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { success: withinLimit } = await rateLimitCheck(ip, "auth");
  if (!withinLimit) {
    return redirectToSettings({ meta_error: "Too many requests" });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    return redirectToSettings({ meta_error: oauthError.slice(0, 200) });
  }
  if (!code || !state) {
    return redirectToSettings({ meta_error: "Missing OAuth parameters" });
  }

  const redirectUri = `${appBase()}/api/auth/meta/callback`;
  const result = await runMetaOAuthCallback(code, state, redirectUri);

  if (result.kind === "error") {
    return redirectToSettings({ meta_error: result.message });
  }
  if (result.kind === "done") {
    return redirectToSettings({ meta_done: result.platform });
  }
  return redirectToSettings({
    meta_pick: result.intent,
    meta_pending: result.pendingId,
  });
}
