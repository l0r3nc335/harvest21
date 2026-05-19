import { getSupabaseServer } from "@/lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";
import { getPageDataSchema, parseBody } from "@/lib/validations";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/get-page-data", method: "POST" });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await request.json();
    const parsed = parseBody(getPageDataSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { pageId } = parsed.data;

    const supabase = await getSupabaseServer();
    const { data: pageData, error } = await supabase
      .from("pages")
      .select("organization_type, organization_id")
      .eq("id", pageId)
      .maybeSingle();

    if (error || !pageData) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(pageData);
  } catch (error) {
    console.error("Error fetching page data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
