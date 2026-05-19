import { getSupabaseServer } from "@/lib/supabaseServer";
import {
  exchangeCodeForShortUserToken,
  exchangeForLongLivedUserToken,
  fetchUserPages,
  type MetaPageAccount,
} from "@/lib/meta-graph";
import { encryptJson } from "@/lib/token-crypto";
import { saveFacebookConnection, saveInstagramConnection } from "@/lib/missionary-social-connection";

export type MetaOAuthCallbackResult =
  | { kind: "error"; message: string }
  | { kind: "done"; platform: "facebook" | "instagram" }
  | { kind: "pick"; intent: "facebook" | "instagram"; pendingId: string };

export async function runMetaOAuthCallback(
  code: string,
  state: string,
  redirectUri: string
): Promise<MetaOAuthCallbackResult> {
  const admin = await getSupabaseServer();

  const { data: st, error: stErr } = await admin
    .from("meta_oauth_states")
    .select("*")
    .eq("state_token", state)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stErr || !st) {
    return { kind: "error", message: "Invalid or expired login state. Try again." };
  }

  await admin.from("meta_oauth_states").delete().eq("state_token", state);

  const missionaryId = st.missionary_id as number;
  const intent = st.intent as "facebook" | "instagram";

  try {
    const short = await exchangeCodeForShortUserToken(code, redirectUri);
    const long = await exchangeForLongLivedUserToken(short.access_token);
    const pages = await fetchUserPages(long.access_token);

    if (!pages.length) {
      return { kind: "error", message: "No Facebook Pages found for this account." };
    }

    if (intent === "facebook") {
      if (pages.length === 1) {
        await saveFacebookConnection(missionaryId, pages[0], long.access_token);
        return { kind: "done", platform: "facebook" };
      }
      const { data: pend, error: pe } = await admin
        .from("meta_oauth_pending")
        .insert({
          missionary_id: missionaryId,
          user_id: st.user_id as string,
          intent: "facebook",
          encrypted_payload: encryptJson({
            userLongLivedToken: long.access_token,
            accounts: pages,
          }),
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (pe || !pend) {
        return { kind: "error", message: "Could not save page selection session." };
      }
      return { kind: "pick", intent: "facebook", pendingId: pend.id as string };
    }

    const withIg: MetaPageAccount[] = pages.filter((p) => p.instagram_business_account?.id);
    if (!withIg.length) {
      return {
        kind: "error",
        message:
          "No Instagram Business account is linked to your Pages. Use a Professional Instagram linked to a Facebook Page.",
      };
    }
    if (withIg.length === 1) {
      await saveInstagramConnection(missionaryId, withIg[0], long.access_token);
      return { kind: "done", platform: "instagram" };
    }
    const { data: pend, error: pe } = await admin
      .from("meta_oauth_pending")
      .insert({
        missionary_id: missionaryId,
        user_id: st.user_id as string,
        intent: "instagram",
        encrypted_payload: encryptJson({
          userLongLivedToken: long.access_token,
          accounts: withIg,
        }),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (pe || !pend) {
      return { kind: "error", message: "Could not save page selection session." };
    }
    return { kind: "pick", intent: "instagram", pendingId: pend.id as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth failed";
    return { kind: "error", message: msg.slice(0, 200) };
  }
}
