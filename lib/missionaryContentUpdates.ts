import { getSupabaseServer, type SupabaseServerClient } from "@/lib/supabaseServer";
import type {
  MissionaryPublicationContentType,
  MissionaryNotifySource,
  NotificationContentMetadata,
  ContentUpdateBadgePayload,
} from "@/types/missionaryContent";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function buildNotificationContentMetadata(
  source: MissionaryNotifySource,
  contentType: MissionaryPublicationContentType
): NotificationContentMetadata {
  const focus =
    source.sourceTable === "page_media"
      ? `page_media-${source.sourceId}`
      : source.sourceTable === "page_widgets"
        ? `page_widgets-${source.sourceId}`
        : `prayers-${source.sourceId}`;

  let tab: NotificationContentMetadata["tab"] = "about";
  if (source.sourceTable === "page_widgets") {
    tab = contentType === "text_update" ? "about" : "update-letters";
  } else if (source.sourceTable === "prayers") tab = "prayer-wall";
  else if (source.sourceTable === "page_media") tab = contentType === "video" ? "videos" : "photos";

  return { focus, tab };
}

export function badgePayloadForContentType(
  contentType: MissionaryPublicationContentType
): ContentUpdateBadgePayload {
  switch (contentType) {
    case "update_letter":
      return { contentType, label: "NEW UPDATE LETTER" };
    case "prayer":
      return { contentType, label: "NEW PRAYER REQUEST" };
    case "photo":
      return { contentType, label: "NEW PHOTO" };
    case "video":
      return { contentType, label: "NEW VIDEO" };
    case "text_update":
      return { contentType, label: "NEW UPDATE" };
    default:
      return { contentType: "photo", label: "NEW UPDATE" };
  }
}

export async function recordMissionaryContentPublication(
  admin: SupabaseServerClient,
  params: {
    missionaryId: number;
    pageId: number;
    contentType: MissionaryPublicationContentType;
    source: MissionaryNotifySource;
  }
): Promise<void> {
  const { error } = await admin.from("missionary_content_publications").insert({
    missionary_id: params.missionaryId,
    page_id: params.pageId,
    content_type: params.contentType,
    source_table: params.source.sourceTable,
    source_id: params.source.sourceId,
  });
  if (error) {
    console.error("recordMissionaryContentPublication:", error);
  }
}

export async function getContentUpdateBadgesForMissionaries(
  userId: string,
  missionaryIds: number[]
): Promise<Record<number, ContentUpdateBadgePayload>> {
  if (missionaryIds.length === 0) return {};

  const admin = await getSupabaseServer();
  const uniqueIds = [...new Set(missionaryIds)];

  const { data: follows, error: followErr } = await admin
    .from("missionary_followers")
    .select("missionary_id")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .in("missionary_id", uniqueIds);

  if (followErr) {
    console.error("getContentUpdateBadgesForMissionaries follows:", followErr);
    return {};
  }

  const { data: mmFollows } = await admin
    .from("missionary_missionary_followers")
    .select("followed_missionary_id, follower_missionary_id")
    .eq("status", "accepted")
    .in("followed_missionary_id", uniqueIds);

  const missionaryFollowerMissionaryIds = [
    ...new Set(
      (mmFollows ?? []).map((r: { follower_missionary_id: number }) => r.follower_missionary_id)
    ),
  ];
  let missionaryUserRows: { id: number; user_id: string }[] = [];
  if (missionaryFollowerMissionaryIds.length > 0) {
    const { data: mrows } = await admin
      .from("missionaries")
      .select("id, user_id")
      .in("id", missionaryFollowerMissionaryIds);
    missionaryUserRows = (mrows ?? []) as { id: number; user_id: string }[];
  }

  const acceptedSet = new Set<number>(
    (follows ?? []).map((f: { missionary_id: number }) => f.missionary_id)
  );
  for (const row of mmFollows ?? []) {
    const r = row as { followed_missionary_id: number; follower_missionary_id: number };
    const uid = missionaryUserRows.find((m) => m.id === r.follower_missionary_id)?.user_id;
    if (uid === userId) acceptedSet.add(r.followed_missionary_id);
  }

  const accepted = [...acceptedSet].filter((id) => uniqueIds.includes(id));
  if (accepted.length === 0) return {};

  const { data: acks } = await admin
    .from("missionary_follower_content_ack")
    .select("missionary_id, last_acknowledged_at")
    .eq("user_id", userId)
    .in("missionary_id", accepted);

  const ackByMissionary = new Map<number, string>(
    (acks ?? []).map((a: { missionary_id: number; last_acknowledged_at: string }) => [
      a.missionary_id,
      a.last_acknowledged_at,
    ])
  );

  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const { data: pubs, error: pubErr } = await admin
    .from("missionary_content_publications")
    .select("missionary_id, content_type, published_at")
    .in("missionary_id", accepted)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false });

  if (pubErr) {
    console.error("getContentUpdateBadgesForMissionaries pubs:", pubErr);
    return {};
  }

  const result: Record<number, ContentUpdateBadgePayload> = {};

  for (const row of pubs ?? []) {
    const mid = row.missionary_id as number;
    if (result[mid]) continue;
    const ackTime = ackByMissionary.get(mid) ?? "1970-01-01T00:00:00.000Z";
    if (new Date(row.published_at as string).getTime() <= new Date(ackTime).getTime()) continue;
    result[mid] = badgePayloadForContentType(row.content_type as MissionaryPublicationContentType);
  }

  return result;
}

export async function upsertMissionaryContentAck(
  supabase: SupabaseServerClient,
  userId: string,
  missionaryId: number
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("missionary_follower_content_ack").upsert(
    {
      user_id: userId,
      missionary_id: missionaryId,
      last_acknowledged_at: now,
    },
    { onConflict: "user_id,missionary_id" }
  );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markUnreadMissionaryContentNotificationsReadForPage(
  supabase: SupabaseServerClient,
  userId: string,
  pageId: number
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false)
    .eq("related_entity_type", "page")
    .eq("related_entity_id", pageId)
    .like("type", "missionary_%");

  if (error) console.error("markUnreadMissionaryContentNotificationsReadForPage:", error);
}
