import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { PaginatedResponse, MissionaryFollowingItem } from "@/types/pagination";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { reportServerError } from "@/lib/errorReporting";

interface MissionaryRow {
  id: number;
  first_name: string;
  last_name: string;
}
interface PageRow {
  organization_id: number;
  page_url: string | null;
  profile_photo_url: string | null;
}
interface ChurchRow {
  id: number;
  name: string;
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabase = await getSupabaseServer();
    const supabaseAdmin = await getSupabaseServer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: currentMissionary } = await supabase
      .from("missionaries")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!currentMissionary) {
      return NextResponse.json(
        { error: "Missionary profile not found" },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const rawPage = parseInt(searchParams.get("page") || "1", 10);

    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const page = Math.max(rawPage, 1);

    // 1) Missionary follows (other missionaries)
    const { data: missionaryFollowing, error: missionaryError } = await supabase
      .from("missionary_missionary_followers")
      .select("id, followed_missionary_id, status, requested_at")
      .eq("follower_missionary_id", currentMissionary.id)
      .neq("status", "unfollowed")
      .order("requested_at", { ascending: false })
      .order("id", { ascending: false });

    if (missionaryError) {
      const { incidentId } = reportServerError(missionaryError, {
        path: "/api/missionaries/following",
        method: "GET",
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Failed to fetch following", incidentId },
        { status: 500 }
      );
    }

    // 2) Church follows (same user_id – missionary can follow churches)
    const { data: churchFollowing, error: churchError } = await supabase
      .from("church_followers")
      .select("id, church_id, status, requested_at")
      .eq("user_id", user.id)
      .neq("status", "unfollowed")
      .order("requested_at", { ascending: false })
      .order("id", { ascending: false });

    if (churchError) {
      reportServerError(churchError, {
        path: "/api/missionaries/following",
        method: "GET",
        userId: user.id,
        extra: { detail: "church_following_fetch_failed" },
      });
    }

    const missionaryIds = (missionaryFollowing || []).map((f: { followed_missionary_id: number }) => f.followed_missionary_id);
    const churchIds = (churchFollowing || []).map((f: { church_id: number }) => f.church_id);

    const [missionariesData, missionaryPagesData, churchesData, churchPagesData] = await Promise.all([
      missionaryIds.length > 0
        ? supabaseAdmin.from("missionaries").select("id, first_name, last_name").in("id", missionaryIds)
        : { data: [], error: null },
      missionaryIds.length > 0
        ? supabaseAdmin.from("pages").select("organization_id, page_url, profile_photo_url").eq("organization_type", "missionary").in("organization_id", missionaryIds)
        : { data: [], error: null },
      churchIds.length > 0
        ? supabaseAdmin.from("churches").select("id, name").in("id", churchIds)
        : { data: [], error: null },
      churchIds.length > 0
        ? supabaseAdmin.from("pages").select("organization_id, page_url, profile_photo_url").eq("organization_type", "church").in("organization_id", churchIds)
        : { data: [], error: null },
    ]);

    const missionariesMap = new Map<number, MissionaryRow>((missionariesData.data || []).map((m: MissionaryRow) => [m.id, m]));
    const missionaryPagesMap = new Map<number, PageRow>((missionaryPagesData.data || []).map((p: PageRow) => [p.organization_id, p]));
    const churchesMap = new Map<number, ChurchRow>((churchesData.data || []).map((c: ChurchRow) => [c.id, c]));
    const churchPagesMap = new Map<number, PageRow>((churchPagesData.data || []).map((p: PageRow) => [p.organization_id, p]));

    const missionaryItems: MissionaryFollowingItem[] = (missionaryFollowing || []).map((f: { id: number; followed_missionary_id: number; status: string; requested_at: string }) => {
      const m = missionariesMap.get(f.followed_missionary_id);
      const p = missionaryPagesMap.get(f.followed_missionary_id);
      return {
        id: `m-${f.id}`,
        missionary_id: f.followed_missionary_id,
        missionary_name: m ? `${m.first_name} ${m.last_name}` : "Unknown Missionary",
        page_url: p?.page_url ?? null,
        profile_photo_url: p?.profile_photo_url ?? null,
        status: f.status as "pending" | "accepted" | "rejected",
        requested_at: f.requested_at || "",
        entity_type: "missionary" as const,
        entity_id: f.followed_missionary_id,
      };
    });

    const churchItems: MissionaryFollowingItem[] = (churchFollowing || []).map((f: { id: number; church_id: number; status: string; requested_at: string }) => {
      const c = churchesMap.get(f.church_id);
      const p = churchPagesMap.get(f.church_id);
      return {
        id: `c-${f.id}`,
        missionary_id: 0,
        missionary_name: c?.name ?? "Unknown Church",
        page_url: p?.page_url ?? null,
        profile_photo_url: p?.profile_photo_url ?? null,
        status: f.status as "pending" | "accepted" | "rejected",
        requested_at: f.requested_at || "",
        entity_type: "church" as const,
        entity_id: f.church_id,
      };
    });

    const merged = [...missionaryItems, ...churchItems].sort(
      (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );

    const total = merged.length;
    const start = (page - 1) * limit;
    const items = merged.slice(start, start + limit);
    const hasMore = start + items.length < total;

    return NextResponse.json<PaginatedResponse<MissionaryFollowingItem>>(
      {
        items,
        page,
        limit,
        total,
        hasMore,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/missionaries/following",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Internal server error", incidentId },
      { status: 500 }
    );
  }
}
