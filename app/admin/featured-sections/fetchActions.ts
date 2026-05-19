"use server";

import { getSupabaseServer, type SupabaseServerClient } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";
import { resolveMissionaryCardCountry } from "@/lib/countries";
import type {
  HomepageFeaturedSection,
  FeaturedProfileCard,
  FeaturedSectionWithProfiles,
} from "@/types/homepage";
import type { FollowerStatus } from "@/types/follow";

export async function fetchFeaturedSections() {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("homepage_featured_sections")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) throw error;
    return { success: true, data: data as HomepageFeaturedSection[], error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch sections",
    };
  }
}

export async function fetchSectionById(id: number) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();

    const { data: section, error: sectionError } = await supabase
      .from("homepage_featured_sections")
      .select("*")
      .eq("id", id)
      .single();

    if (sectionError) throw sectionError;

    const { data: rawProfiles, error: profilesError } = await supabase
      .from("homepage_section_profiles")
      .select("id, profile_id, profile_type, display_order, pages(id, name, page_url, profile_photo_url, organization_id)")
      .eq("section_id", id)
      .order("display_order", { ascending: true });

    if (profilesError) throw profilesError;

    type RawProfile = {
      id: number;
      profile_id: number;
      profile_type: string;
      display_order: number;
      pages: {
        id: number;
        name: string;
        page_url: string;
        profile_photo_url: string | null;
        organization_id: number | null;
      } | null;
    };
    const rows = (rawProfiles ?? []) as RawProfile[];
    const churchIds = Array.from(
      new Set(
        rows
          .filter((p) => p.profile_type === "church" && p.pages?.organization_id != null)
          .map((p) => p.pages!.organization_id as number)
      )
    );
    const agencyIds = Array.from(
      new Set(
        rows
          .filter((p) => p.profile_type === "agency" && p.pages?.organization_id != null)
          .map((p) => p.pages!.organization_id as number)
      )
    );
    const churchNames = new Map<number, string>();
    const agencyNames = new Map<number, string>();
    if (churchIds.length > 0) {
      const { data } = await supabase.from("churches_public").select("id, name").in("id", churchIds);
      (data ?? []).forEach((c: { id: number; name: string | null }) => {
        if (c.name) churchNames.set(c.id, c.name);
      });
    }
    if (agencyIds.length > 0) {
      const { data } = await supabase.from("agencies_public").select("id, name").in("id", agencyIds);
      (data ?? []).forEach((a: { id: number; name: string | null }) => {
        if (a.name) agencyNames.set(a.id, a.name);
      });
    }

    function sectionDisplayName(p: RawProfile): string {
      const pageName = p.pages?.name?.trim() ?? "";
      if (pageName) return pageName;
      const oid = p.pages?.organization_id;
      if (oid == null) return "";
      if (p.profile_type === "church") return churchNames.get(oid) ?? "";
      if (p.profile_type === "agency") return agencyNames.get(oid) ?? "";
      return "";
    }

    const profiles: FeaturedProfileCard[] = rows.map((p) => {
      const page = p.pages;
      return {
        section_profile_id: p.id,
        profile_id: p.profile_id,
        profile_type: p.profile_type as 'missionary' | 'church' | 'agency',
        page_url: page?.page_url ?? "",
        profile_photo_url: page?.profile_photo_url ?? null,
        name: sectionDisplayName(p),
        display_order: p.display_order,
      };
    });

    return { success: true, data: { section: section as HomepageFeaturedSection, profiles }, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch section",
    };
  }
}

export interface ProfileSearchResult {
  page_id: number;
  organization_type: "missionary" | "church" | "agency";
  page_url: string;
  profile_photo_url: string | null;
  name: string;
}

export async function searchProfiles(query: string, excludePageIds: number[] = []) {
  if (!query.trim()) return { success: true, data: [] as ProfileSearchResult[], error: null };

  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const term = query.trim().toLowerCase();

    const [missionaries, churches, agencies] = await Promise.all([
      _searchMissionaryProfiles(supabase, term, excludePageIds),
      _searchChurchProfiles(supabase, term, excludePageIds),
      _searchAgencyProfiles(supabase, term, excludePageIds),
    ]);

    return {
      success: true,
      data: [...missionaries, ...churches, ...agencies] as ProfileSearchResult[],
      error: null,
    };
  } catch (error: unknown) {
    return {
      success: false,
      data: [] as ProfileSearchResult[],
      error: error instanceof Error ? error.message : "Failed to search profiles",
    };
  }
}

async function _searchMissionaryProfiles(
  supabase: SupabaseServerClient,
  term: string,
  excludePageIds: number[]
): Promise<ProfileSearchResult[]> {
  const { data: missionariesRaw } = await supabase
    .from("missionaries")
    .select("id, first_name, last_name")
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
    .limit(15);

  if (!missionariesRaw?.length) return [];

  const activeIds = await getMissionaryIdsWithActiveUsers(
    supabase,
    missionariesRaw.map((m: { id: number }) => m.id)
  );
  const missionaries = missionariesRaw.filter((m: { id: number }) => activeIds.has(m.id));
  if (!missionaries.length) return [];

  type MRow = { id: number; first_name: string; last_name: string };
  type PRow = { id: number; organization_id: number; page_url: string; profile_photo_url: string | null };

  const ids = (missionaries as MRow[]).map((m) => m.id);
  let q = supabase
    .from("pages")
    .select("id, organization_id, page_url, profile_photo_url")
    .eq("organization_type", "missionary")
    .eq("is_published", true)
    .in("organization_id", ids);

  if (excludePageIds.length) q = q.not("id", "in", `(${excludePageIds.join(",")})`);

  const { data: pages } = await q;
  if (!pages?.length) return [];

  return (missionaries as MRow[]).flatMap((m) => {
    const page = (pages as PRow[]).find((p) => p.organization_id === m.id);
    if (!page) return [];
    return [
      {
        page_id: page.id,
        organization_type: "missionary" as const,
        page_url: page.page_url,
        profile_photo_url: page.profile_photo_url,
        name: `${m.first_name} ${m.last_name}`,
      },
    ];
  });
}

async function _searchChurchProfiles(
  supabase: SupabaseServerClient,
  term: string,
  excludePageIds: number[]
): Promise<ProfileSearchResult[]> {
  const { data: churches } = await supabase
    .from("churches")
    .select("id, name")
    .ilike("name", `%${term}%`)
    .limit(10);

  if (!churches?.length) return [];

  type CRow = { id: number; name: string };
  type PRow = { id: number; organization_id: number; page_url: string; profile_photo_url: string | null };

  const ids = (churches as CRow[]).map((c) => c.id);
  let q = supabase
    .from("pages")
    .select("id, organization_id, page_url, profile_photo_url")
    .eq("organization_type", "church")
    .eq("is_published", true)
    .in("organization_id", ids);

  if (excludePageIds.length) q = q.not("id", "in", `(${excludePageIds.join(",")})`);

  const { data: pages } = await q;
  if (!pages?.length) return [];

  return (churches as CRow[])
    .flatMap((c) => {
      const page = (pages as PRow[]).find((p) => p.organization_id === c.id);
      if (!page) return [];
      return [{
        page_id: page.id,
        organization_type: "church" as const,
        page_url: page.page_url,
        profile_photo_url: page.profile_photo_url,
        name: c.name,
      }];
    });
}

async function _searchAgencyProfiles(
  supabase: SupabaseServerClient,
  term: string,
  excludePageIds: number[]
): Promise<ProfileSearchResult[]> {
  const { data: agencies } = await supabase
    .from("agencies")
    .select("id, name")
    .ilike("name", `%${term}%`)
    .limit(10);

  if (!agencies?.length) return [];

  type ARow = { id: number; name: string };
  type PRow = { id: number; organization_id: number; page_url: string; profile_photo_url: string | null };

  const ids = (agencies as ARow[]).map((a) => a.id);
  let q = supabase
    .from("pages")
    .select("id, organization_id, page_url, profile_photo_url")
    .eq("organization_type", "agency")
    .eq("is_published", true)
    .in("organization_id", ids);

  if (excludePageIds.length) q = q.not("id", "in", `(${excludePageIds.join(",")})`);

  const { data: pages } = await q;
  if (!pages?.length) return [];

  return (agencies as ARow[])
    .flatMap((a) => {
      const page = (pages as PRow[]).find((p) => p.organization_id === a.id);
      if (!page) return [];
      return [{
        page_id: page.id,
        organization_type: "agency" as const,
        page_url: page.page_url,
        profile_photo_url: page.profile_photo_url,
        name: a.name,
      }];
    });
}

export async function fetchActiveFeaturedSections(): Promise<{
  success: boolean;
  data: FeaturedSectionWithProfiles[];
  error: string | null;
}> {
  try {
    const supabase = await getSupabaseServer();

    const { data: sections, error: sectionsError } = await supabase
      .from("homepage_featured_sections")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (sectionsError) throw sectionsError;
    if (!sections || sections.length === 0) {
      return { success: true, data: [], error: null };
    }

    const sectionIds = sections.map((s: HomepageFeaturedSection) => s.id);

    const { data: rawProfiles, error: profilesError } = await supabase
      .from("homepage_section_profiles")
      .select("id, section_id, profile_id, profile_type, display_order, pages!inner(id, name, page_url, profile_photo_url, is_published, organization_id)")
      .in("section_id", sectionIds)
      .order("display_order", { ascending: true });

    if (profilesError) throw profilesError;

    type RawSectionProfile = {
      id: number;
      section_id: number;
      profile_id: number;
      profile_type: string;
      display_order: number;
      pages: {
        id: number;
        name: string;
        page_url: string;
        profile_photo_url: string | null;
        is_published: boolean;
        organization_id: number | null;
      } | null;
    };

    const typedProfiles = (rawProfiles ?? []) as RawSectionProfile[];

    let publishedProfiles = typedProfiles.filter(
      (p) => p.pages?.is_published === true
    );

    const missionaryIdsForUserStatus = publishedProfiles
      .filter((p) => p.profile_type === "missionary" && p.pages?.organization_id != null)
      .map((p) => p.pages!.organization_id as number);
    if (missionaryIdsForUserStatus.length > 0) {
      const activeMissionaryIds = await getMissionaryIdsWithActiveUsers(
        supabase,
        missionaryIdsForUserStatus
      );
      publishedProfiles = publishedProfiles.filter(
        (p) =>
          p.profile_type !== "missionary" ||
          (p.pages?.organization_id != null &&
            activeMissionaryIds.has(p.pages.organization_id))
      );
    }

    const missionaryOrgIds = publishedProfiles
      .filter((p) => p.profile_type === "missionary" && p.pages?.organization_id)
      .map((p) => p.pages!.organization_id as number);

    type MissionaryRow = {
      id: number;
      destination_country: string | null;
      country_of_residence: string | null;
      mission_field_church_id: number | null;
      is_managed_by_harvest21: boolean | null;
    };

    const missionaryDataMap = new Map<number, MissionaryRow>();
    const missionFieldChurchNameMap = new Map<number, string>();

    const churchOrgIds = Array.from(
      new Set(
        publishedProfiles
          .filter((p) => p.profile_type === "church" && p.pages?.organization_id != null)
          .map((p) => p.pages!.organization_id as number)
      )
    );
    const agencyOrgIds = Array.from(
      new Set(
        publishedProfiles
          .filter((p) => p.profile_type === "agency" && p.pages?.organization_id != null)
          .map((p) => p.pages!.organization_id as number)
      )
    );

    const churchDisplayNameMap = new Map<number, string>();
    const agencyDisplayNameMap = new Map<number, string>();

    if (churchOrgIds.length > 0) {
      const { data: churchRows } = await supabase.from("churches_public").select("id, name").in("id", churchOrgIds);
      (churchRows ?? []).forEach((c: { id: number; name: string | null }) => {
        if (c.name) churchDisplayNameMap.set(c.id, c.name);
      });
    }

    if (agencyOrgIds.length > 0) {
      const { data: agencyRows } = await supabase.from("agencies_public").select("id, name").in("id", agencyOrgIds);
      (agencyRows ?? []).forEach((a: { id: number; name: string | null }) => {
        if (a.name) agencyDisplayNameMap.set(a.id, a.name);
      });
    }

    if (missionaryOrgIds.length > 0) {
      const { data: missionaries } = await supabase
        .from("missionaries_public")
        .select(
          "id, destination_country, country_of_residence, mission_field_church_id, is_managed_by_harvest21"
        )
        .in("id", missionaryOrgIds);

      (missionaries ?? []).forEach((m: MissionaryRow) => {
        missionaryDataMap.set(m.id, m);
      });

      const churchIds = Array.from(
        new Set(
          (missionaries ?? [])
            .map((m: MissionaryRow) => m.mission_field_church_id)
            .filter((cid: number | null | undefined): cid is number => cid != null)
        )
      );

      if (churchIds.length > 0) {
        const { data: mfChurches } = await supabase.from("churches_public").select("id, name").in("id", churchIds);
        (mfChurches ?? []).forEach((c: { id: number; name: string | null }) => {
          if (c.name) missionFieldChurchNameMap.set(c.id, c.name);
        });
      }
    }

    function resolveFeaturedDisplayName(p: RawSectionProfile): string {
      const pageName = p.pages?.name?.trim() ?? "";
      if (pageName) return pageName;
      const oid = p.pages?.organization_id;
      if (oid == null) return "";
      if (p.profile_type === "church") return churchDisplayNameMap.get(oid) ?? "";
      if (p.profile_type === "agency") return agencyDisplayNameMap.get(oid) ?? "";
      return "";
    }

    const followerStatusByMissionaryId = new Map<number, FollowerStatus>();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser && missionaryOrgIds.length > 0) {
      const { data: mfRows } = await supabase
        .from("missionary_followers")
        .select("missionary_id, status")
        .eq("user_id", authUser.id)
        .in("missionary_id", missionaryOrgIds);

      for (const row of mfRows ?? []) {
        const st = row.status as string;
        if (st === "accepted" || st === "pending" || st === "rejected") {
          followerStatusByMissionaryId.set(row.missionary_id as number, st as FollowerStatus);
        }
      }

      const { data: mmRows } = await supabase
        .from("missionary_missionary_followers")
        .select("followed_missionary_id, follower_missionary_id, status")
        .eq("status", "accepted")
        .in("followed_missionary_id", missionaryOrgIds);

      const followerMissionaryIds = [
        ...new Set(
          (mmRows ?? []).map((r: { follower_missionary_id: number }) => r.follower_missionary_id)
        ),
      ];
      if (followerMissionaryIds.length > 0) {
        const { data: mu } = await supabase
          .from("missionaries_public")
          .select("id, agency_id")
          .in("id", followerMissionaryIds);
        const mIds = new Set((mu ?? []).map((m: { id: number }) => m.id));
        for (const row of mmRows ?? []) {
          if (mIds.has(row.follower_missionary_id as number)) {
            followerStatusByMissionaryId.set(row.followed_missionary_id as number, "accepted");
          }
        }
      }
    }

    const result: FeaturedSectionWithProfiles[] = (sections as HomepageFeaturedSection[])
      .map((section) => ({
        section,
        profiles: publishedProfiles
          .filter((p) => p.section_id === section.id)
          .map((p) => ({
            section_profile_id: p.id,
            profile_id: p.profile_id,
            profile_type: p.profile_type as 'missionary' | 'church' | 'agency',
            page_url: p.pages?.page_url ?? "",
            profile_photo_url: p.pages?.profile_photo_url ?? null,
            name: resolveFeaturedDisplayName(p),
            display_order: p.display_order,
            country:
              p.profile_type === "missionary" && p.pages?.organization_id
                ? (() => {
                    const m = missionaryDataMap.get(p.pages.organization_id);
                    const raw = m?.destination_country || m?.country_of_residence || "";
                    return resolveMissionaryCardCountry(raw) || null;
                  })()
                : null,
            church_name:
              p.profile_type === "missionary" && p.pages?.organization_id
                ? (() => {
                    const m = missionaryDataMap.get(p.pages.organization_id);
                    const cid = m?.mission_field_church_id;
                    return cid ? (missionFieldChurchNameMap.get(cid) ?? null) : null;
                  })()
                : null,
            is_managed_by_harvest21:
              p.profile_type === "missionary" && p.pages?.organization_id
                ? missionaryDataMap.get(p.pages.organization_id)?.is_managed_by_harvest21 === true
                : false,
            missionary_id:
              p.profile_type === "missionary" ? (p.pages?.organization_id ?? null) : null,
            follower_status:
              p.profile_type === "missionary" && p.pages?.organization_id
                ? followerStatusByMissionaryId.get(p.pages.organization_id) ?? "none"
                : undefined,
          })),
      }))
      .filter((s) => s.profiles.length > 0);

    return { success: true, data: result, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "Failed to fetch featured sections",
    };
  }
}
