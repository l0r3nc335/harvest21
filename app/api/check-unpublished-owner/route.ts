import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { reportServerError } from "@/lib/errorReporting";

/**
 * GET /api/check-unpublished-owner?slug=xxx
 * Returns { isOwnerUnpublished: boolean } if the current user is the owner
 * of the page for the given slug and the page is unpublished.
 * Used to redirect before logout when on owner's unpublished public page.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      return NextResponse.json({ isOwnerUnpublished: false }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ isOwnerUnpublished: false });
    }

    const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!normalizedSlug || normalizedSlug.length > 200) {
      return NextResponse.json({ isOwnerUnpublished: false });
    }

    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    if (!currentUserId) {
      return NextResponse.json({ isOwnerUnpublished: false });
    }

    const supabaseAdmin = await getSupabaseServer();

    const { data: missionaryPage } = await supabaseAdmin
      .from("pages")
      .select("id, organization_id, is_published")
      .eq("page_url", normalizedSlug)
      .eq("organization_type", "missionary")
      .maybeSingle();

    if (missionaryPage) {
      const { data: missionary } = await supabaseAdmin
        .from("missionaries")
        .select("user_id")
        .eq("id", missionaryPage.organization_id)
        .single();
      const isOwner = missionary?.user_id === currentUserId;
      const isUnpublished = !missionaryPage.is_published;
      return NextResponse.json({
        isOwnerUnpublished: !!(isOwner && isUnpublished),
      });
    }

    const { data: orgPage } = await supabaseAdmin
      .from("pages")
      .select("id, organization_id, organization_type, is_published")
      .ilike("page_url", normalizedSlug)
      .in("organization_type", ["church", "agency", "college"])
      .maybeSingle();

    if (orgPage) {
      const orgType = orgPage.organization_type as "church" | "agency" | "college";
      const table =
        orgType === "church" ? "churches" : orgType === "agency" ? "agencies" : "colleges";
      const { data: org } = await supabaseAdmin
        .from(table)
        .select("contact_user_id")
        .eq("id", orgPage.organization_id)
        .single();
      const isOwner = org?.contact_user_id === currentUserId;
      const isUnpublished = !orgPage.is_published;
      return NextResponse.json({
        isOwnerUnpublished: !!(isOwner && isUnpublished),
      });
    }

    return NextResponse.json({ isOwnerUnpublished: false });
  } catch (error) {
    reportServerError(error, {
      path: "/api/check-unpublished-owner",
      method: "GET",
    });
    return NextResponse.json({ isOwnerUnpublished: false });
  }
}
