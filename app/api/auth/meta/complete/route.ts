import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { decryptJson } from "@/lib/token-crypto";
import type { MetaPageAccount } from "@/lib/meta-graph";
import { saveFacebookConnection, saveInstagramConnection } from "@/lib/missionary-social-connection";

type PendingPayload = {
  userLongLivedToken: string;
  accounts: MetaPageAccount[];
};

export async function POST(request: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { pendingId?: string; pageId?: string };
  if (!body.pendingId || !body.pageId) {
    return NextResponse.json({ error: "Missing pendingId or pageId" }, { status: 400 });
  }

  const admin = await getSupabaseServer();
  const { data: row, error } = await admin
    .from("meta_oauth_pending")
    .select("id, missionary_id, user_id, encrypted_payload, expires_at, intent")
    .eq("id", body.pendingId)
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
    return NextResponse.json({ error: "Invalid session" }, { status: 500 });
  }

  const account = payload.accounts.find((a) => a.id === body.pageId);
  if (!account) {
    return NextResponse.json({ error: "Page not in session" }, { status: 400 });
  }

  const missionaryId = row.missionary_id as number;
  const intent = row.intent as "facebook" | "instagram";

  try {
    if (intent === "facebook") {
      await saveFacebookConnection(missionaryId, account, payload.userLongLivedToken);
    } else {
      await saveInstagramConnection(missionaryId, account, payload.userLongLivedToken);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }

  await admin.from("meta_oauth_pending").delete().eq("id", body.pendingId);

  return NextResponse.json({ success: true });
}
