"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";
import type {
  GlobalSearchResponse,
  MissionarySearchResult,
  ChurchSearchResult,
  AgencySearchResult,
} from "@/types/search";

export async function globalSearch(query: string): Promise<GlobalSearchResponse> {
  if (!query || query.trim().length < 2) {
    return {
      agencies: [],
      missionaries: [],
      churches: [],
      total: 0,
    };
  }

  const supabase = await getSupabaseServer();
  const searchTerm = query.trim().toLowerCase();

  const [agenciesResult, missionariesResult, churchesResult] = await Promise.all([
    searchAgencies(supabase, searchTerm),
    searchMissionaries(supabase, searchTerm),
    searchChurches(supabase, searchTerm),
  ]);

  const agencies = agenciesResult || [];
  const missionaries = missionariesResult || [];
  const churches = churchesResult || [];

  const agenciesWithMissionaries = await Promise.all(
    agencies.map(async (agency) => {
      const affiliatedMissionaries = missionaries.filter(
        (m) => m.agency_id === agency.id
      );
      return {
        ...agency,
        affiliated_missionaries: affiliatedMissionaries,
      };
    })
  );

  const standaloneMissionaries = missionaries.filter(
    (m) => !agencies.some((a) => a.id === m.agency_id)
  );

  return {
    agencies: agenciesWithMissionaries,
    missionaries: standaloneMissionaries,
    churches,
    total: agencies.length + missionaries.length + churches.length,
  };
}

async function searchAgencies(
  supabase: any,
  searchTerm: string
): Promise<AgencySearchResult[]> {
  const { data: agencies, error: agencyError } = await supabase
    .from("agencies")
    .select("id, name, city, country")
    .ilike("name", `%${searchTerm}%`)
    .order("name", { ascending: true })
    .limit(5);

  if (agencyError || !agencies || agencies.length === 0) {
    if (agencyError) console.error("Error searching agencies:", agencyError);
    return [];
  }

  const agencyIds = agencies.map((a: any) => a.id);
  
  const { data: pages, error: pageError } = await supabase
    .from("pages")
    .select("page_url, profile_photo_url, organization_id")
    .eq("organization_type", "agency")
    .eq("is_published", true)
    .in("organization_id", agencyIds);

  if (pageError) {
    console.error("Error fetching agency pages:", pageError);
    return [];
  }

  const results = agencies.map((agency: any) => {
    const page = pages?.find((p: any) => p.organization_id === agency.id);
    return {
      id: agency.id,
      type: "agency" as const,
      name: agency.name,
      page_url: page?.page_url || "",
      profile_photo_url: page?.profile_photo_url || null,
      city: agency.city,
      country: agency.country,
      affiliated_missionaries: [],
    };
  }).filter((a: any) => a.page_url);
  
  console.log("Agency search results:", results);
  return results;
}

async function searchMissionaries(
  supabase: any,
  searchTerm: string
): Promise<MissionarySearchResult[]> {
  const { data: missionaries, error: missionaryError } = await supabase
    .from("missionaries")
    .select(`
      id,
      first_name,
      last_name,
      country_of_residence,
      destination_country,
      agency_id,
      agencies (name)
    `)
    .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,country_of_residence.ilike.%${searchTerm}%,destination_country.ilike.%${searchTerm}%`)
    .order("last_name", { ascending: true })
    .limit(15);

  if (missionaryError || !missionaries || missionaries.length === 0) {
    if (missionaryError) console.error("Error searching missionaries:", missionaryError);
    return [];
  }

  const activeMissionaryIds = await getMissionaryIdsWithActiveUsers(
    supabase,
    missionaries.map((m: { id: number }) => m.id)
  );
  const eligible = missionaries.filter((m: { id: number }) => activeMissionaryIds.has(m.id));
  if (eligible.length === 0) return [];

  const missionaryIds = eligible.map((m: any) => m.id);
  
  const { data: pages, error: pageError } = await supabase
    .from("pages")
    .select("page_url, profile_photo_url, organization_id")
    .eq("organization_type", "missionary")
    .eq("is_published", true)
    .in("organization_id", missionaryIds);

  if (pageError) {
    console.error("Error fetching missionary pages:", pageError);
    return [];
  }

  const results = eligible.map((missionary: any) => {
    const page = pages?.find((p: any) => p.organization_id === missionary.id);
    return {
      id: missionary.id,
      type: "missionary" as const,
      name: `${missionary.first_name} ${missionary.last_name}`,
      first_name: missionary.first_name,
      last_name: missionary.last_name,
      page_url: page?.page_url || "",
      profile_photo_url: page?.profile_photo_url || null,
      country_of_residence: missionary.country_of_residence,
      destination_country: missionary.destination_country,
      agency_name: missionary.agencies?.name || null,
      agency_id: missionary.agency_id,
    };
  }).filter((m: any) => m.page_url);
  
  console.log("Missionary search results:", results);
  return results;
}

async function searchChurches(
  supabase: any,
  searchTerm: string
): Promise<ChurchSearchResult[]> {
  const { data: churches, error: churchError } = await supabase
    .from("churches")
    .select("id, name, city, country")
    .ilike("name", `%${searchTerm}%`)
    .limit(10);

  if (churchError || !churches || churches.length === 0) {
    if (churchError) console.error("Error searching churches:", churchError);
    return [];
  }

  const sorted = churches.sort((a: any, b: any) => {
    const countryCompare = (a.country || "").localeCompare(b.country || "");
    if (countryCompare !== 0) return countryCompare;
    
    const cityCompare = (a.city || "").localeCompare(b.city || "");
    if (cityCompare !== 0) return cityCompare;
    
    return a.name.localeCompare(b.name);
  });

  const churchIds = sorted.map((c: any) => c.id);
  
  const { data: pages, error: pageError } = await supabase
    .from("pages")
    .select("page_url, profile_photo_url, organization_id")
    .eq("organization_type", "church")
    .eq("is_published", true)
    .in("organization_id", churchIds);

  if (pageError) {
    console.error("Error fetching church pages:", pageError);
    return [];
  }

  const results = sorted.map((church: any) => {
    const page = pages?.find((p: any) => p.organization_id === church.id);
    return {
      id: church.id,
      type: "church" as const,
      name: church.name,
      page_url: page?.page_url || "",
      profile_photo_url: page?.profile_photo_url || null,
      city: church.city,
      country: church.country,
    };
  }).filter((c: any) => c.page_url);
  
  console.log("Church search results:", results);
  return results;
}

