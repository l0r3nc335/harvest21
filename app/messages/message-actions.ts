"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { notifyAdminsOfMessageReport } from "@/lib/notificationHelpers";
import type {
  Conversation,
  ConversationWithDetails,
  Message,
  MessageWithSender,
  OtherUserType,
  ReportMessageParams,
  SendMessageParams,
} from "@/types/messaging";

function roleToUserType(role?: number): OtherUserType | null {
  switch (role) {
    case 3:
      return "missionary";
    case 4:
      return "supporter";
    case 5:
      return "agency";
    case 6:
      return "church";
    case 7:
      return "college";
    default:
      return null;
  }
}

interface ConversationMember {
  conversation_id: number;
  unread_count: number;
  user_id: string;
}

interface MissionaryData {
  id: number;
  first_name: string;
  last_name: string;
  user_id: string;
}

interface PageData {
  organization_id: number;
  name: string;
  profile_photo_url: string | null;
}

interface UserData {
  user_id: string;
  first_name: string;
  last_name: string;
  role?: number;
}

interface ConversationData extends Conversation {
  missionaries?: MissionaryData;
}

interface MessageData extends Message {
  sender_id: string;
}

export async function getOrCreateConversation(missionaryId: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const canSend = await canSendDirectMessage(missionaryId);
  if (!canSend.allowed) {
    return { success: false, error: canSend.reason || "Cannot send message" };
  }

  let conversation = await supabase
    .from("conversations")
    .select("*")
    .eq("missionary_id", missionaryId)
    .eq("supporter_id", user.id)
    .maybeSingle();

  if (conversation.error) {
    return { success: false, error: conversation.error.message };
  }

  if (conversation.data) {
    return { success: true, data: conversation.data as Conversation };
  }

  const { data: otherMissionary } = await supabase
    .from("missionaries")
    .select("user_id")
    .eq("id", missionaryId)
    .single();

  const { data: currentUserMissionary } = await supabase
    .from("missionaries")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (otherMissionary?.user_id && currentUserMissionary?.id) {
    const existingAsOther = await supabase
      .from("conversations")
      .select("*")
      .eq("missionary_id", currentUserMissionary.id)
      .eq("supporter_id", otherMissionary.user_id)
      .maybeSingle();

    if (existingAsOther.error) {
      return { success: false, error: existingAsOther.error.message };
    }
    if (existingAsOther.data) {
      return { success: true, data: existingAsOther.data as Conversation };
    }
  }

  const { data: newConversation, error: createError } = await supabase
    .from("conversations")
    .insert({
      missionary_id: missionaryId,
      supporter_id: user.id,
    })
    .select()
    .single();

  if (createError) {
    return { success: false, error: createError.message };
  }

  if (otherMissionary?.user_id) {
    await supabase.from("conversation_members").insert([
      { conversation_id: newConversation.id, user_id: user.id },
      { conversation_id: newConversation.id, user_id: otherMissionary.user_id },
    ]);
  }

  return { success: true, data: newConversation as Conversation };
}

export async function canSendDirectMessage(missionaryId: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, reason: "You must be logged in" };
  }

  // Check 1: User follows via missionary_followers (supporters, churches, agencies, etc.)
  const { data: followerStatus } = await supabase
    .from("missionary_followers")
    .select("status")
    .eq("missionary_id", missionaryId)
    .eq("user_id", user.id)
    .maybeSingle();

  let isAcceptedFollower = followerStatus?.status === "accepted";

  // Check 2: If not in missionary_followers, check missionary_missionary_followers (missionary following missionary)
  if (!isAcceptedFollower) {
    const { data: currentUserMissionary } = await supabase
      .from("missionaries")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentUserMissionary?.id) {
      const { data: mmFollowerStatus } = await supabase
        .from("missionary_missionary_followers")
        .select("status")
        .eq("follower_missionary_id", currentUserMissionary.id)
        .eq("followed_missionary_id", missionaryId)
        .maybeSingle();

      isAcceptedFollower = mmFollowerStatus?.status === "accepted";
    }
  }

  if (!isAcceptedFollower) {
    return {
      allowed: false,
      reason: "You must be an accepted follower to send messages",
    };
  }

  const { data: missionary } = await supabase
    .from("missionaries")
    .select("allow_direct_messages")
    .eq("id", missionaryId)
    .single();

  if (!missionary?.allow_direct_messages) {
    return { 
      allowed: false, 
      reason: "This missionary has disabled direct messages" 
    };
  }

  return { allowed: true };
}

export async function sendMessage({ conversationId, content }: SendMessageParams) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: "Message cannot be empty" };
  }

  if (content.length > 5000) {
    return { success: false, error: "Message too long (max 5000 characters)" };
  }

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { success: false, error: "You are not a member of this conversation" };
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("missionary_id, supporter_id")
    .eq("id", conversationId)
    .single();

  if (conversation) {
    const recipientId = conversation.supporter_id === user.id 
      ? (await supabase.from("missionaries").select("user_id").eq("id", conversation.missionary_id).single()).data?.user_id
      : conversation.supporter_id;

    if (recipientId) {
      // Update conversation last message info
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.trim().substring(0, 100),
          last_message_sender_id: user.id,
        })
        .eq("id", conversationId);

      // Send notification
      const { data: senderProfile, error: senderError } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      if (senderError) {
        console.error("Error fetching sender profile:", senderError);
      }

      if (senderProfile?.first_name && senderProfile?.last_name) {
        const senderName = `${senderProfile.first_name} ${senderProfile.last_name}`;

        // Use admin client to bypass RLS when creating notification for another user
        const { data: notification } = await supabaseAdmin
          .from("notifications")
          .insert({
            user_id: recipientId,
            type: "direct_message",
            title: "New Message",
            message: `${senderName} sent you a message`,
            related_entity_type: "conversation",
            related_entity_id: conversationId,
          })
          .select()
          .single();
      }
    }
  }

  return { success: true, data: message as Message };
}

export async function getConversations() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated", data: [] };
  }

  const { data: memberData } = await supabase
    .from("conversation_members")
    .select("conversation_id, unread_count")
    .eq("user_id", user.id);

  if (!memberData || memberData.length === 0) {
    return { success: true, data: [] };
  }

  const conversationIds = memberData.map((m: ConversationMember) => m.conversation_id);

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(`
      *,
      missionaries:missionary_id (
        id,
        first_name,
        last_name,
        user_id
      )
    `)
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message, data: [] };
  }

  const allUserIds = new Set<string>();
  (conversations as ConversationData[]).forEach((c: ConversationData) => {
    if (c.missionaries?.user_id) allUserIds.add(c.missionaries.user_id);
    if (c.supporter_id) allUserIds.add(c.supporter_id);
  });

  const { data: allUsers, error: usersError } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, role")
    .in("user_id", Array.from(allUserIds));

  if (usersError) {
    console.error("Error fetching users:", usersError);
  }

  const userMap = new Map<string, UserData>(
    allUsers?.map((u: UserData) => [u.user_id, u]) || []
  );

  const conversationIdsForPages = (conversations as ConversationData[])
    .map((c: ConversationData) => c.missionary_id)
    .filter(Boolean);

  // Use admin client: RLS only allows page owners to read; we need page_url for all conversation partners
  const supabaseAdmin = await getSupabaseServer();
  const { data: pages } =
    conversationIdsForPages.length > 0
      ? await supabaseAdmin
          .from("pages")
          .select("organization_id, name, profile_photo_url, page_url, is_published")
          .eq("organization_type", "missionary")
          .in("organization_id", conversationIdsForPages)
      : { data: [] };

  const pageMap = new Map(
    pages?.map((p: PageData & { page_url?: string; is_published?: boolean }) => [p.organization_id, p]) || []
  );
  const supporterDataPromises = (conversations as ConversationData[])
    .filter((c: ConversationData) => c.missionaries?.user_id === user.id)
    .map(async (c: ConversationData) => {
      const supporterUserId = c.supporter_id;
      const supporterUserData = userMap.get(supporterUserId);
      const role = supporterUserData?.role;
      
      let profilePhoto: string | null = null;
      let pageUrl: string | null = null;
      let pageIsPublished: boolean = false;

      if (role === 4) {
        // Supporter - no public page
        const { data } = await supabaseAdmin
          .from("supporter_profiles")
          .select("profile_photo_url")
          .eq("user_id", supporterUserId)
          .maybeSingle();
        profilePhoto = data?.profile_photo_url || null;
      } else if (role === 3) {
        const { data: missionaryData } = await supabaseAdmin
          .from("missionaries")
          .select("id")
          .eq("user_id", supporterUserId)
          .single();
        
        if (missionaryData) {
          const { data } = await supabaseAdmin
            .from("pages")
            .select("profile_photo_url, page_url, is_published")
            .eq("organization_type", "missionary")
            .eq("organization_id", missionaryData.id)
            .maybeSingle();
          profilePhoto = data?.profile_photo_url || null;
          pageUrl = data?.page_url || null;
          pageIsPublished = data?.is_published ?? false;
        }
      } else if (role === 5) {
        const { data: agencyData } = await supabaseAdmin
          .from("agencies")
          .select("id")
          .eq("contact_user_id", supporterUserId)
          .single();
        
        if (agencyData) {
          const { data } = await supabaseAdmin
            .from("pages")
            .select("profile_photo_url, page_url, is_published")
            .eq("organization_type", "agency")
            .eq("organization_id", agencyData.id)
            .maybeSingle();
          profilePhoto = data?.profile_photo_url || null;
          pageUrl = data?.page_url || null;
          pageIsPublished = data?.is_published ?? false;
        }
      } else if (role === 6) {
        const { data: churchData } = await supabaseAdmin
          .from("churches")
          .select("id")
          .eq("contact_user_id", supporterUserId)
          .single();
        
        if (churchData) {
          const { data } = await supabaseAdmin
            .from("pages")
            .select("profile_photo_url, page_url, is_published")
            .eq("organization_type", "church")
            .eq("organization_id", churchData.id)
            .maybeSingle();
          profilePhoto = data?.profile_photo_url || null;
          pageUrl = data?.page_url || null;
          pageIsPublished = data?.is_published ?? false;
        }
      } else if (role === 7) {
        const { data: collegeData } = await supabaseAdmin
          .from("colleges")
          .select("id")
          .eq("contact_user_id", supporterUserId)
          .single();
        
        if (collegeData) {
          const { data } = await supabaseAdmin
            .from("pages")
            .select("profile_photo_url, page_url, is_published")
            .eq("organization_type", "college")
            .eq("organization_id", collegeData.id)
            .maybeSingle();
          profilePhoto = data?.profile_photo_url || null;
          pageUrl = data?.page_url || null;
          pageIsPublished = data?.is_published ?? false;
        }
      }

      return { userId: supporterUserId, profilePhoto, pageUrl, pageIsPublished };
    });

  const supporterDataResults = await Promise.all(supporterDataPromises);
  const supporterPhotoMap = new Map(
    supporterDataResults.map((sp) => [sp.userId, sp.profilePhoto])
  );
  const supporterPageUrlMap = new Map(
    supporterDataResults.map((sp) => [sp.userId, sp.pageUrl])
  );
  const supporterPageIsPublishedMap = new Map(
    supporterDataResults.map((sp) => [sp.userId, sp.pageIsPublished])
  );

  const enriched: ConversationWithDetails[] = (conversations as ConversationData[]).map((conv: ConversationData) => {
    const member = memberData.find((m: ConversationMember) => m.conversation_id === conv.id);
    const isMissionary = conv.missionaries?.user_id === user.id;

    const otherUserId = isMissionary ? conv.supporter_id : conv.missionaries?.user_id;
    const otherUser = otherUserId ? userMap.get(otherUserId) : null;

    if (isMissionary) {
      const otherUserFirstName = otherUser?.first_name || 'Unknown';
      const otherUserLastName = otherUser?.last_name || 'User';
      const otherUserFullName = `${otherUserFirstName} ${otherUserLastName}`;
      const profilePhoto = supporterPhotoMap.get(conv.supporter_id) || null;
      const otherUserPageUrl = supporterPageUrlMap.get(conv.supporter_id) || null;
      const otherUserPageIsPublished = supporterPageIsPublishedMap.get(conv.supporter_id) ?? false;
      const otherUserType = roleToUserType(otherUser?.role);

      return {
        ...conv,
        missionary_name: otherUserFullName,
        missionary_first_name: otherUserFirstName,
        missionary_last_name: otherUserLastName,
        missionary_profile_photo: profilePhoto,
        missionary_page_url: otherUserPageUrl,
        missionary_page_is_published: otherUserPageIsPublished,
        page_name: null,
        unread_count: member?.unread_count || 0,
        is_missionary: isMissionary,
        other_user_type: otherUserType,
      };
    }

    const page = pageMap.get(conv.missionary_id) as { name?: string; profile_photo_url?: string; page_url?: string; is_published?: boolean } | undefined;
    const missionaryName = page?.name || `${conv.missionaries?.first_name || 'Unknown'} ${conv.missionaries?.last_name || 'Missionary'}`;
    
    return {
      ...conv,
      missionary_name: missionaryName,
      missionary_first_name: conv.missionaries?.first_name || 'Unknown',
      missionary_last_name: conv.missionaries?.last_name || 'Missionary',
      missionary_profile_photo: page?.profile_photo_url || null,
      missionary_page_url: page?.page_url || null,
      missionary_page_is_published: page?.is_published ?? false,
      page_name: page?.name || null,
      unread_count: member?.unread_count || 0,
      is_missionary: isMissionary,
      other_user_type: "missionary",
    };
  });

  return { success: true, data: enriched };
}

export async function searchConversationsByMessageContent(query: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated", data: {} as Record<number, string> };
  }

  const q = query?.trim();
  if (!q || q.length < 2) {
    return { success: true, data: {} as Record<number, string> };
  }

  const { data: memberData } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (!memberData || memberData.length === 0) {
    return { success: true, data: {} as Record<number, string> };
  }

  const conversationIds = memberData.map((m: { conversation_id: number }) => m.conversation_id);

  const escaped = q.replace(/[%_\\]/g, "\\$&");
  const { data: messages, error } = await supabase
    .from("messages")
    .select("conversation_id, content")
    .in("conversation_id", conversationIds)
    .ilike("content", `%${escaped}%`)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message, data: {} as Record<number, string> };
  }

  const snippetMap: Record<number, string> = {};
  (messages || []).forEach((m: { conversation_id: number; content: string }) => {
    if (!snippetMap[m.conversation_id]) {
      snippetMap[m.conversation_id] = m.content.length > 100
        ? m.content.substring(0, 100) + "..."
        : m.content;
    }
  });

  return { success: true, data: snippetMap };
}

export async function getMessages(conversationId: number, page: number = 1, limit: number = 50) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated", data: [] };
  }

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { success: false, error: "Access denied", data: [] };
  }

  const offset = (page - 1) * limit;

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { success: false, error: error.message, data: [] };
  }

  const senderIds = [...new Set((messages as MessageData[]).map((m: MessageData) => m.sender_id))];
  const { data: senders } = await supabase
    .from("users")
    .select("user_id, first_name, last_name")
    .in("user_id", senderIds);

  const senderMap = new Map(
    senders?.map((s: UserData) => [s.user_id, s]) || []
  );

  const enriched: MessageWithSender[] = (messages as MessageData[]).map((msg: MessageData) => {
    const sender = senderMap.get(msg.sender_id) as { first_name?: string; last_name?: string } | undefined;
    return {
      ...msg,
      sender_first_name: sender?.first_name || "",
      sender_last_name: sender?.last_name || "",
      sender_name: sender ? `${sender.first_name} ${sender.last_name}` : "Unknown",
      is_current_user: msg.sender_id === user.id,
    };
  });

  return { success: true, data: enriched.reverse() };
}

export async function markConversationAsRead(conversationId: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("conversation_members")
    .update({ 
      unread_count: 0,
      last_read_at: new Date().toISOString()
    })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getTotalUnreadCount() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, count: 0 };
  }

  const { data } = await supabase
    .from("conversation_members")
    .select("unread_count")
    .eq("user_id", user.id);

  const total = data?.reduce((sum: number, member: ConversationMember) => sum + (member.unread_count || 0), 0) || 0;

  return { success: true, count: total };
}

export async function reportMessage({ 
  conversationId, 
  messageId, 
  reportType, 
  reason 
}: ReportMessageParams) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { success: false, error: "Access denied" };
  }

  const { error } = await supabase
    .from("message_reports")
    .insert({
      conversation_id: conversationId,
      message_id: messageId || null,
      reported_by: user.id,
      report_type: reportType,
      reason: reason || null,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  await notifyAdminsOfMessageReport({
    conversationId,
    messageId: messageId || null,
    reportType,
    reportedBy: user.id,
  });

  return { success: true, message: "Report submitted successfully" };
}

export async function updateMissionaryDMSettings(allowDM: boolean) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: missionary } = await supabase
    .from("missionaries")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!missionary) {
    return { success: false, error: "Not a missionary" };
  }

  const { error } = await supabase
    .from("missionaries")
    .update({ allow_direct_messages: allowDM })
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getConversationDetails(conversationId: number) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { success: false, error: "Access denied" };
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(`
      *,
      missionaries:missionary_id (
        id,
        first_name,
        last_name,
        user_id
      )
    `)
    .eq("id", conversationId)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const convData = conversation as ConversationData;
  const isMissionary = convData.missionaries?.user_id === user.id;

  if (isMissionary) {
    const { data: otherUser } = await supabase
      .from("users")
      .select("first_name, last_name, role")
      .eq("user_id", conversation.supporter_id)
      .single();

    const otherUserFirstName = otherUser?.first_name || 'Unknown';
    const otherUserLastName = otherUser?.last_name || 'User';
    const otherUserFullName = `${otherUserFirstName} ${otherUserLastName}`;
    
    // Fetch profile photo and page_url based on user role
    let profilePhoto: string | null = null;
    let otherUserPageUrl: string | null = null;
    let otherUserPageIsPublished: boolean = false;
    const role = otherUser?.role;
    const supabaseAdmin = await getSupabaseServer();
    
    if (role === 4) {
      const { data } = await supabaseAdmin
        .from("supporter_profiles")
        .select("profile_photo_url")
        .eq("user_id", conversation.supporter_id)
        .maybeSingle();
      profilePhoto = data?.profile_photo_url || null;
    } else if (role === 3) {
      const { data: missionaryData } = await supabaseAdmin
        .from("missionaries")
        .select("id")
        .eq("user_id", conversation.supporter_id)
        .single();
      
      if (missionaryData) {
        const { data } = await supabaseAdmin
          .from("pages")
          .select("profile_photo_url, page_url, is_published")
          .eq("organization_type", "missionary")
          .eq("organization_id", missionaryData.id)
          .maybeSingle();
        profilePhoto = data?.profile_photo_url || null;
        otherUserPageUrl = data?.page_url || null;
        otherUserPageIsPublished = data?.is_published ?? false;
      }
    } else if (role === 5) {
      const { data: agencyData } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("contact_user_id", conversation.supporter_id)
        .single();
      
      if (agencyData) {
        const { data } = await supabaseAdmin
          .from("pages")
          .select("profile_photo_url, page_url, is_published")
          .eq("organization_type", "agency")
          .eq("organization_id", agencyData.id)
          .maybeSingle();
        profilePhoto = data?.profile_photo_url || null;
        otherUserPageUrl = data?.page_url || null;
        otherUserPageIsPublished = data?.is_published ?? false;
      }
    } else if (role === 6) {
      const { data: churchData } = await supabaseAdmin
        .from("churches")
        .select("id")
        .eq("contact_user_id", conversation.supporter_id)
        .single();
      
      if (churchData) {
        const { data } = await supabaseAdmin
          .from("pages")
          .select("profile_photo_url, page_url, is_published")
          .eq("organization_type", "church")
          .eq("organization_id", churchData.id)
          .maybeSingle();
        profilePhoto = data?.profile_photo_url || null;
        otherUserPageUrl = data?.page_url || null;
        otherUserPageIsPublished = data?.is_published ?? false;
      }
    } else if (role === 7) {
      const { data: collegeData } = await supabaseAdmin
        .from("colleges")
        .select("id")
        .eq("contact_user_id", conversation.supporter_id)
        .single();
      
      if (collegeData) {
        const { data } = await supabaseAdmin
          .from("pages")
          .select("profile_photo_url, page_url, is_published")
          .eq("organization_type", "college")
          .eq("organization_id", collegeData.id)
          .maybeSingle();
        profilePhoto = data?.profile_photo_url || null;
        otherUserPageUrl = data?.page_url || null;
        otherUserPageIsPublished = data?.is_published ?? false;
      }
    }

    const otherUserType = roleToUserType(otherUser?.role);
    const enriched = {
      ...conversation,
      missionary_name: otherUserFullName,
      missionary_first_name: otherUserFirstName,
      missionary_last_name: otherUserLastName,
      missionary_profile_photo: profilePhoto,
      missionary_page_url: otherUserPageUrl,
      missionary_page_is_published: otherUserPageIsPublished,
      page_name: null,
      is_missionary: isMissionary,
      other_user_type: otherUserType,
    };

    return { success: true, data: enriched };
  }

  // Supporter viewing missionary: use admin (RLS blocks regular client from reading missionary's page)
  const { data: page } = await (await getSupabaseServer())
    .from("pages")
    .select("name, profile_photo_url, page_url, is_published")
    .eq("organization_type", "missionary")
    .eq("organization_id", conversation.missionary_id)
    .single();

  const enriched = {
    ...conversation,
    missionary_name: page?.name || `${convData.missionaries?.first_name || ''} ${convData.missionaries?.last_name || ''}`,
    missionary_first_name: convData.missionaries?.first_name || null,
    missionary_last_name: convData.missionaries?.last_name || null,
    missionary_profile_photo: page?.profile_photo_url || null,
    missionary_page_url: page?.page_url || null,
    missionary_page_is_published: page?.is_published ?? false,
    page_name: page?.name || null,
    is_missionary: isMissionary,
    other_user_type: "missionary" as const,
  };

  return { success: true, data: enriched };
}

