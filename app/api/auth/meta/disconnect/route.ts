import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { platform?: "facebook" | "instagram" };
  if (body.platform !== "facebook" && body.platform !== "instagram") {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const admin = await getSupabaseServer();
  const { data: m } = await admin.from("missionaries").select("id").eq("user_id", user.id).maybeSingle();
  if (!m?.id) {
    return NextResponse.json({ error: "Not a missionary" }, { status: 403 });
  }

  const { data: row } = await admin
    .from("missionary_social_connections")
    .select("facebook_status, instagram_status")
    .eq("missionary_id", m.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ success: true });
  }

  const now = new Date().toISOString();

  if (body.platform === "facebook") {
    if (row.instagram_status === "connected") {
      await admin
        .from("missionary_social_connections")
        .update({
          facebook_status: "not_connected",
          facebook_page_name: null,
          updated_at: now,
        })
        .eq("missionary_id", m.id);
    } else {
      await admin.from("missionary_social_connections").delete().eq("missionary_id", m.id);
    }
  } else {
    await admin
      .from("missionary_social_connections")
      .update({
        instagram_status: "not_connected",
        instagram_business_account_id: null,
        instagram_username: null,
        last_instagram_verified_at: null,
        updated_at: now,
      })
      .eq("missionary_id", m.id);

    const { data: r2 } = await admin
      .from("missionary_social_connections")
      .select("facebook_status, instagram_status")
      .eq("missionary_id", m.id)
      .maybeSingle();

    if (r2?.facebook_status === "not_connected") {
      await admin.from("missionary_social_connections").delete().eq("missionary_id", m.id);
    }
  }

  const { data: final } = await admin
    .from("missionary_social_connections")
    .select("facebook_status, instagram_status")
    .eq("missionary_id", m.id)
    .maybeSingle();

  if (
    final &&
    final.facebook_status === "not_connected" &&
    final.instagram_status === "not_connected"
  ) {
    await admin.from("missionary_social_connections").delete().eq("missionary_id", m.id);
  }

  return NextResponse.json({ success: true });
}
