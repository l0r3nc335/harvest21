"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";
import { getChurchFollowerStatus } from "@/app/admin/churches/actions";

export type ChurchTabMissionary = {
  id: number;
  first_name: string;
  last_name: string;
  destination_country: string | null;
  country_of_residence: string | null;
  is_managed_by_harvest21: boolean;
  page_url: string;
  profile_photo_url: string | null;
  page_name: string | null;
  is_published: boolean;
  follower_status: string;
};

type FetchChurchMissionariesOptions = {
  /** When false, only owner or accepted follower may load (e.g. OrganizationPublicView). Default true (ChurchPublicView: includes managed churches with no contact). */
  allowManagedNoContact?: boolean;
};

/**
 * Live query for church "Our Missionaries" tab.
 */
export async function fetchFreshChurchOurMissionaries(
  churchId: number,
  options?: FetchChurchMissionariesOptions
): Promise<{ success: boolean; missionaries: ChurchTabMissionary[]; error?: string }> {
  const allowManagedNoContact = options?.allowManagedNoContact !== false;
  if (!Number.isFinite(churchId) || churchId < 1) {
    return { success: false, missionaries: [], error: "Invalid church" };
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const supabaseAdmin = await getSupabaseServer();
  const { data: church, error: churchErr } = await supabaseAdmin
    .from("churches")
    .select("id, contact_user_id")
    .eq("id", churchId)
    .maybeSingle();

  if (churchErr || !church) {
    return { success: false, missionaries: [], error: "Church not found" };
  }

  const isOwner = !!currentUserId && church.contact_user_id === currentUserId;
  const isManagedNoContact = church.contact_user_id == null;
  const followerStatus = currentUserId
    ? await getChurchFollowerStatus(churchId)
    : "none";
  const canView =
    isOwner ||
    followerStatus === "accepted" ||
    (allowManagedNoContact && isManagedNoContact);

  if (!canView) {
    return { success: true, missionaries: [] };
  }

  const { data: missionaryChurches } = await supabaseAdmin
    .from("missionary_churches")
    .select(`
      missionary:missionaries (
        id,
        first_name,
        last_name,
        country_of_residence,
        destination_country,
        is_managed_by_harvest21
      )
    `)
    .eq("church_id", churchId)
    .eq("is_active", true);

  const { data: sendingChurchMissionaries } = await supabaseAdmin
    .from("missionaries")
    .select(
      "id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21"
    )
    .eq("sending_church_id", churchId);

  const { data: missionFieldChurchMissionaries } = await supabaseAdmin
    .from("missionaries")
    .select(
      "id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21"
    )
    .eq("mission_field_church_id", churchId);

  type RawM = {
    id: number;
    first_name: string;
    last_name: string;
    country_of_residence?: string | null;
    destination_country?: string | null;
    is_managed_by_harvest21?: boolean;
  };

  const fromPivot = (missionaryChurches || [])
    .map((mc: { missionary: unknown }) => (mc as { missionary: unknown }).missionary)
    .filter((m: unknown): m is RawM => m != null);
  const fromSending = (sendingChurchMissionaries || []) as RawM[];
  const fromMissionField = (missionFieldChurchMissionaries || []) as RawM[];
  const seenIds = new Set<number>();
  const rawMissionaries: RawM[] = [];
  for (const m of fromPivot) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      rawMissionaries.push(m);
    }
  }
  for (const m of fromSending) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      rawMissionaries.push(m);
    }
  }
  for (const m of fromMissionField) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      rawMissionaries.push(m);
    }
  }
  rawMissionaries.sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));

  const activeUserMissionaryIds = await getMissionaryIdsWithActiveUsers(
    supabaseAdmin,
    rawMissionaries.map((m) => m.id)
  );
  const missionariesForListing = rawMissionaries.filter((m) =>
    activeUserMissionaryIds.has(m.id)
  );

  if (missionariesForListing.length === 0) {
    return { success: true, missionaries: [] };
  }

  const missionaryIds = missionariesForListing.map((m) => m.id);
  const pagesQuery = supabaseAdmin
    .from("pages")
    .select("organization_id, page_url, name, profile_photo_url, is_published")
    .eq("organization_type", "missionary")
    .in("organization_id", missionaryIds);

  const { data: missionaryPages } = isOwner
    ? await pagesQuery
    : await pagesQuery.eq("is_published", true);

  type MissionaryPageRow = {
    organization_id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    is_published: boolean;
  };
  const pageMap = new Map<number, MissionaryPageRow>(
    (missionaryPages || []).map((p: MissionaryPageRow) => [p.organization_id, p])
  );

  const followerStatusMap = new Map<number, string>();
  if (currentUserId && missionaryIds.length > 0) {
    const { data: follows } = await supabaseAdmin
      .from("missionary_followers")
      .select("missionary_id, status")
      .eq("user_id", currentUserId)
      .in("missionary_id", missionaryIds);
    (follows || []).forEach((f: { missionary_id: number; status: string }) => {
      followerStatusMap.set(f.missionary_id, f.status);
    });
  }

  const list: ChurchTabMissionary[] = isOwner
    ? missionariesForListing.map((m) => {
        const page = pageMap.get(m.id);
        return {
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          destination_country: m.destination_country ?? null,
          country_of_residence: m.country_of_residence ?? null,
          is_managed_by_harvest21: m.is_managed_by_harvest21 ?? false,
          page_url: page?.page_url ?? "",
          profile_photo_url: page?.profile_photo_url ?? null,
          page_name: page?.name ?? null,
          is_published: page?.is_published ?? false,
          follower_status: followerStatusMap.get(m.id) || "none",
        };
      })
    : missionariesForListing
        .filter((m) => pageMap.has(m.id))
        .map((m) => {
          const page = pageMap.get(m.id)!;
          return {
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            destination_country: m.destination_country ?? null,
            country_of_residence: m.country_of_residence ?? null,
            is_managed_by_harvest21: m.is_managed_by_harvest21 ?? false,
            page_url: page.page_url,
            profile_photo_url: page.profile_photo_url ?? null,
            page_name: page.name ?? null,
            is_published: true,
            follower_status: followerStatusMap.get(m.id) || "none",
          };
        });

  return { success: true, missionaries: list };
}
