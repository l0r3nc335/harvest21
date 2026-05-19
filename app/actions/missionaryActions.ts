"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";

export interface MissionaryOverview {
  id: number;
  first_name: string;
  last_name: string;
  country: string;
  region: string;
  destination_country?: string | null;
  country_of_residence?: string | null;
  is_managed_by_harvest21?: boolean;
  page_url: string;
  profile_photo_url: string | null;
  page_name: string;
  follower_status: string;
  is_owner: boolean;
  church_id?: number | null;
  mission_field_id?: number | null;
   /** Name of the mission field church associated with mission_field_id, when available */
  mission_field_church_name?: string | null;
  agency_id?: number | null;
  college_id?: number | null;
  mission_status?: string | null;
  donation_percentage?: number | null;
  open_to_visits?: boolean;
  created_at?: string;
}

export type MissionariesByRegion = Record<string, MissionaryOverview[]>;

export interface PaginationCursor {
  created_at: string;
  id: number;
}

export interface PaginatedRegionResponse {
  data: MissionaryOverview[];
  nextCursor: PaginationCursor | null;
  hasMore: boolean;
}

async function attachManagedFlagsToOverview(
  missionariesByRegion: MissionariesByRegion
): Promise<MissionariesByRegion> {
  const allMissionaryIds = Object.values(missionariesByRegion).flat().map((m) => m.id);
  if (allMissionaryIds.length === 0) return missionariesByRegion;

  const supabaseAdmin = await getSupabaseServer();
  const { data } = await supabaseAdmin
    .from("missionaries")
    .select("id, is_managed_by_harvest21")
    .in("id", allMissionaryIds);

  const managedMap = new Map<number, boolean>(
    (data || []).map((m: { id: number; is_managed_by_harvest21?: boolean | null }) => [
      m.id,
      m.is_managed_by_harvest21 === true,
    ])
  );

  const enriched: MissionariesByRegion = {};
  for (const [region, missionaries] of Object.entries(missionariesByRegion)) {
    enriched[region] = missionaries.map((missionary) => ({
      ...missionary,
      is_managed_by_harvest21: managedMap.get(missionary.id) === true,
    }));
  }

  return enriched;
}

/** Keep only missionaries whose `public.users.status` is exactly `Active`. */
async function filterMissionariesWithInactiveAccounts(
  missionariesByRegion: MissionariesByRegion
): Promise<MissionariesByRegion> {
  const allMissionaryIds = Object.values(missionariesByRegion).flat().map((m) => m.id);
  if (allMissionaryIds.length === 0) return missionariesByRegion;

  const supabaseAdmin = await getSupabaseServer();
  const activeIds = await getMissionaryIdsWithActiveUsers(supabaseAdmin, allMissionaryIds);
  if (activeIds.size === 0) return {};

  const filtered: MissionariesByRegion = {};
  for (const [region, missionaries] of Object.entries(missionariesByRegion)) {
    const active = missionaries.filter((m) => activeIds.has(m.id));
    if (active.length > 0) filtered[region] = active;
  }
  return filtered;
}

export async function fetchMissionariesOverview(): Promise<MissionariesByRegion> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const { data, error } = await supabase.functions.invoke("fetch_missionaries_overview", {
      headers
    });
    
    if (error) throw error;
    const filtered = await filterMissionariesWithInactiveAccounts(data || {});
    return await attachManagedFlagsToOverview(filtered);
  } catch (error) {
    console.error("Error fetching missionaries:", error);
    return {};
  }
}

export async function fetchMissionariesByRegionCursor(
  region: string,
  limit: number = 10,
  cursor?: PaginationCursor
): Promise<PaginatedRegionResponse> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    
    const params = new URLSearchParams({
      region,
      limit: limit.toString(),
    });
    
    if (cursor) {
      params.append("cursor_created_at", cursor.created_at);
      params.append("cursor_id", cursor.id.toString());
    }
    
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/fetch_missionary_pages_by_region?${params.toString()}`;
    
    const response = await fetch(functionUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    const data = (await response.json()) as PaginatedRegionResponse;

    if (!Array.isArray(data.data) || data.data.length === 0) {
      return data;
    }

    const supabaseAdmin = await getSupabaseServer();
    const { data: missionaryRows } = await supabaseAdmin
      .from("missionaries")
      .select("id, is_managed_by_harvest21")
      .in("id", data.data.map((m) => m.id));

    const managedMap = new Map<number, boolean>(
      (missionaryRows || []).map((m: { id: number; is_managed_by_harvest21?: boolean | null }) => [
        m.id,
        m.is_managed_by_harvest21 === true,
      ])
    );

    return {
      ...data,
      data: data.data.map((missionary) => ({
        ...missionary,
        is_managed_by_harvest21: managedMap.get(missionary.id) === true,
      })),
    };
  } catch (error) {
    console.error("Error fetching missionaries by region:", error);
    return { data: [], nextCursor: null, hasMore: false };
  }
}
