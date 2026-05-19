"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";

export type AgencyTabMissionary = {
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

/**
 * Live query for agency "Our Missionaries" tab (public: published pages + Active users only).
 */
export async function fetchFreshAgencyOurMissionaries(
  agencyId: number
): Promise<{ success: boolean; missionaries: AgencyTabMissionary[]; error?: string }> {
  if (!Number.isFinite(agencyId) || agencyId < 1) {
    return { success: false, missionaries: [], error: "Invalid agency" };
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const supabaseAdmin = await getSupabaseServer();

  const { data: agencyMissionaries } = await supabaseAdmin
    .from("missionaries")
    .select(
      "id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21"
    )
    .eq("agency_id", agencyId)
    .order("last_name", { ascending: true });

  if (!agencyMissionaries?.length) {
    return { success: true, missionaries: [] };
  }

  const activeIds = await getMissionaryIdsWithActiveUsers(
    supabaseAdmin,
    agencyMissionaries.map((m: { id: number }) => m.id)
  );
  const visible = agencyMissionaries.filter((m: { id: number }) => activeIds.has(m.id));

  if (!visible.length) {
    return { success: true, missionaries: [] };
  }

  const missionaryIds = visible.map((m: { id: number }) => m.id);
  const { data: missionaryPages } = await supabaseAdmin
    .from("pages")
    .select("organization_id, page_url, name, profile_photo_url, is_published")
    .eq("organization_type", "missionary")
    .in("organization_id", missionaryIds)
    .eq("is_published", true);

  type PageRow = {
    organization_id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    is_published: boolean;
  };
  const pageMap = new Map<number, PageRow>(
    (missionaryPages || []).map((p: PageRow) => [p.organization_id, p])
  );

  const followerStatusMap = new Map<number, string>();
  if (currentUserId) {
    const { data: follows } = await supabaseAdmin
      .from("missionary_followers")
      .select("missionary_id, status")
      .eq("user_id", currentUserId)
      .in("missionary_id", missionaryIds);
    (follows || []).forEach((f: { missionary_id: number; status: string }) => {
      followerStatusMap.set(f.missionary_id, f.status);
    });
  }

  const list: AgencyTabMissionary[] = visible
    .filter((m: { id: number }) => pageMap.has(m.id))
    .map(
      (m: {
        id: number;
        first_name: string;
        last_name: string;
        country_of_residence?: string | null;
        destination_country?: string | null;
        is_managed_by_harvest21?: boolean;
      }) => {
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
      }
    );

  return { success: true, missionaries: list };
}
