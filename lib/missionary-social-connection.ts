import { getSupabaseServer } from "@/lib/supabaseServer";
import { encryptJson } from "@/lib/token-crypto";
import type { MetaPageAccount } from "@/lib/meta-graph";

function tokenExpiryIso(): string {
  return new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString();
}

export async function saveFacebookConnection(
  missionaryId: number,
  account: MetaPageAccount,
  userLongLivedToken: string
): Promise<void> {
  const admin = await getSupabaseServer();
  const bundle = encryptJson({
    userAccessToken: userLongLivedToken,
    pageAccessToken: account.access_token,
  });
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("missionary_social_connections")
    .select(
      "instagram_status, instagram_business_account_id, instagram_username, facebook_status"
    )
    .eq("missionary_id", missionaryId)
    .maybeSingle();

  const row: Record<string, unknown> = {
    missionary_id: missionaryId,
    facebook_page_id: account.id,
    facebook_page_name: account.name,
    encrypted_token_bundle: bundle,
    token_expires_at: tokenExpiryIso(),
    facebook_status: "connected",
    last_facebook_verified_at: now,
    updated_at: now,
  };

  if (existing?.instagram_status === "connected") {
    row.instagram_status = "connected";
    row.instagram_business_account_id = existing.instagram_business_account_id;
    row.instagram_username = existing.instagram_username;
  } else {
    row.instagram_status = "not_connected";
    row.instagram_business_account_id = null;
    row.instagram_username = null;
  }

  const { error } = await admin.from("missionary_social_connections").upsert(row, {
    onConflict: "missionary_id",
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function saveInstagramConnection(
  missionaryId: number,
  account: MetaPageAccount,
  userLongLivedToken: string
): Promise<void> {
  const ig = account.instagram_business_account;
  if (!ig?.id) {
    throw new Error("This Facebook Page has no Instagram Business account linked.");
  }

  const admin = await getSupabaseServer();
  const bundle = encryptJson({
    userAccessToken: userLongLivedToken,
    pageAccessToken: account.access_token,
  });
  const now = new Date().toISOString();

  const { error } = await admin.from("missionary_social_connections").upsert(
    {
      missionary_id: missionaryId,
      facebook_page_id: account.id,
      facebook_page_name: account.name,
      instagram_business_account_id: ig.id,
      instagram_username: ig.username ?? null,
      encrypted_token_bundle: bundle,
      token_expires_at: tokenExpiryIso(),
      facebook_status: "connected",
      instagram_status: "connected",
      last_facebook_verified_at: now,
      last_instagram_verified_at: now,
      updated_at: now,
    },
    { onConflict: "missionary_id" }
  );
  if (error) {
    throw new Error(error.message);
  }
}
