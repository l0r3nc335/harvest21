"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdForAuthedUser } from "@/lib/auth-missionary";

export type SocialConnectionSummary = {
  facebookStatus: string;
  instagramStatus: string;
  facebookPageName: string | null;
  instagramUsername: string | null;
  lastFacebookVerifiedAt: string | null;
  lastInstagramVerifiedAt: string | null;
} | null;

export async function getSocialConnectionSummary(): Promise<SocialConnectionSummary> {
  const mid = await getMissionaryIdForAuthedUser();
  if (!mid) {
    return null;
  }
  const admin = await getSupabaseServer();
  const { data } = await admin
    .from("missionary_social_connections")
    .select(
      "facebook_status, instagram_status, facebook_page_name, instagram_username, last_facebook_verified_at, last_instagram_verified_at"
    )
    .eq("missionary_id", mid)
    .maybeSingle();

  if (!data) {
    return null;
  }
  return {
    facebookStatus: data.facebook_status as string,
    instagramStatus: data.instagram_status as string,
    facebookPageName: data.facebook_page_name as string | null,
    instagramUsername: data.instagram_username as string | null,
    lastFacebookVerifiedAt: data.last_facebook_verified_at as string | null,
    lastInstagramVerifiedAt: data.last_instagram_verified_at as string | null,
  };
}

export async function getRecentSocialCrossPosts(limit = 8): Promise<
  Array<{
    platform: string;
    status: string;
    source_table: string;
    source_id: number;
    error_detail: string | null;
    updated_at: string;
  }>
> {
  const mid = await getMissionaryIdForAuthedUser();
  if (!mid) {
    return [];
  }
  const admin = await getSupabaseServer();
  const { data } = await admin
    .from("social_cross_post_attempts")
    .select("platform, status, source_table, source_id, error_detail, updated_at")
    .eq("missionary_id", mid)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data || []) as Array<{
    platform: string;
    status: string;
    source_table: string;
    source_id: number;
    error_detail: string | null;
    updated_at: string;
  }>;
}

export async function getSocialCrossPostEligibility(pageId: number): Promise<{
  canPostFacebook: boolean;
  canPostInstagram: boolean;
}> {
  try {
    const mid = await getMissionaryIdForAuthedUser();
    if (!mid || !pageId) {
      return { canPostFacebook: false, canPostInstagram: false };
    }
    const admin = await getSupabaseServer();
    const { data: page } = await admin
      .from("pages")
      .select("organization_type, organization_id")
      .eq("id", pageId)
      .single();

    if (page?.organization_type !== "missionary" || page.organization_id !== mid) {
      return { canPostFacebook: false, canPostInstagram: false };
    }

    const { data: c } = await admin
      .from("missionary_social_connections")
      .select("facebook_status, instagram_status")
      .eq("missionary_id", mid)
      .maybeSingle();

    return {
      canPostFacebook: c?.facebook_status === "connected",
      canPostInstagram: c?.instagram_status === "connected",
    };
  } catch {
    return { canPostFacebook: false, canPostInstagram: false };
  }
}
