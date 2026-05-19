import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { getMissionaryIdsWithActiveUsers } from "@/lib/missionaryPublicEligibility";
import { ChurchPublicView } from "@/components/church/ChurchPublicView";
import { getChurchFollowerStatus } from "@/app/admin/churches/actions";

interface ChurchPageProps {
  params: {
    id: string;
  };
}

export default async function ChurchPage({ params }: ChurchPageProps) {
  const supabase = await getSupabaseServer();
  const churchId = parseInt(params.id);

  if (isNaN(churchId)) {
    notFound();
  }

  // Fetch church data
  const { data: church, error: churchError } = await supabase
    .from("churches")
    .select("*")
    .eq("id", churchId)
    .single();

  if (churchError || !church) {
    notFound();
  }

  // Fetch church page
  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("*")
    .eq("organization_type", "church")
    .eq("organization_id", churchId)
    .single();

  if (pageError || !page) {
    notFound();
  }

  // Only show published pages to public
  if (!page.is_published) {
    notFound();
  }

  // Fetch media
  const { data: media } = await supabase
    .from("page_media")
    .select("*")
    .eq("page_id", page.id)
    .order("created_at", { ascending: false });

  // Get follower status for current user
  const followerStatus = await getChurchFollowerStatus(churchId);

  // Get follower count
  const { count: followerCount } = await supabase
    .from("church_followers")
    .select("*", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("status", "accepted");

  // Get user to check ownership before fetching missionaries
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  // Fetch missionaries if user is an accepted follower OR owns the church
  let missionaries: any[] = [];
  let isOwner = false;
  
  if (currentUserId) {
    isOwner = church.contact_user_id === currentUserId;
  }

  // Fetch missionaries: (1) missionary_churches pivot, (2) sending_church_id = this church, (3) mission_field_church_id = this church.
  // Only include missionaries whose page is_published is true.
  if (followerStatus === "accepted" || isOwner) {
    const supabaseAdmin = await getSupabaseServer();

    const { data: missionaryChurches } = await supabaseAdmin
      .from("missionary_churches")
      .select(`
        missionary:missionaries (
          id,
          first_name,
          last_name,
          country_of_residence,
          destination_country
        )
      `)
      .eq("church_id", churchId)
      .eq("is_active", true);

    const { data: sendingChurchMissionaries } = await supabaseAdmin
      .from("missionaries")
      .select("id, first_name, last_name, country_of_residence, destination_country")
      .eq("sending_church_id", churchId);

    const { data: missionFieldChurchMissionaries } = await supabaseAdmin
      .from("missionaries")
      .select("id, first_name, last_name, country_of_residence, destination_country")
      .eq("mission_field_church_id", churchId);

    type RawMissionary = { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null };
    const fromPivot = (missionaryChurches || [])
      .map((mc: { missionary: unknown }) => mc.missionary)
      .filter((m: unknown): m is RawMissionary => m != null);
    const fromSendingChurch = (sendingChurchMissionaries || []) as RawMissionary[];
    const fromMissionField = (missionFieldChurchMissionaries || []) as RawMissionary[];
    const seenIds = new Set<number>();
    const rawMissionaries: RawMissionary[] = [];
    for (const m of fromPivot) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        rawMissionaries.push(m);
      }
    }
    for (const m of fromSendingChurch) {
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

    if (rawMissionaries.length > 0) {
      const missionaryIds = rawMissionaries.map((m) => m.id);

      const activeMissionaryIdSet = await getMissionaryIdsWithActiveUsers(
        supabaseAdmin,
        missionaryIds
      );
      const activeMissionaryIds = missionaryIds.filter((id) => activeMissionaryIdSet.has(id));
      const activeRawMissionaries = rawMissionaries.filter((m) => activeMissionaryIdSet.has(m.id));

      const { data: missionaryPages } = await supabaseAdmin
        .from("pages")
        .select("organization_id, page_url, name, profile_photo_url, is_published")
        .eq("organization_type", "missionary")
        .eq("is_published", true)
        .in("organization_id", activeMissionaryIds);

      type MissionaryPageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
      const pageMap = new Map<number, MissionaryPageRow>(
        (missionaryPages || []).map((p: MissionaryPageRow) => [p.organization_id, p])
      );

      // Fetch follower statuses for the current user
      let followerStatusMap = new Map<number, string>();
      if (currentUserId && activeMissionaryIds.length > 0) {
        const { data: follows } = await supabaseAdmin
          .from("missionary_followers")
          .select("missionary_id, status")
          .eq("user_id", currentUserId)
          .in("missionary_id", activeMissionaryIds);
        (follows || []).forEach((f: { missionary_id: number; status: string }) => {
          followerStatusMap.set(f.missionary_id, f.status);
        });
      }

      missionaries = activeRawMissionaries
        .filter((m) => pageMap.has(m.id))
        .map((m: RawMissionary) => {
          const page = pageMap.get(m.id)!;
          return {
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            destination_country: m.destination_country ?? null,
            country_of_residence: m.country_of_residence ?? null,
            page_url: page.page_url,
            profile_photo_url: page.profile_photo_url ?? null,
            page_name: page.name ?? null,
            is_published: true,
            follower_status: followerStatusMap.get(m.id) || "none",
          };
        });
    }
  }

  // Get user profile if logged in
  let initialUserProfile = null;

  if (currentUserId) {
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUserId)
      .single();

    if (userData) {
      const { data: userPage } = await supabase
        .from("pages")
        .select("page_url, name")
        .eq("organization_id", userData.id)
        .single();

      initialUserProfile = {
        id: userData.user_id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        role: userData.role,
        profile_photo_url: null,
        page_url: userPage?.page_url || null,
        page_name: userPage?.name || null,
      };
    }
  }

  return (
    <ChurchPublicView
      church={church}
      page={page}
      media={media || []}
      missionaries={missionaries}
      initialUserProfile={initialUserProfile}
      followerStatus={followerStatus}
      followerCount={followerCount || 0}
      isOwner={isOwner}
    />
  );
}

