import { runMetaOAuthCallback } from "@/lib/meta-oauth-callback-logic";
import { metaOAuthPopupResponse } from "@/lib/meta-oauth-popup-html";

function appBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    return metaOAuthPopupResponse({
      source: "harvest21-meta-oauth",
      status: "error",
      message: oauthError.slice(0, 200),
    });
  }
  if (!code || !state) {
    return metaOAuthPopupResponse({
      source: "harvest21-meta-oauth",
      status: "error",
      message: "Missing OAuth parameters",
    });
  }

  const redirectUri = `${appBase()}/api/auth/meta/callback-popup`;
  const result = await runMetaOAuthCallback(code, state, redirectUri);

  if (result.kind === "error") {
    return metaOAuthPopupResponse({
      source: "harvest21-meta-oauth",
      status: "error",
      message: result.message,
    });
  }
  if (result.kind === "done") {
    return metaOAuthPopupResponse({
      source: "harvest21-meta-oauth",
      status: "success",
      platform: result.platform,
    });
  }
  return metaOAuthPopupResponse({
    source: "harvest21-meta-oauth",
    status: "pick",
    intent: result.intent,
    pendingId: result.pendingId,
  });
}
