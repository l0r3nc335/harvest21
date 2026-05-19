import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageIdParam = searchParams.get("pageId");

    if (!pageIdParam || !/^\d+$/.test(pageIdParam)) {
      return NextResponse.json({ error: "Valid Page ID is required" }, { status: 400 });
    }
    const pageId = parseInt(pageIdParam, 10);

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);
    const offset = (page - 1) * limit;

    const supabase = await getSupabaseServer();

    const { data: pageRow } = await supabase
      .from("pages")
      .select("id")
      .eq("id", pageId)
      .maybeSingle();

    if (!pageRow) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const { data, error, count } = await supabase
      .from("page_media")
      .select("id, media_type, media_url, description, thumbnail_url, created_at", { count: "exact" })
      .eq("page_id", pageId)
      .neq("media_url", "placeholder")
      .eq("media_type", "video")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      videos: data || [],
      hasMore: count ? offset + limit < count : false,
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
