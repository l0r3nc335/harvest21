import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { PaginatedResponse, UserFollowerItem } from "@/types/pagination";
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
      .from("missionary_followers")
      .select("id, user_id, status, requested_at, note")
      .eq("missionary_id", missionaryId)
      .neq("status", "unfollowed")
      .order("requested_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching user followers:", error);
      return NextResponse.json(
        { error: "Failed to fetch followers" },
        { status: 500 }
      );
    }

    if (!followers || followers.length === 0) {
      return NextResponse.json<PaginatedResponse<UserFollowerItem>>({
        items: [],
        page,
        limit,
        total: 0,
        hasMore: false,
      });
    }

    const hasMore = followers.length > limit;
    const items = hasMore ? followers.slice(0, limit) : followers;

    const userIds = items.map((f: { user_id: string }) => f.user_id);
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("user_id, first_name, last_name, email")
      .in("user_id", userIds);

    const { data: supporterProfiles } = await supabaseAdmin
      .from("supporter_profiles")
      .select("user_id, profile_photo_url")
      .in("user_id", userIds);

    interface UserData {
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
    }

    interface ProfileData {
      user_id: string;
      profile_photo_url: string | null;
    }

    const usersMap = new Map<string, UserData>(users?.map((u: UserData) => [u.user_id, u]) || []);
    const profilesMap = new Map<string, ProfileData>(supporterProfiles?.map((p: ProfileData) => [p.user_id, p]) || []);

    const result: UserFollowerItem[] = items.map((follower: { id: number; user_id: string; status: string; requested_at: string; note?: string | null }) => {
      const userData = usersMap.get(follower.user_id);
      const profileData = profilesMap.get(follower.user_id);
      
      return {
        id: follower.id.toString(),
        user_id: follower.user_id,
        first_name: userData?.first_name || "Unknown",
        last_name: userData?.last_name || "User",
        email: userData?.email || "",
        profile_photo_url: profileData?.profile_photo_url || null,
        status: follower.status as 'pending' | 'accepted' | 'rejected',
        requested_at: follower.requested_at || "",
        note: follower.note ?? null,
      };
    });

    return NextResponse.json<PaginatedResponse<UserFollowerItem>>(
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
    console.error("Error in GET /api/missionaries/[id]/followers/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
