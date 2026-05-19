"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import type { MissionaryFollows, MissionaryFollowItem, ActionResult } from "@/types/missionary-following";

export async function getMissionaryFollows(missionaryId?: number): Promise<ActionResult<MissionaryFollows>> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    let targetMissionaryId = missionaryId;

    if (!targetMissionaryId) {
      const { data: missionary } = await supabase
        .from("missionaries")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (!missionary) {
        return { success: false, error: "Missionary profile not found" };
      }
      targetMissionaryId = missionary.id;
    }

    const { data: follows, error: followsError } = await supabase
      .from("missionary_missionary_followers")
      .select("status, requested_at, followed_missionary_id, reviewed_at, id")
      .eq("follower_missionary_id", targetMissionaryId)
      .neq("status", "unfollowed");

    if (followsError) {
      console.error("Error fetching missionary follows:", followsError);
      return { success: false, error: `Failed to fetch follows: ${followsError.message}` };
    }

    const missionaryIds = follows?.map((f: any) => f.followed_missionary_id) || [];
    
    const { data: missionaries, error: missionariesError } = missionaryIds.length > 0 
      ? await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name")
          .in("id", missionaryIds)
      : { data: [], error: null };

    if (missionariesError) {
      console.error("Error fetching missionaries:", missionariesError);
    }

    const { data: pages } = missionaryIds.length > 0
      ? await supabase
          .from("pages")
          .select("organization_id, page_url, profile_photo_url, name")
          .eq("organization_type", "missionary")
          .in("organization_id", missionaryIds)
      : { data: [] };

    const items: MissionaryFollowItem[] = follows?.map((f: any) => {
      const missionary = missionaries?.find((m: any) => m.id === f.followed_missionary_id);
      const page = pages?.find((p: any) => p.organization_id === f.followed_missionary_id);
      return {
        id: f.id,
        followed_missionary_id: f.followed_missionary_id,
        missionary_name: missionary ? `${missionary.first_name} ${missionary.last_name}` : 'Unknown Missionary',
        status: f.status,
        requested_at: f.requested_at,
        reviewed_at: f.reviewed_at,
        page_url: page?.page_url || null,
        profile_photo_url: page?.profile_photo_url || null,
      };
    }) || [];

    const following = items.filter((f) => f.status === 'accepted').sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );
    const pending = items.filter((f) => f.status === 'pending').sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );
    const rejected = items.filter((f) => f.status === 'rejected').sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );

    return {
      success: true,
      data: {
        following,
        pending,
        rejected
      }
    };
  } catch (error) {
    console.error("Error in getMissionaryFollows:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function followMissionaryAsMissionary(
  followedMissionaryId: number,
  note?: string
): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();
  const sanitizedNote = note?.trim().slice(0, 100) || null;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: followerMissionary } = await supabase
      .from("missionaries")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!followerMissionary) {
      return { success: false, error: "Missionary profile not found" };
    }

    if (followerMissionary.id === followedMissionaryId) {
      return { success: false, error: "You cannot follow yourself" };
    }

    const { data: existing } = await supabaseAdmin
      .from("missionary_missionary_followers")
      .select("id, status")
      .eq("follower_missionary_id", followerMissionary.id)
      .eq("followed_missionary_id", followedMissionaryId)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        return { success: false, error: "You already have a pending follow request" };
      }
      if (existing.status === 'accepted') {
        return { success: false, error: "You are already following this missionary" };
      }
      
      const { error: updateError } = await supabaseAdmin
        .from("missionary_missionary_followers")
        .update({
          status: 'pending',
          requested_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
          unfollowed_at: null,
          note: sanitizedNote,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating follow request:", updateError);
        return { success: false, error: "Failed to send follow request" };
      }

      await createMissionaryFollowNotification(followedMissionaryId, followerMissionary.id, 'new');
      revalidatePath("/settings");
      return { success: true };
    }

    const { error: insertError } = await supabaseAdmin
      .from("missionary_missionary_followers")
      .insert({
        follower_missionary_id: followerMissionary.id,
        followed_missionary_id: followedMissionaryId,
        status: 'pending',
        note: sanitizedNote,
      });

    if (insertError) {
      console.error("Error following missionary:", insertError);
      return { success: false, error: "Failed to send follow request" };
    }

    await createMissionaryFollowNotification(followedMissionaryId, followerMissionary.id, 'new');
    
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error in followMissionaryAsMissionary:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function unfollowMissionaryAsMissionary(
  followedMissionaryId: number
): Promise<ActionResult> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: followerMissionary } = await supabase
      .from("missionaries")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!followerMissionary) {
      return { success: false, error: "Missionary profile not found" };
    }

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("missionary_missionary_followers")
      .update({ 
        status: "unfollowed",
        unfollowed_at: new Date().toISOString()
      })
      .eq("follower_missionary_id", followerMissionary.id)
      .eq("followed_missionary_id", followedMissionaryId)
      .eq("status", "accepted")
      .select();

    if (updateError) {
      console.log("Update failed, falling back to delete:", updateError.message);
      
      const { data: deleteData, error: deleteError } = await supabaseAdmin
        .from("missionary_missionary_followers")
        .delete()
        .eq("follower_missionary_id", followerMissionary.id)
        .eq("followed_missionary_id", followedMissionaryId)
        .eq("status", "accepted")
        .select();

      if (deleteError) {
        console.error("Delete also failed:", deleteError);
        return { success: false, error: `Failed to unfollow: ${deleteError.message}` };
      }
    }

    revalidatePath("/settings");
    return { success: true, message: "Unfollowed successfully" };
  } catch (error) {
    console.error("Error in unfollowMissionaryAsMissionary:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function cancelMissionaryFollowRequest(
  followedMissionaryId: number
): Promise<ActionResult> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: followerMissionary } = await supabase
      .from("missionaries")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!followerMissionary) {
      return { success: false, error: "Missionary profile not found" };
    }

    const { error } = await supabase
      .from("missionary_missionary_followers")
      .delete()
      .eq("follower_missionary_id", followerMissionary.id)
      .eq("followed_missionary_id", followedMissionaryId)
      .eq("status", "pending");

    if (error) {
      console.error("Error cancelling follow request:", error);
      return { success: false, error: "Failed to cancel follow request" };
    }

    revalidatePath("/settings");
    return { success: true, message: "Request cancelled" };
  } catch (error) {
    console.error("Error in cancelMissionaryFollowRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getMissionaryFollowersByMissionary(missionaryId: number) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: followers, error } = await supabase
      .from("missionary_missionary_followers")
      .select("id, follower_missionary_id, status, requested_at, reviewed_at, created_at, note")
      .eq("followed_missionary_id", missionaryId)
      .neq("status", "unfollowed")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error fetching missionary followers:", error);
      return { success: false, error: "Failed to fetch followers", data: [] };
    }

    if (!followers || followers.length === 0) {
      return { success: true, data: [] };
    }

    const followerIds = followers.map((f: any) => f.follower_missionary_id);
    const { data: missionaries, error: missionariesError } = await supabaseAdmin
      .from("missionaries")
      .select("id, first_name, last_name, email, user_id")
      .in("id", followerIds);

    if (missionariesError) {
      console.error("Error fetching missionary details:", missionariesError);
      return { success: false, error: "Failed to fetch missionary details", data: [] };
    }

    // Get pages for profile photos
    const { data: pages } = await supabaseAdmin
      .from("pages")
      .select("organization_id, profile_photo_url")
      .eq("organization_type", "missionary")
      .in("organization_id", followerIds);

    interface PageRow {
      organization_id: number;
      profile_photo_url: string | null;
    }
    const missionariesMap = new Map(missionaries?.map((m: any) => [m.id, m]) || []);
    const pagesMap = new Map(pages?.map((p: PageRow) => [p.organization_id, p]) || []);
    
    const followersWithMissionaries = followers.map((follower: any) => {
      const missionaryData = missionariesMap.get(follower.follower_missionary_id);
      const pageData = pagesMap.get(follower.follower_missionary_id) as PageRow | undefined;
      
      return {
        ...follower,
        missionary: missionaryData ? {
          ...missionaryData,
          profile_photo_url: pageData?.profile_photo_url ?? null
        } : {
          id: follower.follower_missionary_id,
          first_name: "Unknown",
          last_name: "Missionary",
          email: "",
          user_id: null,
          profile_photo_url: null
        }
      };
    });

    return { success: true, data: followersWithMissionaries };
  } catch (error) {
    console.error("Error in getMissionaryFollowersByMissionary:", error);
    return { success: false, error: "An unexpected error occurred", data: [] };
  }
}

export async function updateMissionaryFollowerStatusByMissionary(
  followerId: number,
  status: "accepted" | "rejected"
) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: followerRecord, error: fetchError } = await supabase
      .from("missionary_missionary_followers")
      .select(`
        follower_missionary_id,
        followed_missionary_id
      `)
      .eq("id", followerId)
      .single();

    if (fetchError || !followerRecord) {
      return { success: false, error: "Follower record not found" };
    }

    const { data: followedMissionary } = await supabase
      .from("missionaries")
      .select("user_id, first_name, last_name")
      .eq("id", followerRecord.followed_missionary_id)
      .single();

    if (!followedMissionary) {
      return { success: false, error: "Missionary not found" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = userData?.role === 1 || userData?.role === 2;
    const isMissionaryOwner = followedMissionary.user_id === user.id;

    if (!isAdmin && !isMissionaryOwner) {
      return { success: false, error: "Unauthorized" };
    }

    const { error: updateError } = await supabaseAdmin
      .from("missionary_missionary_followers")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id
      })
      .eq("id", followerId);

    if (updateError) {
      console.error("Error updating follower status:", updateError);
      return { success: false, error: "Failed to update follower status" };
    }

    await createMissionaryFollowerNotification(
      followerRecord.follower_missionary_id,
      followerRecord.followed_missionary_id,
      status,
      followedMissionary.first_name,
      followedMissionary.last_name
    );

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error in updateMissionaryFollowerStatusByMissionary:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

async function createMissionaryFollowNotification(
  followedMissionaryId: number,
  followerMissionaryId: number,
  type: 'new' | 'resubmit'
) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: followedMissionary } = await supabase
      .from("missionaries")
      .select("user_id, first_name, last_name")
      .eq("id", followedMissionaryId)
      .single();

    if (!followedMissionary?.user_id) return;

    const { data: followerMissionary } = await supabase
      .from("missionaries")
      .select("first_name, last_name")
      .eq("id", followerMissionaryId)
      .single();

    if (!followerMissionary) return;

    const followerName = `${followerMissionary.first_name} ${followerMissionary.last_name}`;

    const { data: followerRecord } = await supabase
      .from("missionary_missionary_followers")
      .select("id")
      .eq("follower_missionary_id", followerMissionaryId)
      .eq("followed_missionary_id", followedMissionaryId)
      .single();

    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: followedMissionary.user_id,
        type: "missionary_follow_request",
        title: "New Follow Request from Missionary",
        message: `${followerName} wants to follow you`,
        related_entity_type: "missionary_missionary_follower",
        related_entity_id: followerRecord?.id || null
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error inserting missionary follow notification:", notificationError);
    } else {
      console.log("Missionary follow notification created successfully");
    }
  } catch (error) {
    console.error("Error creating missionary follow notification:", error);
  }
}

async function createMissionaryFollowerNotification(
  followerMissionaryId: number,
  followedMissionaryId: number,
  status: 'accepted' | 'rejected',
  followedFirstName: string,
  followedLastName: string
) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: followerMissionary } = await supabase
      .from("missionaries")
      .select("user_id")
      .eq("id", followerMissionaryId)
      .single();

    if (!followerMissionary?.user_id) return;

    const missionaryName = `${followedFirstName} ${followedLastName}`;
    const message = status === 'accepted'
      ? `${missionaryName} accepted your follow request`
      : `${missionaryName} declined your follow request`;

    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: followerMissionary.user_id,
        type: `missionary_follow_${status}`,
        title: status === 'accepted' ? "Follow Request Accepted" : "Follow Request Declined",
        message,
        related_entity_type: "missionary",
        related_entity_id: followedMissionaryId,
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error creating missionary follower notification:", notificationError);
    }
  } catch (error) {
    console.error("Error creating missionary follower notification:", error);
  }
}

export async function getMissionaryFollowerStatusAsMissionary(
  followedMissionaryId: number
): Promise<"none" | "pending" | "accepted" | "rejected"> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return "none";
    }

    const { data: followerMissionary } = await supabase
      .from("missionaries")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!followerMissionary) {
      return "none";
    }

    const { data, error } = await supabase
      .from("missionary_missionary_followers")
      .select("status")
      .eq("follower_missionary_id", followerMissionary.id)
      .eq("followed_missionary_id", followedMissionaryId)
      .single();

    if (error || !data) {
      return "none";
    }

    if (data.status === "unfollowed") {
      return "none";
    }

    return data.status as "pending" | "accepted" | "rejected";
  } catch (error) {
    console.error("Error getting missionary follower status:", error);
    return "none";
  }
}
