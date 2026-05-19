import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { PaginatedResponse, MissionaryFollowerItem } from "@/types/pagination";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id: missionaryId } = await params;
    const supabase = await getSupabaseServer();
    const supabaseAdmin = await getSupabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const rawPage = parseInt(searchParams.get("page") || "1", 10);

    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const page = Math.max(rawPage, 1);
    const offset = (page - 1) * limit;

    const from = offset;
    const to = offset + limit;

    const { data: followers, error } = await supabase
      .from("missionary_missionary_followers")
      .select("id, follower_missionary_id, status, requested_at, created_at, note")
      .eq("followed_missionary_id", missionaryId)
      .neq("status", "unfollowed")
      .order("requested_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching missionary followers:", error);
      return NextResponse.json(
        { error: "Failed to fetch followers" },
        { status: 500 }
      );
    }

    console.log(`[API] Fetched ${followers?.length || 0} missionary followers for missionary ${missionaryId}`);

    if (!followers || followers.length === 0) {
      return NextResponse.json<PaginatedResponse<MissionaryFollowerItem>>({
        items: [],
        page,
        limit,
        total: 0,
        hasMore: false,
      });
    }

    const hasMore = followers.length > limit;
    const items = hasMore ? followers.slice(0, limit) : followers;

    const missionaryIds = items.map((f: { follower_missionary_id: number }) => f.follower_missionary_id);
    
    const { data: missionaries, error: missionariesError } = await supabaseAdmin
      .from("missionaries")
      .select("id, first_name, last_name, email")
      .in("id", missionaryIds);

    if (missionariesError) {
      console.error("Error fetching missionaries:", missionariesError);
    }
    console.log(`[API] Fetched ${missionaries?.length || 0} missionaries for IDs:`, missionaryIds);

    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("pages")
      .select("organization_id, profile_photo_url, page_url")
      .eq("organization_type", "missionary")
      .in("organization_id", missionaryIds);

    if (pagesError) {
      console.error("Error fetching pages:", pagesError);
    }
    console.log(`[API] Fetched ${pages?.length || 0} pages for missionary IDs:`, missionaryIds);

    interface MissionaryData {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
    }

    interface PageData {
      organization_id: number;
      profile_photo_url: string | null;
      page_url: string | null;
    }

    const missionariesMap = new Map<number, MissionaryData>(missionaries?.map((m: MissionaryData) => [m.id, m]) || []);
    const pagesMap = new Map<number, PageData>(pages?.map((p: PageData) => [p.organization_id, p]) || []);

    const result: MissionaryFollowerItem[] = items.map((follower: { id: number; follower_missionary_id: number; status: string; requested_at: string; created_at?: string; note?: string | null }) => {
      const missionaryData = missionariesMap.get(follower.follower_missionary_id);
      const pageData = pagesMap.get(follower.follower_missionary_id);
      
      if (!missionaryData) {
        console.warn(`[API] Missionary not found for ID: ${follower.follower_missionary_id}`);
      }
      
      return {
        id: follower.id.toString(),
        missionary_id: follower.follower_missionary_id,
        first_name: missionaryData?.first_name || "Unknown",
        last_name: missionaryData?.last_name || "Missionary",
        email: missionaryData?.email || "",
        profile_photo_url: pageData?.profile_photo_url || null,
        page_url: pageData?.page_url || null,
        status: follower.status as 'pending' | 'accepted' | 'rejected',
        requested_at: follower.requested_at || follower.created_at || new Date().toISOString(),
        note: follower.note ?? null,
      };
    });

    return NextResponse.json<PaginatedResponse<MissionaryFollowerItem>>(
      {
        items: result,
        page,
        limit,
        total: null,
        hasMore,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error in GET /api/missionaries/[id]/followers/missionaries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
