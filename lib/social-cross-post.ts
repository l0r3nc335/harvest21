import { getSupabaseServer, type SupabaseServerClient } from "@/lib/supabaseServer";
import { decryptJson } from "@/lib/token-crypto";
import { buildSocialCaption } from "@/lib/social-caption";
import * as meta from "@/lib/meta-graph";

export type SocialCrossKind = "prayer" | "text_update" | "photo" | "video" | "update_letter";

export type SocialCrossPostInput = {
  pageId: number;
  missionaryId: number;
  sourceTable: "page_media" | "page_widgets" | "prayers";
  sourceId: number;
  kind: SocialCrossKind;
  postToFacebook: boolean;
  postToInstagram: boolean;
  textBody: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video";
};

type TokenBundle = { userAccessToken: string; pageAccessToken: string };

async function upsertAttempt(
  admin: SupabaseServerClient,
  row: {
    missionary_id: number;
    source_table: string;
    source_id: number;
    platform: "facebook" | "instagram";
    status: "pending" | "posted" | "failed";
    external_post_id?: string | null;
    error_detail?: string | null;
  }
) {
  const { error } = await admin.from("social_cross_post_attempts").upsert(
    {
      missionary_id: row.missionary_id,
      source_table: row.source_table,
      source_id: row.source_id,
      platform: row.platform,
      status: row.status,
      external_post_id: row.external_post_id ?? null,
      error_detail: row.error_detail?.slice(0, 500) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_table,source_id,platform" }
  );
  if (error) {
    console.error("social_cross_post_attempts upsert:", error);
  }
}

export async function executeSocialCrossPost(input: SocialCrossPostInput): Promise<void> {
  const admin = await getSupabaseServer();
  let postIg = input.postToInstagram;
  if (input.kind === "prayer" || input.kind === "text_update") {
    postIg = false;
  }
  if (!input.postToFacebook && !postIg) {
    return;
  }

  const { data: page } = await admin.from("pages").select("page_url").eq("id", input.pageId).single();
  if (!page?.page_url) {
    return;
  }

  const caption = buildSocialCaption(input.textBody, page.page_url);

  const { data: conn } = await admin
    .from("missionary_social_connections")
    .select("*")
    .eq("missionary_id", input.missionaryId)
    .maybeSingle();

  if (!conn?.encrypted_token_bundle) {
    return;
  }

  let bundle: TokenBundle;
  try {
    bundle = decryptJson<TokenBundle>(conn.encrypted_token_bundle);
  } catch {
    return;
  }

  const fbPageId = conn.facebook_page_id as string | null;
  const pageToken = bundle.pageAccessToken;
  if (!fbPageId || !pageToken) {
    return;
  }

  const igUserId = conn.instagram_business_account_id as string | null;
  const fbConnected = conn.facebook_status === "connected";
  const igConnected = conn.instagram_status === "connected" && !!igUserId;

  const wantFb = input.postToFacebook && fbConnected;
  const wantIg = postIg && igConnected;

  if (!wantFb && !wantIg) {
    return;
  }

  const verified = await meta.verifyPageAccess(fbPageId, pageToken);
  if (!verified) {
    await admin
      .from("missionary_social_connections")
      .update({
        facebook_status: "reconnect_required",
        instagram_status: igConnected ? "reconnect_required" : conn.instagram_status,
        updated_at: new Date().toISOString(),
      })
      .eq("missionary_id", input.missionaryId);
    if (wantFb) {
      await upsertAttempt(admin, {
        missionary_id: input.missionaryId,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        platform: "facebook",
        status: "failed",
        error_detail: "Connection invalid. Reconnect required.",
      });
    }
    if (wantIg) {
      await upsertAttempt(admin, {
        missionary_id: input.missionaryId,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        platform: "instagram",
        status: "failed",
        error_detail: "Connection invalid. Reconnect required.",
      });
    }
    return;
  }

  const now = new Date().toISOString();
  await admin
    .from("missionary_social_connections")
    .update({
      last_facebook_verified_at: wantFb ? now : conn.last_facebook_verified_at,
      last_instagram_verified_at: wantIg ? now : conn.last_instagram_verified_at,
      updated_at: now,
    })
    .eq("missionary_id", input.missionaryId);

  if (wantFb) {
    await upsertAttempt(admin, {
      missionary_id: input.missionaryId,
      source_table: input.sourceTable,
      source_id: input.sourceId,
      platform: "facebook",
      status: "pending",
    });
    try {
      let externalId: string;
      if (input.kind === "prayer" || input.kind === "text_update") {
        const r = await meta.postFacebookFeedText(fbPageId, pageToken, caption);
        externalId = r.id;
      } else if (input.kind === "photo" || input.kind === "update_letter") {
        const url = input.mediaUrl;
        if (!url) {
          throw new Error("Missing image URL");
        }
        const r = await meta.postFacebookPhoto(fbPageId, pageToken, url, caption);
        externalId = r.post_id || r.id;
      } else if (input.kind === "video") {
        const url = input.mediaUrl;
        if (!url || /embed\/iframe/i.test(url)) {
          throw new Error("Video must be a direct file URL (e.g. from storage)");
        }
        const r = await meta.postFacebookVideo(fbPageId, pageToken, url, caption);
        externalId = r.id;
      } else {
        throw new Error("Unsupported content for Facebook");
      }
      await upsertAttempt(admin, {
        missionary_id: input.missionaryId,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        platform: "facebook",
        status: "posted",
        external_post_id: externalId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Facebook cross-post:", msg);
      await upsertAttempt(admin, {
        missionary_id: input.missionaryId,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        platform: "facebook",
        status: "failed",
        error_detail: msg,
      });
    }
  }

  if (wantIg && igUserId) {
    await upsertAttempt(admin, {
      missionary_id: input.missionaryId,
      source_table: input.sourceTable,
      source_id: input.sourceId,
      platform: "instagram",
      status: "pending",
    });
    try {
      const url = input.mediaUrl;
      if (!url || /embed\/iframe/i.test(url)) {
        throw new Error("Instagram requires a direct image or video URL");
      }
      let creationId: string;
      if (input.mediaType === "video" || input.kind === "video") {
        const c = await meta.createInstagramMediaVideo(igUserId, pageToken, url, caption);
        creationId = c.id;
      } else {
        const c = await meta.createInstagramMediaImage(igUserId, pageToken, url, caption);
        creationId = c.id;
      }
      await meta.waitForInstagramMediaReady(igUserId, pageToken, creationId);
      const pub = await meta.publishInstagramMedia(igUserId, pageToken, creationId);
      await upsertAttempt(admin, {
        missionary_id: input.missionaryId,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        platform: "instagram",
        status: "posted",
        external_post_id: pub.id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Instagram cross-post:", msg);
      await upsertAttempt(admin, {
        missionary_id: input.missionaryId,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        platform: "instagram",
        status: "failed",
        error_detail: msg,
      });
    }
  }
}
