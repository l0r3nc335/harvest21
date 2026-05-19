"use server";

import { revalidateTag } from "next/cache";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";

type EdgeFunctionMissionary = {
  id: number;
  first_name: string;
  last_name: string;
  country: string;
  region: string;
  church_id: number | null;
  mission_field_id: number | null;
  agency_id: number | null;
  college_id: number | null;
  page_url: string | null;
  page_name: string | null;
  profile_photo_url: string | null;
  is_managed_by_harvest21?: boolean;
};

export type MissionaryData = {
  id: number;
  first_name: string;
  last_name: string;
  country_of_residence: string;
  is_managed_by_harvest21?: boolean;
  region: string;
  created_at: string;
  pages: {
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    is_published: boolean;
  } | null;
  agency: {
    id: number;
    name: string;
  } | null;
  church: {
    id: number;
    name: string;
  } | null;
};

export type PaginatedMissionariesResponse = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  region: string;
  data: MissionaryData[];
};

const allowedRegions = [
  "europe",
  "asia",
  "australia",
  "south_america",
  "north_america",
  "africa"
];

function normalizeRegion(region: string): string | null {
  // Decode URL-encoded region (e.g., "south%20america" -> "south america")
  const decoded = decodeURIComponent(region);
  
  // Normalize: lowercase, replace spaces and hyphens with underscores
  const normalized = decoded.toLowerCase().replace(/[\s-]/g, "_");
  
  // Map common variations to allowed regions
  const regionMap: Record<string, string> = {
    "south_america": "south_america",
    "southamerica": "south_america",
    "north_america": "north_america",
    "northamerica": "north_america",
    "australia": "australia",
    "oceania": "australia",
  };
  
  // Check if it's a mapped variation
  if (regionMap[normalized]) {
    return regionMap[normalized];
  }
  
  // Check if it's already an allowed region
  if (allowedRegions.includes(normalized)) {
    return normalized;
  }
  
  return null;
}

/** Invalidates legacy cache tags (e.g. after admin missionary changes). Region pages fetch live data. */
export async function revalidateMissionaryRegionListCaches(): Promise<void> {
  for (const regionSlug of allowedRegions) {
    revalidateTag(`missionaries-region-${regionSlug}`, {});
  }
}

async function fetchMissionariesByRegionUncached(
  region: string,
  page: number = 1,
  limit: number = 12,
  authToken: string | null
): Promise<PaginatedMissionariesResponse> {
  // Normalize region to match allowed regions
  const normalizedRegion = normalizeRegion(region);
  
  // Validate region
  if (!normalizedRegion) {
    return {
      page: 1,
      limit,
      total: 0,
      total_pages: 0,
      region: normalizedRegion || region,
      data: [],
    };
  }

  // Validate pagination parameters
  const pageNum = Math.max(1, Math.floor(page));
  const limitNum = Math.max(1, Math.min(100, Math.floor(limit))); // Max 100 per page

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    
    // Create a simple client for edge function calls
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Call the edge function with pagination parameters as URL search params
    const functionUrl = `${supabaseUrl}/functions/v1/fetch_missionary_pages_by_region?region=${encodeURIComponent(normalizedRegion)}&page=${pageNum}&limit=${limitNum}`;
    const response = await fetch(functionUrl, { headers, cache: "no-store" });
    
    if (!response.ok) {
      console.error("Error fetching missionaries by region:", response.statusText);
      return {
        page: pageNum,
        limit: limitNum,
        total: 0,
        total_pages: 0,
        region: normalizedRegion,
        data: [],
      };
    }
    
    const data = await response.json();
    
    if (!data || typeof data !== "object" || !Array.isArray(data.data)) {
      return {
        page: pageNum,
        limit: limitNum,
        total: 0,
        total_pages: 0,
        region: normalizedRegion,
        data: [],
      };
    }

    const edgeResponse = data as {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
      region: string;
      data: EdgeFunctionMissionary[];
    };

    const missionaries = edgeResponse.data;

    // Fetch agency and church names if IDs exist - use parallel queries
    const agencyIds = [...new Set(missionaries
      .map((m) => m.agency_id)
      .filter((id): id is number => id != null))];
    
    // Prefer mission_field_id when looking up churches; fall back to church_id
    const churchIds = [...new Set(
      missionaries
        .flatMap((m) => [m.mission_field_id, m.church_id])
        .filter((id): id is number => id != null)
    )];

    // Fetch related data using direct fetch calls
    const [agenciesData, churchesData] = await Promise.all([
      agencyIds.length > 0
        ? fetch(`${supabaseUrl}/rest/v1/agencies?id=in.(${agencyIds.join(',')})&select=id,name`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
            cache: "no-store",
          }).then(r => r.ok ? r.json() : [])
        : Promise.resolve([]),
      churchIds.length > 0
        ? fetch(`${supabaseUrl}/rest/v1/churches?id=in.(${churchIds.join(',')})&select=id,name`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
            cache: "no-store",
          }).then(r => r.ok ? r.json() : [])
        : Promise.resolve([]),
    ]);

    type AgencyData = { id: number; name: string };
    type ChurchData = { id: number; name: string };

    const agenciesMap = new Map<number, AgencyData>(
      (agenciesData || []).map((a: AgencyData) => [a.id, a])
    );
    const churchesMap = new Map<number, ChurchData>(
      (churchesData || []).map((c: ChurchData) => [c.id, c])
    );

    // Transform the edge function response to match MissionaryData type
    const transformedData: MissionaryData[] = missionaries.map((missionary) => {
      const agency = missionary.agency_id && agenciesMap.has(missionary.agency_id)
        ? agenciesMap.get(missionary.agency_id)!
        : null;
      
      const effectiveChurchId = missionary.mission_field_id || missionary.church_id;
      const church = effectiveChurchId && churchesMap.has(effectiveChurchId)
        ? churchesMap.get(effectiveChurchId)!
        : null;

      return {
        id: missionary.id,
        first_name: missionary.first_name,
        last_name: missionary.last_name,
        country_of_residence: missionary.country,
        is_managed_by_harvest21: missionary.is_managed_by_harvest21 ?? false,
        region: missionary.region,
        created_at: new Date().toISOString(),
        pages: {
          page_url: missionary.page_url || "",
          name: missionary.page_name || null,
          profile_photo_url: missionary.profile_photo_url || null,
          is_published: true,
        },
        agency,
        church,
      };
    });

    const supabaseAdmin = await getSupabaseServer();
    const allIds = transformedData.map((m) => m.id);
    let activeData = transformedData;

    if (allIds.length > 0) {
      const eligibleIds = await getMissionaryIdsWithActiveUsers(supabaseAdmin, allIds);
      activeData = transformedData.filter((m) => eligibleIds.has(m.id));
    }

    if (activeData.length > 0) {
      const { data: managedRows } = await supabaseAdmin
        .from("missionaries")
        .select("id, is_managed_by_harvest21")
        .in("id", activeData.map((m) => m.id));

      const managedMap = new Map<number, boolean>(
        (managedRows || []).map((m: { id: number; is_managed_by_harvest21?: boolean | null }) => [
          m.id,
          m.is_managed_by_harvest21 === true,
        ])
      );

      activeData = activeData.map((missionary) => ({
        ...missionary,
        is_managed_by_harvest21: managedMap.get(missionary.id) === true,
      }));
    }

    return {
      page: edgeResponse.page,
      limit: edgeResponse.limit,
      total: activeData.length,
      total_pages: Math.ceil(activeData.length / edgeResponse.limit),
      region: edgeResponse.region,
      data: activeData,
    };
  } catch (error) {
    console.error("Error in getMissionariesByRegion:", error);
    return {
      page: pageNum,
      limit: limitNum,
      total: 0,
      total_pages: 0,
      region: normalizedRegion,
      data: [],
    };
  }
}

export async function getMissionariesByRegion(
  region: string,
  page: number = 1,
  limit: number = 12
): Promise<PaginatedMissionariesResponse> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || null;

  // Always hit Supabase on each navigation / refresh (no unstable_cache or fetch cache)
  return fetchMissionariesByRegionUncached(region, page, limit, authToken);
}
