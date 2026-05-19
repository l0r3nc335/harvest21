"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";
import { revalidatePath, revalidateTag } from "next/cache";
import type { OrganizationType } from "./pageActions";

export type OrganizationPreviewData = {
  organization: {
    id: number;
    name: string;
    is_managed_by_harvest21?: boolean;
  };
  page: {
    id: number;
    page_url: string;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    is_published: boolean;
    published_at: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    created_at: string;
  }>;
  donations?: {
    totalPledged: number;
    totalReceived: number;
  };
  /** For agency (and church) preview: missionaries in public-view shape */
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    destination_country?: string | null;
    country_of_residence: string | null;
    is_managed_by_harvest21?: boolean;
    page_url: string;
    profile_photo_url: string | null;
    page_name?: string | null;
  }>;
  isApproved: boolean;
};

export async function getOrganizationPreviewData(
  organizationType: OrganizationType,
  organizationId: number
): Promise<{
  success: boolean;
  data?: OrganizationPreviewData;
  error?: string;
}> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch page by organization ID
    const { data: pageData, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (pageError || !pageData) {
      return { success: false, error: "Page not found" };
    }

    // Fetch organization data based on type
    let organizationData = null;
    if (organizationType === "college") {
      const { data: collegeData, error: collegeError } = await supabaseAdmin
        .from("colleges")
        .select("id, name")
        .eq("id", organizationId)
        .single();
      if (!collegeError && collegeData) {
        organizationData = collegeData;
      }
    } else if (organizationType === "agency") {
      const { data: agencyData, error: agencyError } = await supabaseAdmin
        .from("agencies")
        .select("id, name, is_managed_by_harvest21")
        .eq("id", organizationId)
        .single();
      if (!agencyError && agencyData) {
        organizationData = agencyData;
      }
    } else if (organizationType === "church") {
      const { data: churchData, error: churchError } = await supabaseAdmin
        .from("churches")
        .select("id, name, address, city, state, country, phone_number, website, is_managed_by_harvest21")
        .eq("id", organizationId)
        .single();
      if (!churchError && churchData) {
        organizationData = churchData;
      }
    }

    if (!organizationData) {
      return { success: false, error: "Organization not found" };
    }

    // Fetch media
    const { data: mediaData } = await supabaseAdmin
      .from("page_media")
      .select("id, media_type, media_url, created_at")
      .eq("page_id", pageData.id)
      .neq("media_url", "placeholder")
      .order("created_at", { ascending: false });

    // Fetch donations total
    const { data: donations } = await supabaseAdmin
      .from("page_donations")
      .select("amount, status")
      .eq("page_id", pageData.id);

    const totalPledged = donations?.reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0) || 0;
    const totalReceived = donations
      ?.filter((d: { status?: string }) => d.status === "Complete")
      .reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0) || 0;

    const isApproved = pageData.is_published === true;

    // For agency/church preview: fetch missionaries (all for this org, with page data) so admin preview shows Our Missionaries
    let missionaries: OrganizationPreviewData["missionaries"] = undefined;
    if (organizationType === "agency") {
      const { data: agencyMissionaries } = await supabaseAdmin
        .from("missionaries")
        .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
        .eq("agency_id", organizationId)
        .order("last_name", { ascending: true });

      if (agencyMissionaries && agencyMissionaries.length > 0) {
        const activeIds = await getMissionaryIdsWithActiveUsers(
          supabaseAdmin,
          agencyMissionaries.map((m: { id: number }) => m.id)
        );
        const visibleAgencyMissionaries = agencyMissionaries.filter((m: { id: number }) =>
          activeIds.has(m.id)
        );
        if (visibleAgencyMissionaries.length === 0) {
          missionaries = [];
        } else {
        const missionaryIds = visibleAgencyMissionaries.map((m: { id: number }) => m.id);
        const { data: missionaryPages } = await supabaseAdmin
          .from("pages")
          .select("organization_id, page_url, name, profile_photo_url, is_published")
          .eq("organization_type", "missionary")
          .in("organization_id", missionaryIds);

        type PageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
        const pageMap = new Map<number, PageRow>(
          (missionaryPages || []).map((p: PageRow) => [p.organization_id, p])
        );

        missionaries = visibleAgencyMissionaries.map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
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
          };
        });
        }
      }
    } else if (organizationType === "church") {
      const { data: churchMissionaries } = await supabaseAdmin
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
        .eq("church_id", organizationId)
        .eq("is_active", true);

      const { data: sendingChurchMissionaries } = await supabaseAdmin
        .from("missionaries")
        .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
        .eq("sending_church_id", organizationId);

      const { data: missionFieldChurchMissionaries } = await supabaseAdmin
        .from("missionaries")
        .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
        .eq("mission_field_church_id", organizationId);

      type RawM = { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean };
      const fromPivot = (churchMissionaries || [])
        .map((cm: { missionary: unknown }) => (cm as { missionary: unknown }).missionary)
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

      const activeChurchMissionaryIds = await getMissionaryIdsWithActiveUsers(
        supabaseAdmin,
        rawMissionaries.map((m: { id: number }) => m.id)
      );
      const churchMissionariesVisible = rawMissionaries.filter((m: { id: number }) =>
        activeChurchMissionaryIds.has(m.id)
      );

      if (churchMissionariesVisible.length > 0) {
        const missionaryIds = churchMissionariesVisible.map((m: { id: number }) => m.id);
        const { data: missionaryPages } = await supabaseAdmin
          .from("pages")
          .select("organization_id, page_url, name, profile_photo_url, is_published")
          .eq("organization_type", "missionary")
          .in("organization_id", missionaryIds);

        type PageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
        const pageMap = new Map<number, PageRow>(
          (missionaryPages || []).map((p: PageRow) => [p.organization_id, p])
        );

        missionaries = churchMissionariesVisible.map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
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
          };
        });
      }
    }

    return {
      success: true,
      data: {
        organization: {
          id: organizationData.id,
          name: organizationData.name,
          is_managed_by_harvest21: (organizationData as { is_managed_by_harvest21?: boolean }).is_managed_by_harvest21 ?? false,
        },
        page: {
          id: pageData.id,
          page_url: pageData.page_url,
          profile_photo_url: pageData.profile_photo_url,
          banner_photo_url: pageData.banner_photo_url,
          short_quote: pageData.short_quote,
          about_text: pageData.about_text,
          intro_text: pageData.intro_text,
          template_content: pageData.template_content,
          video_hashed_id: pageData.video_hashed_id,
          is_published: pageData.is_published,
          published_at: pageData.published_at,
        },
        media: (mediaData || []) as Array<{
          id: number;
          media_type: "image" | "video";
          media_url: string;
          created_at: string;
        }>,
        donations: {
          totalPledged,
          totalReceived,
        },
        missionaries,
        isApproved,
      },
    };
  } catch (error) {
    console.error("Error fetching organization preview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Approve and publish an organization page
 */
export async function approveOrganizationPage(
  organizationType: OrganizationType,
  pageId: number
): Promise<{
  success: boolean;
  message?: string;
}> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Update pages table
    const { error: updateError } = await supabaseAdmin
      .from("pages")
      .update({
        is_published: true,
        is_review: false,
        published_at: new Date().toISOString(),
      })
      .eq("id", pageId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    // Revalidate the cache to ensure the page is immediately available
    const { data: pageData } = await supabaseAdmin
      .from("pages")
      .select("page_url, organization_id")
      .eq("id", pageId)
      .single();
    
    if (pageData?.page_url) {
      revalidatePath(`/${pageData.page_url}`);
    }

    const getPluralTag = (type: OrganizationType): string => {
      switch (type) {
        case "missionary":
          return "missionaries";
        case "agency":
          return "agencies";
        case "college":
          return "colleges";
        case "church":
          return "churches";
        case "donor":
          return "donors";
        default:
          return `${type}s`;
      }
    };

    const pluralTag = getPluralTag(organizationType);
    if (pageData?.organization_id) {
      revalidateTag(pluralTag, "max");
      revalidateTag(`page-${organizationType}-${pageData.organization_id}`, "max");
      revalidatePath(`/admin/${pluralTag}`, "page");
    }

    return { success: true, message: "Page approved and published successfully!" };
  } catch (error) {
    console.error("Error approving page:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to approve page",
    };
  }
}

