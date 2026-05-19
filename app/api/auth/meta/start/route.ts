import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { META_OAUTH_SCOPES } from "@/lib/meta-oauth-scopes";
import { metaOAuthPopupResponse } from "@/lib/meta-oauth-popup-html";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";

const GRAPH = process.env.META_GRAPH_API_VERSION || "v21.0";

function appBase(): string {
  const b = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return b;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { success: withinLimit } = await rateLimitCheck(ip, "auth");
  if (!withinLimit) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const popup = searchParams.get("popup") === "1";
  const appId = process.env.META_APP_ID;

  if (!appId) {
    if (popup) {
      return metaOAuthPopupResponse({
        source: "harvest21-meta-oauth",
        status: "error",
        message: "META_APP_ID is not configured",
      });
    }
    return NextResponse.json({ error: "META_APP_ID is not configured" }, { status: 503 });
  }

  const intent = searchParams.get("intent");
  if (intent !== "facebook" && intent !== "instagram") {
    if (popup) {
      return metaOAuthPopupResponse({
        source: "harvest21-meta-oauth",
        status: "error",
        message: "Invalid intent",
      });
    }
    return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (popup) {
      return metaOAuthPopupResponse({
        source: "harvest21-meta-oauth",
        status: "error",
        message: "Please log in to Harvest 21 first, then try again.",
      });
    }
    return NextResponse.redirect(new URL("/login", appBase()));
  }

  const admin = await getSupabaseServer();
  const { data: m } = await admin.from("missionaries").select("id").eq("user_id", user.id).maybeSingle();
  if (!m?.id) {
    if (popup) {
      return metaOAuthPopupResponse({
        source: "harvest21-meta-oauth",
        status: "error",
        message: "Missionary profile required. Complete your account in Settings.",
      });
    }
    return NextResponse.redirect(new URL("/settings?tab=account", appBase()));
  }

  const state = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin.from("meta_oauth_states").insert({
    state_token: state,
    missionary_id: m.id,
    user_id: user.id,
    intent,
    expires_at: expiresAt,
  });

  const redirectUri = popup
    ? `${appBase()}/api/auth/meta/callback-popup`
    : `${appBase()}/api/auth/meta/callback`;
  const authUrl = new URL(`https://www.facebook.com/${GRAPH}/dialog/oauth`);
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", META_OAUTH_SCOPES);
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}
