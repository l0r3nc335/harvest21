import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { decryptJson } from "@/lib/token-crypto";
import type { MetaPageAccount } from "@/lib/meta-graph";

type PendingPayload = {
  userLongLivedToken: string;
  accounts: MetaPageAccount[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pendingId = searchParams.get("id");
  if (!pendingId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await getSupabaseServer();
  const { data: row, error } = await admin
    .from("meta_oauth_pending")
    .select("encrypted_payload, user_id, expires_at, intent")
    .eq("id", pendingId)
    .maybeSingle();

  if (error || !row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (new Date(row.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  let payload: PendingPayload;
  try {
    payload = decryptJson<PendingPayload>(row.encrypted_payload as string);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 500 });
  }

  const pages = (payload.accounts || []).map((a) => ({
    id: a.id,
    name: a.name,
    hasInstagram: !!a.instagram_business_account?.id,
    instagramUsername: a.instagram_business_account?.username ?? null,
  }));

  return NextResponse.json({
    success: true,
    intent: row.intent,
    pages,
  });
}
