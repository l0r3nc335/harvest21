"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Notification } from "@/types/follow";
import type { MissionaryNotifySource } from "@/types/missionaryContent";
import {
  buildNotificationContentMetadata,
  recordMissionaryContentPublication,
  upsertMissionaryContentAck,
  markUnreadMissionaryContentNotificationsReadForPage,
} from "@/lib/missionaryContentUpdates";
import {
  broadcastMissionaryFollowersNotification,
  broadcastStaffNotification,
  createNotification,
} from "@/lib/notificationRpc";

export async function getUserNotifications(limit: number = 50) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated", data: [] };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching notifications:", error);
    return { success: false, error: error.message, data: [] };
  }

  const pageNotifications = (data || []).filter((n: any) =>
    n.related_entity_type === "page" && n.related_entity_id
  );

  const pageIds = [...new Set(pageNotifications.map((n: any) => n.related_entity_id))];

  let pageUrlMap: Record<number, string | null> = {};
  if (pageIds.length > 0) {
    const { data: pages } = await supabase
      .from("pages")
      .select("id, page_url")
      .in("id", pageIds);

    if (pages) {
      pageUrlMap = pages.reduce((acc: Record<number, string | null>, page: any) => {
        acc[page.id] = page.page_url || null;
        return acc;
      }, {});
    }
  }

  const notifications = (data || []).map((notification: any) => ({
    ...notification,
    page_url: notification.related_entity_type === "page" && notification.related_entity_id
      ? pageUrlMap[notification.related_entity_id] || null
      : null,
  }));

  return { success: true, data: notifications as (Notification & { page_url?: string | null })[] };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return count ?? 0;
}

export async function getPageUrlFromId(pageId: number): Promise<string | null> {
  const supabase = await getSupabaseServer();

  try {
    const { data, error } = await supabase
      .from("pages")
      .select("page_url")
      .eq("id", pageId)
      .single();

    if (error || !data) {
      console.error("Error fetching page URL:", error);
      return null;
    }

    return data.page_url || null;
  } catch (error) {
    console.error("Error in getPageUrlFromId:", error);
    return null;
  }
}

export async function completeMissionaryContentEngagementForPage(
  pageId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("organization_id, organization_type")
    .eq("id", pageId)
    .single();

  if (pageError || !page || page.organization_type !== "missionary" || !page.organization_id) {
    return { success: true };
  }

  const missionaryId = page.organization_id as number;
  const ack = await upsertMissionaryContentAck(supabase, user.id, missionaryId);
  if (!ack.success) return ack;
  await markUnreadMissionaryContentNotificationsReadForPage(supabase, user.id, pageId);
  return { success: true };
}

export async function notifyMissionaryFollowers(
  pageId: number,
  contentType: "update_letter" | "video" | "photo" | "prayer" | "text_update",
  contentTitle: string | undefined,
  source: MissionaryNotifySource
): Promise<void> {
  const supabase = await getSupabaseServer();

  try {
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("organization_type, organization_id, page_url, name")
      .eq("id", pageId)
      .single();

    if (pageError || !page) {
      console.error("Error fetching page for notification:", pageError);
      return;
    }

    if (page.organization_type !== "missionary") return;

    const { data: missionary, error: missionaryError } = await supabase
      .from("missionaries")
      .select("id, first_name, last_name")
      .eq("id", page.organization_id)
      .single();

    if (missionaryError || !missionary) {
      console.error("Error fetching missionary for notification:", missionaryError);
      return;
    }

    const missionaryName = `${missionary.first_name} ${missionary.last_name}`;

    await recordMissionaryContentPublication(supabase, {
      missionaryId: missionary.id,
      pageId,
      contentType,
      source,
    });

    const contentMetadata = buildNotificationContentMetadata(source, contentType);

    let title = "";
    let message = "";
    switch (contentType) {
      case "update_letter":
        title = "New Update Letter";
        message = `${missionaryName} has posted a new update letter${contentTitle ? `: ${contentTitle}` : ""}`;
        break;
      case "video":
        title = "New Video";
        message = `${missionaryName} has uploaded a new video${contentTitle ? `: ${contentTitle}` : ""}`;
        break;
      case "photo":
        title = "New Photo";
        message = `${missionaryName} has uploaded a new photo${contentTitle ? `: ${contentTitle}` : ""}`;
        break;
      case "prayer":
        title = "New Prayer Request";
        message = `${missionaryName} has posted a new prayer request${contentTitle ? `: ${contentTitle}` : ""}`;
        break;
      case "text_update":
        title = "New Text Update";
        message = `${missionaryName} shared an update${contentTitle ? `: ${contentTitle}` : ""}`;
        break;
    }

    const { inserted, error: broadcastError } = await broadcastMissionaryFollowersNotification({
      missionaryId: missionary.id,
      type: `missionary_${contentType}`,
      title,
      message,
      relatedEntityType: "page",
      relatedEntityId: pageId,
      contentMetadata,
    });

    if (broadcastError) {
      console.error("Error broadcasting follower notifications:", broadcastError);
      return;
    }

    console.log(`Created ${inserted} notifications for ${contentType} on page ${pageId}`);
  } catch (error) {
    console.error("Error in notifyMissionaryFollowers:", error);
  }
}

export async function notifyAdminsOfMessageReport(params: {
  conversationId: number;
  reportType: "message" | "conversation";
  reportedBy: string;
  messageId?: number | null;
}): Promise<void> {
  const supabase = await getSupabaseServer();

  try {
    const [{ data: reporter }, { data: conversation }] = await Promise.all([
      supabase
        .from("users")
        .select("first_name, last_name")
        .eq("user_id", params.reportedBy)
        .maybeSingle(),
      supabase
        .from("conversations")
        .select("missionary_id, supporter_id")
        .eq("id", params.conversationId)
        .maybeSingle(),
    ]);

    const reporterName =
      [reporter?.first_name, reporter?.last_name].filter(Boolean).join(" ") || "A user";

    let missionaryName = "Unknown missionary";
    let supporterName = "Unknown supporter";

    if (conversation) {
      const [{ data: missionary }, { data: supporter }] = await Promise.all([
        supabase
          .from("missionaries")
          .select("first_name, last_name")
          .eq("id", conversation.missionary_id)
          .maybeSingle(),
        supabase
          .from("users")
          .select("first_name, last_name")
          .eq("user_id", conversation.supporter_id)
          .maybeSingle(),
      ]);

      missionaryName =
        [missionary?.first_name, missionary?.last_name].filter(Boolean).join(" ") ||
        missionaryName;
      supporterName =
        [supporter?.first_name, supporter?.last_name].filter(Boolean).join(" ") ||
        supporterName;
    }

    const reportLabel = params.reportType === "message" ? "Message Reported" : "Conversation Reported";
    const message =
      params.reportType === "message"
        ? `${reporterName} reported a message in the conversation between ${supporterName} and ${missionaryName}.`
        : `${reporterName} reported the conversation between ${supporterName} and ${missionaryName}.`;

    const { error } = await broadcastStaffNotification({
      type: "message_report",
      title: reportLabel,
      message,
      relatedEntityType: null,
      relatedEntityId: params.conversationId,
    });

    if (error) {
      console.error("Error broadcasting admin message report notifications:", error);
    }
  } catch (error) {
    console.error("Error in notifyAdminsOfMessageReport:", error);
  }
}

export async function markNotificationAsRead(notificationId: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: row } = await supabase
    .from("notifications")
    .select("type, related_entity_type, related_entity_id")
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    row?.type?.startsWith("missionary_") &&
    row.related_entity_type === "page" &&
    row.related_entity_id != null
  ) {
    return completeMissionaryContentEngagementForPage(row.related_entity_id as number);
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: unread } = await supabase
    .from("notifications")
    .select("related_entity_id, type")
    .eq("user_id", user.id)
    .eq("is_read", false);

  const pageIds = new Set<number>();
  for (const n of unread ?? []) {
    if (n.type?.startsWith("missionary_") && n.related_entity_id != null) {
      pageIds.add(n.related_entity_id as number);
    }
  }
  for (const pageId of pageIds) {
    await completeMissionaryContentEngagementForPage(pageId);
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error marking all notifications as read:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteNotification(notificationId: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting notification:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function handleFollowRequestAction(
  followerId: number,
  action: "accept" | "decline",
  notificationId: number
) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const status = action === "accept" ? "accepted" : "rejected";

  const { data: notification } = await supabase
    .from("notifications")
    .select("related_entity_type")
    .eq("id", notificationId)
    .single();

  const entityType = notification?.related_entity_type === "church_follower" ? "church" : "missionary";

  if (entityType === "church") {
    const { data: followerRecord, error: fetchError } = await supabase
      .from("church_followers")
      .select("church_id, user_id, churches!inner(contact_user_id, name)")
      .eq("id", followerId)
      .single();

    if (fetchError || !followerRecord) {
      return { success: false, error: "Follow request not found" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = userData?.role === 1 || userData?.role === 2;
    const churchData = followerRecord.churches as { contact_user_id: string; name: string } | null;
    const isChurchOwner = churchData?.contact_user_id === user.id;

    if (!isAdmin && !isChurchOwner) {
      return { success: false, error: "Unauthorized" };
    }

    const { error: updateError } = await supabase
      .from("church_followers")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id
      })
      .eq("id", followerId);

    if (updateError) {
      console.error("Error updating follower status:", updateError);
      return { success: false, error: "Failed to update follow request" };
    }

    await markNotificationAsRead(notificationId);

    await createFollowerNotificationForChurch(
      followerRecord.user_id,
      followerRecord.church_id,
      status,
      churchData?.name || "Church"
    );

    return { success: true, status };
  }

  const { data: followerRecord, error: fetchError } = await supabase
    .from("missionary_followers")
    .select("missionary_id, user_id, missionaries!inner(user_id, first_name, last_name)")
    .eq("id", followerId)
    .single();

  if (fetchError || !followerRecord) {
    return { success: false, error: "Follow request not found" };
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = userData?.role === 1 || userData?.role === 2;
  const isMissionaryOwner = (followerRecord.missionaries as any)?.user_id === user.id;

  if (!isAdmin && !isMissionaryOwner) {
    return { success: false, error: "Unauthorized" };
  }

  const { error: updateError } = await supabase
    .from("missionary_followers")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq("id", followerId);

  if (updateError) {
    console.error("Error updating follower status:", updateError);
    return { success: false, error: "Failed to update follow request" };
  }

  await markNotificationAsRead(notificationId);

  const missionaryData = followerRecord.missionaries as any;
  await createFollowerNotification(
    followerRecord.user_id,
    followerRecord.missionary_id,
    status,
    missionaryData?.first_name || '',
    missionaryData?.last_name || ''
  );

  return { success: true, status };
}

async function createFollowerNotification(
  followerId: string,
  missionaryId: number,
  status: 'accepted' | 'rejected',
  missionaryFirstName: string,
  missionaryLastName: string
) {
  try {
    const missionaryName = `${missionaryFirstName} ${missionaryLastName}`;
    const message = status === 'accepted'
      ? `${missionaryName} accepted your follow request`
      : `${missionaryName} declined your follow request`;

    const { error } = await createNotification({
      targetUserId: followerId,
      type: `follow_${status}`,
      title: status === 'accepted' ? "Follow Request Accepted" : "Follow Request Declined",
      message,
      relatedEntityType: "missionary",
      relatedEntityId: missionaryId,
    });

    if (error) {
      console.error("Error creating follower notification:", error);
    }
  } catch (error) {
    console.error("Error creating follower notification:", error);
  }
}

export async function createFollowerNotificationForChurch(
  followerId: string,
  churchId: number,
  status: 'accepted' | 'rejected',
  churchName: string
) {
  try {
    const message = status === 'accepted'
      ? `${churchName} accepted your follow request`
      : `${churchName} declined your follow request`;

    const { error } = await createNotification({
      targetUserId: followerId,
      type: `follow_${status}`,
      title: status === 'accepted' ? "Follow Request Accepted" : "Follow Request Declined",
      message,
      relatedEntityType: "church",
      relatedEntityId: churchId,
    });

    if (error) {
      console.error("Error creating follower notification for church:", error);
    }
  } catch (error) {
    console.error("Error creating follower notification for church:", error);
  }
}
