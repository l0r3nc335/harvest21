"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";
import { revalidatePath } from "next/cache";

export type PageOGData = {
  title: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string;
};

export async function getPageOGData(
  slug: string,
  focus?: string | null
): Promise<PageOGData | null> {
  const admin = await getSupabaseServer();
  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!normalizedSlug) return null;

  const { data: page } = await admin
    .from("pages")
    .select("id, page_url, name, profile_photo_url, banner_photo_url, short_quote, about_text, organization_type, organization_id, is_published")
    .eq("page_url", normalizedSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!page) return null;

  const defaultImage = process.env.HARVEST_21_LOGO || null;

  let title = page.name || "Harvest21";
  let description = page.short_quote || page.about_text || "";
  let imageUrl = page.profile_photo_url || page.banner_photo_url || defaultImage;

  if (description.length > 200) {
    description = description.slice(0, 197) + "...";
  }

  if (focus) {
    const prayerMatch = focus.match(/^prayers-(\d+)$/);
    const mediaMatch = focus.match(/^page_media-(\d+)$/);
    const widgetMatch = focus.match(/^page_widgets-(\d+)$/);

    if (prayerMatch) {
      const [{ data: prayer }, { data: missionary }] = await Promise.all([
        admin
          .from("prayers")
          .select("title, body")
          .eq("id", Number(prayerMatch[1]))
          .eq("page_id", page.id)
          .eq("is_published", true)
          .maybeSingle(),
        admin
          .from("missionaries")
          .select("first_name, last_name")
          .eq("id", page.organization_id)
          .maybeSingle(),
      ]);

      if (prayer) {
        title = prayer.title || `Prayer Request - ${title}`;
        const body = prayer.body || "";
        description = body.length > 200 ? body.slice(0, 197) + "..." : body;
        const fullName = missionary
          ? `${missionary.first_name} ${missionary.last_name}`.trim()
          : page.name || "Harvest21";
        const ogParams = new URLSearchParams({
          title,
          body: body.slice(0, 300),
          name: fullName,
          type: "prayer",
        });
        imageUrl = `/api/og?${ogParams.toString()}`;
      }
    } else if (mediaMatch) {
      const { data: media } = await admin
        .from("page_media")
        .select("description, media_url, thumbnail_url, media_type")
        .eq("id", Number(mediaMatch[1]))
        .eq("page_id", page.id)
        .maybeSingle();

      if (media) {
        title = media.description || (media.media_type === "video" ? `Video - ${title}` : `Photo - ${title}`);
        if (media.description) description = media.description;
        imageUrl = media.media_type === "video"
          ? (media.thumbnail_url || imageUrl)
          : (media.media_url || imageUrl);
      }
    } else if (widgetMatch) {
      const { data: widget } = await admin
        .from("page_widgets")
        .select("widget_title, widget_data")
        .eq("id", Number(widgetMatch[1]))
        .eq("page_id", page.id)
        .maybeSingle();

      if (widget) {
        title = widget.widget_title || `Update Letter - ${title}`;
        const wd = widget.widget_data as Record<string, unknown> | null;
        if (wd?.description) description = String(wd.description);
        if (wd?.thumbnail_url) imageUrl = String(wd.thumbnail_url);
      }
    }
  }

  return { title, description, imageUrl, pageUrl: page.page_url };
}

export type MissionaryPreviewData = {
  missionary: {
    id: number;
    first_name: string;
    last_name: string;
    destination_country: string | null;
    user_id?: string | null;
    is_managed_by_harvest21?: boolean;
    allow_direct_messages?: boolean;
    open_to_visits?: boolean;
    visits_start_date?: string | null;
    visits_end_date?: string | null;
    agency?: {
      id: number;
      name: string;
    } | null;
    church?: {
      id: number;
      name: string;
    } | null;
  };
  page: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    published_at: string | null;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
    page_template?: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    created_at: string;
  }>;
  widgets: Array<{
    id: number;
    widget_type: string;
    widget_title: string;
    widget_data: Record<string, unknown>;
    created_at: string;
  }>;
  donations?: {
    totalPledged: number;
    totalReceived: number;
  };
  isPreviewMode?: boolean;
  isOwner?: boolean;
};

/**
 * Fetch missionary preview data by page URL slug
 */
export async function getMissionaryPreviewBySlug(
  slug: string
): Promise<{ success: boolean; data?: MissionaryPreviewData; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Normalize slug: remove leading/trailing slashes, trim whitespace
    const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();

    if (!normalizedSlug) {
      return { success: false, error: "Invalid page URL" };
    }

    // Fetch page by slug - must be a missionary page
    const { data: pageData, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("page_url", normalizedSlug)
      .eq("organization_type", "missionary")
      .maybeSingle();

    if (pageError) {
      console.error("Error fetching page:", pageError);
      return { success: false, error: `Page query error: ${pageError.message}` };
    }

    if (!pageData) {
      console.error("Page not found for slug:", normalizedSlug);
      return { success: false, error: "Page not found" };
    }

    // Fetch missionary data first (needed to determine church ID)
    const { data: missionaryData, error: missionaryError } = await supabaseAdmin
      .from("missionaries")
      .select("id, first_name, last_name, country_of_residence, agency_id, sending_church_id, mission_field_church_id, user_id, allow_direct_messages, open_to_visits, visits_start_date, visits_end_date,is_managed_by_harvest21")
      .eq("id", pageData.organization_id)
      .single();

    if (missionaryError) {
      console.error("Error fetching missionary:", missionaryError);
      return { success: false, error: `Missionary query error: ${missionaryError.message}` };
    }

    if (!missionaryData) {
      console.error("Missionary not found for organization_id:", pageData.organization_id);
      return { success: false, error: "Missionary not found" };
    }

    // Determine church ID (prefer mission_field_church, fallback to sending_church)
    const churchId = missionaryData.mission_field_church_id || missionaryData.sending_church_id;

    // Get current user session (needed for ownership check)
    const supabase = await getSupabaseServer();
    const sessionPromise = supabase.auth.getSession();

    // Fetch all related data in parallel
    const [agencyResult, churchResult, mediaResult, widgetsResult, donationsResult, sessionResult] = await Promise.all([
      // Agency
      missionaryData.agency_id
        ? supabaseAdmin.from("agencies").select("id, name").eq("id", missionaryData.agency_id).single()
        : Promise.resolve({ data: null, error: null }),
      
      // Church
      churchId
        ? supabaseAdmin.from("churches").select("id, name").eq("id", churchId).single()
        : Promise.resolve({ data: null, error: null }),
      
      // Media
      supabaseAdmin
        .from("page_media")
        .select("id, media_type, media_url, description, thumbnail_url, created_at")
        .eq("page_id", pageData.id)
        .neq("media_url", "placeholder")
        .order("created_at", { ascending: false }),
      
      // Widgets (update letters)
      supabaseAdmin
        .from("page_widgets")
        .select("id, widget_type, widget_title, widget_data, created_at")
        .eq("page_id", pageData.id)
        .eq("widget_type", "update_letter")
        .order("created_at", { ascending: false }),
      
      // Donations
      getMissionaryDonationsTotal(pageData.id),
      
      // Session
      sessionPromise
    ]);

    // Extract results
    const agency = agencyResult.data || null;
    const church = churchResult.data || null;
    const mediaData = mediaResult.data || [];
    const widgetsData = widgetsResult.data || [];
    const currentUserId = sessionResult.data?.session?.user?.id;

    // Check if user owns the page
    const isOwner = currentUserId && missionaryData.user_id === currentUserId;
    const isPreviewMode = !pageData.is_published && isOwner;

    // For public route: must be published
    // Exception: if not published and user owns the page, allow preview
    if (!pageData.is_published && !isPreviewMode) {
      return { success: false, error: "Page not available" };
    }

    return {
      success: true,
      data: {
        missionary: {
          id: missionaryData.id,
          first_name: missionaryData.first_name,
          last_name: missionaryData.last_name,
          destination_country: missionaryData.destination_country,
          user_id: missionaryData.user_id,
          allow_direct_messages: missionaryData.allow_direct_messages,
          open_to_visits: (missionaryData as { open_to_visits?: boolean }).open_to_visits ?? false,
          visits_start_date: (missionaryData as { visits_start_date?: string | null }).visits_start_date ?? null,
          visits_end_date: (missionaryData as { visits_end_date?: string | null }).visits_end_date ?? null,
          is_managed_by_harvest21: missionaryData.is_managed_by_harvest21 ?? false,
          agency,
          church,
        },
        page: {
          id: pageData.id,
          page_url: pageData.page_url,
          name: pageData.name,
          profile_photo_url: pageData.profile_photo_url,
          banner_photo_url: pageData.banner_photo_url,
          short_quote: pageData.short_quote,
          about_text: pageData.about_text,
          intro_text: pageData.intro_text,
          template_content: pageData.template_content,
          video_hashed_id: pageData.video_hashed_id,
          donation_percentage: pageData.donation_percentage,
          is_published: pageData.is_published,
          published_at: pageData.published_at,
          donation_mode: ((pageData as { donation_mode?: string | null }).donation_mode ?? null) as "harvest21" | "external" | "off" | null,
          external_donation_url: (pageData as { external_donation_url?: string | null }).external_donation_url ?? null,
          page_template: (pageData as { page_template?: string | null }).page_template ?? null,
        },
        media: mediaData || [],
        isOwner: !!isOwner,
        widgets: (widgetsData || []).map((widget: {
          id: number;
          widget_type: string;
          widget_title: string | null;
          widget_data: unknown;
          created_at: string;
        }) => ({
          id: widget.id,
          widget_type: widget.widget_type,
          widget_title: widget.widget_title || "",
          widget_data: (typeof widget.widget_data === "object" && widget.widget_data !== null && !Array.isArray(widget.widget_data))
            ? widget.widget_data as Record<string, unknown>
            : {},
          created_at: widget.created_at,
        })),
        donations: donationsResult.success
          ? {
              totalPledged: donationsResult.totalPledged || 0,
              totalReceived: donationsResult.totalReceived || 0,
            }
          : undefined,
        isPreviewMode,
      },
    };
  } catch (error) {
    console.error("Error fetching missionary preview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Check if current user is admin
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return false;
    }

    // Check if user has admin role (role 1 or 2)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!userData) {
      return false;
    }

    // Role 1: ADMIN, Role 2: SUPER ADMIN
    return userData.role === 1 || userData.role === 2;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Approve and publish a missionary page
 */
export async function approveMissionaryPage(pageId: number): Promise<{
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
      .select("page_url")
      .eq("id", pageId)
      .single();
    
    if (pageData?.page_url) {
      revalidatePath(`/${pageData.page_url}`);
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

/**
 * Get total donations for a missionary page
 */
export async function getMissionaryDonationsTotal(pageId: number): Promise<{
  success: boolean;
  totalPledged?: number;
  totalReceived?: number;
}> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: donations } = await supabaseAdmin
      .from("page_donations")
      .select("amount, status")
      .eq("page_id", pageId);

    if (!donations) {
      return { success: true, totalPledged: 0, totalReceived: 0 };
    }

    const totalPledged = donations.reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0);
    const totalReceived = donations
      .filter((d: { status?: string }) => d.status === "Complete")
      .reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0);

    return { success: true, totalPledged, totalReceived };
  } catch (error) {
    console.error("Error fetching donations:", error);
    return { success: false };
  }
}

export type OrganizationPublicData = {
  organization: {
    id: number;
    name: string;
    contact_user_id?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    address?: string | null;
    phone_number?: string | null;
    website?: string | null;
    email?: string | null;
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
    page_template?: string | null;
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
  isPreviewMode?: boolean;
  isOwner?: boolean;
  // Church-specific fields
  followerStatus?: string;
  followerCount?: number;
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    country_of_residence: string | null;
    page_url: string;
    profile_photo_url: string | null;
    page_name?: string | null;
    follower_status?: string;
  }>;
};

/**
 * Fetch organization preview data by page URL slug (for colleges, agencies, churches)
 */
export async function getOrganizationPreviewBySlug(
  slug: string
): Promise<{ success: boolean; data?: OrganizationPublicData; error?: string; organizationType?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Normalize slug: remove leading/trailing slashes, trim whitespace
    const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();

    if (!normalizedSlug) {
      return { success: false, error: "Invalid page URL" };
    }

    // Fetch page by slug - check all organization types except missionary
    // Use ilike for case-insensitive matching
    const { data: pageData, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("*")
      .ilike("page_url", normalizedSlug)
      .in("organization_type", ["college", "agency", "church"])
      .maybeSingle();

    if (pageError) {
      console.error("Error fetching page:", pageError);
      return { success: false, error: `Page query error: ${pageError.message}` };
    }

    if (!pageData) {
      console.error("Page not found for slug:", normalizedSlug);
      return { success: false, error: "Page not found" };
    }

    const organizationType = pageData.organization_type as "college" | "agency" | "church";

    // Fetch organization data based on type
    let organizationData: { 
      id: number; 
      name: string; 
      contact_user_id?: string | null;
      city?: string | null;
      country?: string | null;
      address?: string | null;
      phone_number?: string | null;
      website?: string | null;
      email?: string | null;
    } | null = null;
    
    if (organizationType === "college") {
      const { data, error } = await supabaseAdmin
        .from("colleges")
        .select("id, name, contact_user_id")
        .eq("id", pageData.organization_id)
        .single();
      
      if (error || !data) {
        console.error("Error fetching college:", error);
        return { success: false, error: `College query error: ${error?.message || "College not found"}` };
      }
      organizationData = data;
    } else if (organizationType === "agency") {
      const { data, error } = await supabaseAdmin
        .from("agencies")
        .select("id, name, contact_user_id, city, country, address, phone_number, website, email, is_managed_by_harvest21")
        .eq("id", pageData.organization_id)
        .single();
      
      if (error || !data) {
        console.error("Error fetching agency:", error);
        return { success: false, error: `Agency query error: ${error?.message || "Agency not found"}` };
      }
      organizationData = data;
    } else if (organizationType === "church") {
      const { data, error } = await supabaseAdmin
        .from("churches")
        .select("id, name, contact_user_id, city, state, country, address, phone_number, website, is_managed_by_harvest21")
        .eq("id", pageData.organization_id)
        .single();
      
      if (error || !data) {
        console.error("Error fetching church:", error);
        return { success: false, error: `Church query error: ${error?.message || "Church not found"}` };
      }
      organizationData = data;
    }

    if (!organizationData) {
      return { success: false, error: "Organization not found" };
    }

    // Fetch media
    const { data: mediaData } = await supabaseAdmin
      .from("page_media")
      .select("id, media_type, media_url, description, thumbnail_url, created_at")
      .eq("page_id", pageData.id)
      .neq("media_url", "placeholder")
      .order("created_at", { ascending: false });

    // Fetch donations total (placeholder for now)
    const donations = {
      totalPledged: 0,
      totalReceived: 0,
    };

    // Get current user session to check if they own the page
    const supabase = await getSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    // Check if user owns the page
    const isOwner = currentUserId && organizationData.contact_user_id === currentUserId;
    const isPreviewMode = !pageData.is_published && isOwner;

    // For public route: must be published
    // Exception: if not published and user owns the page, allow preview
    if (!pageData.is_published && !isPreviewMode) {
      return { success: false, error: "Page not available" };
    }

    // For churches, fetch follower status and missionaries
    let followerStatus: string = "none";
    let followerCount = 0;
    let missionaries: any[] = [];

    if (organizationType === "church" && currentUserId) {
      // Get follower status
      const { data: followerData } = await supabaseAdmin
        .from("church_followers")
        .select("status")
        .eq("church_id", organizationData.id)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (followerData) {
        followerStatus = followerData.status;
      }

      // Get follower count
      const { count } = await supabaseAdmin
        .from("church_followers")
        .select("*", { count: "exact", head: true })
        .eq("church_id", organizationData.id)
        .eq("status", "accepted");

      followerCount = count || 0;

      // If user is an accepted follower OR owns the church, fetch missionaries.
      // Include: (1) missionary_churches pivot, (2) sending_church_id = this church, (3) mission_field_church_id = this church.
      // Owner (admin preview): show ALL related missionaries, including unpublished pages.
      // Accepted follower: show only missionaries whose page is_published is true.
      if (followerData?.status === "accepted" || isOwner) {
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
          .eq("church_id", organizationData.id)
          .eq("is_active", true);

        const { data: sendingChurchMissionaries } = await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
          .eq("sending_church_id", organizationData.id);

        const { data: missionFieldChurchMissionaries } = await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
          .eq("mission_field_church_id", organizationData.id);

        type RawM = { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean };
        const fromPivot = (churchMissionaries || [])
          .map((cm: { missionary: unknown }) => cm.missionary)
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
          rawMissionaries.map((m: { id: number }) => m.id)
        );
        const missionariesForListing = rawMissionaries.filter((m: { id: number }) =>
          activeUserMissionaryIds.has(m.id)
        );

        if (missionariesForListing.length > 0) {
          const missionaryIds = missionariesForListing.map((m: { id: number }) => m.id);

          // Owner: fetch all missionary pages (published or not) so every related missionary appears. Follower: only published.
          const pagesQuery = supabaseAdmin
            .from("pages")
            .select("organization_id, page_url, name, profile_photo_url, is_published")
            .eq("organization_type", "missionary")
            .in("organization_id", missionaryIds);
          const { data: missionaryPages } = isOwner
            ? await pagesQuery
            : await pagesQuery.eq("is_published", true);

          type MissionaryPageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
          const pageMap = new Map<number, MissionaryPageRow>(
            (missionaryPages || []).map((p: MissionaryPageRow) => [p.organization_id, p])
          );

          // Fetch follower statuses for the current user against these missionaries
          let followerStatusMap = new Map<number, string>();
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

          // Owner: include every missionary (use page data if present, else defaults). Follower: only those with a published page.
          missionaries = isOwner
            ? missionariesForListing.map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
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
                .filter((m: { id: number }) => pageMap.has(m.id))
                .map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
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
        }
      }
    }

    // For agencies, fetch missionaries. Owner (admin preview): show all. Public: only with published page.
    if (organizationType === "agency") {
      if (isOwner) {
        // Admin preview: include all missionaries for this agency, with or without (un)published page
        const { data: agencyMissionaries } = await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
          .eq("agency_id", organizationData.id)
          .order("last_name", { ascending: true });

        if (agencyMissionaries && agencyMissionaries.length > 0) {
          const missionaryIds = agencyMissionaries.map((m: { id: number }) => m.id);
          const { data: missionaryPages } = await supabaseAdmin
            .from("pages")
            .select("organization_id, page_url, name, profile_photo_url, is_published")
            .eq("organization_type", "missionary")
            .in("organization_id", missionaryIds);

          type PageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
          const pageMap = new Map<number, PageRow>(
            (missionaryPages || []).map((p: PageRow) => [p.organization_id, p])
          );

          let followerStatusMap = new Map<number, string>();
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

          missionaries = agencyMissionaries.map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
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
          });
        }
      } else {
        // Public: only missionaries with a published page (two-step: no polymorphic join)
        const { data: agencyMissionaries } = await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
          .eq("agency_id", organizationData.id)
          .order("last_name", { ascending: true });

        if (agencyMissionaries && agencyMissionaries.length > 0) {
          const activeAgencyMissionaryIds = await getMissionaryIdsWithActiveUsers(
            supabaseAdmin,
            agencyMissionaries.map((m: { id: number }) => m.id)
          );
          const agencyMissionariesPublic = agencyMissionaries.filter((m: { id: number }) =>
            activeAgencyMissionaryIds.has(m.id)
          );

          if (agencyMissionariesPublic.length === 0) {
            missionaries = [];
          } else {
          const missionaryIds = agencyMissionariesPublic.map((m: { id: number }) => m.id);
          const { data: missionaryPages } = await supabaseAdmin
            .from("pages")
            .select("organization_id, page_url, name, profile_photo_url, is_published")
            .eq("organization_type", "missionary")
            .in("organization_id", missionaryIds)
            .eq("is_published", true);

          type PageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
          const pageMap = new Map<number, PageRow>(
            (missionaryPages || []).map((p: PageRow) => [p.organization_id, p])
          );

          let followerStatusMap = new Map<number, string>();
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

          missionaries = agencyMissionariesPublic
            .filter((m: { id: number }) => pageMap.has(m.id))
            .map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
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
          }
        }
      }
    }

    return {
      success: true,
      organizationType,
      data: {
        organization: organizationData,
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
          page_template: (pageData as { page_template?: string | null }).page_template ?? null,
        },
        media: mediaData || [],
        donations,
        isPreviewMode,
        isOwner,
        followerStatus,
        followerCount,
        missionaries,
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

