import { NextRequest, NextResponse } from "next/server";
import { getUserProfile } from "@/lib/navbarHelpers";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { success: withinLimit } = await rateLimitCheck(ip, "general");
  if (!withinLimit) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userProfile = await getUserProfile();

  if (!userProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(userProfile);
}
