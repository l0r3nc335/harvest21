"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import type { FollowerStatus } from "@/types/follow";
import { updateUserLastActivity } from "@/lib/userActivityHelpers";

export async function followMissionary(missionaryId: number, note?: string) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  const sanitizedNote = note?.trim().slice(0, 100) || null;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "You must be logged in to follow a missionary" };
    }

    // Check if request already exists using admin client to see all records including 'unfollowed'
    const { data: existing } = await supabaseAdmin
      .from("missionary_followers")
      .select("id, status")
      .eq("missionary_id", missionaryId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        return { success: false, error: "You already have a pending follow request" };
      }
      if (existing.status === 'accepted') {
        return { success: false, error: "You are already following this missionary" };
      }
      // If rejected or unfollowed, allow re-requesting by updating
      const { error: updateError } = await supabaseAdmin
        .from("missionary_followers")
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
        console.error("🔴 Error updating follow request:", updateError);
        return { success: false, error: "Failed to send follow request" };
      }

      console.log("✅ Reactivated follow request from", existing.status, "to pending");
      await createFollowNotification(missionaryId, user.id, 'new');
      // Update user activity - Join relationship: public.users.user_id = auth.users.id
      await updateUserLastActivity(user.id, true);
      return { success: true };
    }

    // Create new follow request using admin client
    const { error: insertError } = await supabaseAdmin
      .from("missionary_followers")
      .insert({
        missionary_id: missionaryId,
        user_id: user.id,
        status: 'pending',
        note: sanitizedNote,
      });

    if (insertError) {
      console.error("🔴 Error following missionary:", insertError);
      return { success: false, error: "Failed to send follow request" };
    }
    
    console.log("✅ Created new follow request");

    await createFollowNotification(missionaryId, user.id, 'new');
    
    // Update user activity - using user.id (UUID)
    await updateUserLastActivity(user.id, true);
    
    // Revalidate relevant paths to clear cache
    revalidatePath("/"); // Home page
    revalidatePath(`/missionaries/${missionaryId}`); // Public missionary page
    revalidatePath("/settings/following"); // Follower's settings page
    revalidatePath("/settings"); // Missionary's own settings (shows followers tab)
    
    return { success: true };
  } catch (error) {
    console.error("Error in followMissionary:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function cancelFollowRequest(missionaryId: number) {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "You must be logged in" };
    }

    const { error: deleteError } = await supabase
      .from("missionary_followers")
      .delete()
      .eq("missionary_id", missionaryId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (deleteError) {
      console.error("Error cancelling follow request:", deleteError);
      return { success: false, error: "Failed to cancel follow request" };
    }

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    await updateUserLastActivity(user.id, true);

    // Revalidate relevant paths to clear cache
    revalidatePath("/"); // Home page
    revalidatePath(`/missionaries/${missionaryId}`); // Public missionary page
    revalidatePath("/settings/following"); // Follower's settings page
    revalidatePath("/settings"); // Missionary's own settings (shows followers tab)

    return { success: true };
  } catch (error) {
    console.error("Error in cancelFollowRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function unfollowMissionary(missionaryId: number) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "You must be logged in" };
    }

    // Use admin client to bypass RLS and ensure the operation succeeds
    // Try to update status to 'unfollowed' first (if migration has been run)
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("missionary_followers")
      .update({ 
        status: "unfollowed",
        unfollowed_at: new Date().toISOString()
      })
      .eq("missionary_id", missionaryId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .select();

    // If update fails (migration not run), fall back to delete
    if (updateError) {
      console.log("🔴 Update failed, falling back to delete:", updateError.message);
      
      const { data: deleteData, error: deleteError } = await supabaseAdmin
        .from("missionary_followers")
        .delete()
        .eq("missionary_id", missionaryId)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .select();

      if (deleteError) {
        console.error("🔴 Delete also failed:", deleteError);
        return { success: false, error: `Failed to unfollow: ${deleteError.message}` };
      }
      
      console.log("✅ Delete succeeded, removed rows:", deleteData?.length || 0);
    } else {
      console.log("✅ Update succeeded, affected rows:", updateData?.length || 0);
    }

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    await updateUserLastActivity(user.id, true);
    
    // Revalidate relevant paths to clear cache
    revalidatePath("/"); // Home page
    revalidatePath(`/missionaries/${missionaryId}`); // Public missionary page
    revalidatePath("/settings/following"); // Follower's settings page
    revalidatePath("/settings"); // Missionary's own settings (shows followers tab)
    revalidatePath(`/admin/missionaries/${missionaryId}`); // Admin view
    
    // Also revalidate the missionary's page_url if it exists
    try {
      const { data: page } = await supabase
        .from("pages")
        .select("page_url")
        .eq("organization_type", "missionary")
        .eq("organization_id", missionaryId)
        .single();
      
      if (page?.page_url) {
        revalidatePath(`/${page.page_url}`);
      }
    } catch (e) {
      // Ignore errors - page might not exist
    }

    return { success: true };
  } catch (error) {
    console.error("Error in unfollowMissionary:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getMissionaryFollowerStatus(missionaryId: number): Promise<FollowerStatus> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return "none";
    }

    const { data, error } = await supabase
      .from("missionary_followers")
      .select("status")
      .eq("missionary_id", missionaryId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return "none";
    }

    // Treat 'unfollowed' as 'none' for UI purposes
    if (data.status === "unfollowed") {
      return "none";
    }

    return data.status as FollowerStatus;
  } catch (error) {
    console.error("Error getting follower status:", error);
    return "none";
  }
}

export async function isMissionaryFollower(missionaryId: number): Promise<boolean> {
  const status = await getMissionaryFollowerStatus(missionaryId);
  return status === "accepted";
}

/**
 * For agency users (role 5): returns "accepted" if the missionary belongs to the user's agency,
 * otherwise falls back to the normal follower status.
 */
export async function getMissionaryFollowerStatusAsAgency(missionaryId: number): Promise<FollowerStatus> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return "none";

    // Find the agency this user is the contact for
    const { data: agency } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .eq("contact_user_id", user.id)
      .maybeSingle();

    if (agency) {
      // Check if the missionary belongs to this agency
      const { data: missionary } = await supabaseAdmin
        .from("missionaries")
        .select("id")
        .eq("id", missionaryId)
        .eq("agency_id", agency.id)
        .maybeSingle();

      if (missionary) return "accepted";
    }

    // Fall back to normal follower status
    return getMissionaryFollowerStatus(missionaryId);
  } catch (error) {
    console.error("Error in getMissionaryFollowerStatusAsAgency:", error);
    return "none";
  }
}

/**
 * For church users (role 6): returns "accepted" if the missionary is affiliated with the user's church
 * (via sending_church_id, mission_field_church_id, or missionary_churches pivot),
 * otherwise falls back to the normal follower status.
 */
export async function getMissionaryFollowerStatusAsChurch(missionaryId: number): Promise<FollowerStatus> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return "none";

    // Find the church this user is the contact for
    const { data: church } = await supabaseAdmin
      .from("churches")
      .select("id")
      .eq("contact_user_id", user.id)
      .maybeSingle();

    if (church) {
      // Check direct church affiliations on the missionary record
      const { data: missionary } = await supabaseAdmin
        .from("missionaries")
        .select("id, sending_church_id, mission_field_church_id")
        .eq("id", missionaryId)
        .maybeSingle();

      if (
        missionary &&
        (missionary.sending_church_id === church.id || missionary.mission_field_church_id === church.id)
      ) {
        return "accepted";
      }

      // Check missionary_churches pivot table
      const { data: pivotRow } = await supabaseAdmin
        .from("missionary_churches")
        .select("id")
        .eq("missionary_id", missionaryId)
        .eq("church_id", church.id)
        .eq("is_active", true)
        .maybeSingle();

      if (pivotRow) return "accepted";
    }

    // Fall back to normal follower status
    return getMissionaryFollowerStatus(missionaryId);
  } catch (error) {
    console.error("Error in getMissionaryFollowerStatusAsChurch:", error);
    return "none";
  }
}

export async function getMissionaryFollowers(missionaryId: number) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // First get follower records (exclude unfollowed)
    const { data: followers, error } = await supabase
      .from("missionary_followers")
      .select("id, user_id, status, requested_at, reviewed_at, created_at, note")
      .eq("missionary_id", missionaryId)
      .neq("status", "unfollowed")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error fetching followers:", error);
      return { success: false, error: "Failed to fetch followers", data: [] };
    }

    if (!followers || followers.length === 0) {
      return { success: true, data: [] };
    }

    // Get user details separately using admin client to bypass RLS
    const userIds = followers.map((f: { user_id: string }) => f.user_id);
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("user_id, first_name, last_name, email, role")
      .in("user_id", userIds);

    if (usersError) {
      console.error("Error fetching user details:", usersError);
      return { success: false, error: "Failed to fetch user details", data: [] };
    }

    // Get supporter profiles for profile photos
    const { data: supporterProfiles } = await supabaseAdmin
      .from("supporter_profiles")
      .select("user_id, profile_photo_url")
      .in("user_id", userIds);

    interface UserData {
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
      role: number;
    }

    interface SupporterProfileData {
      user_id: string;
      profile_photo_url: string | null;
    }

    // Combine the data
    const usersMap = new Map(users?.map((u: UserData) => [u.user_id, u]) || []);
    const profilesMap = new Map(supporterProfiles?.map((p: SupporterProfileData) => [p.user_id, p]) || []);
    
    const followersWithUsers = followers.map((follower: { user_id: string; [key: string]: unknown }) => {
      const userData = usersMap.get(follower.user_id);
      const profileData = profilesMap.get(follower.user_id) as SupporterProfileData | undefined;
      
      return {
        ...follower,
        user: userData ? {
          ...userData,
          profile_photo_url: profileData?.profile_photo_url ?? null
        } : {
          first_name: "Unknown",
          last_name: "User",
          email: "",
          role: 0,
          profile_photo_url: null
        }
      };
    });

    return { success: true, data: followersWithUsers };
  } catch (error) {
    console.error("Error in getMissionaryFollowers:", error);
    return { success: false, error: "An unexpected error occurred", data: [] };
  }
}

export async function updateMissionaryFollowerStatus(
  followerId: number,
  status: "accepted" | "rejected"
) {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "You must be logged in" };
    }

    // Get the follower record
    const { data: followerRecord, error: fetchError } = await supabase
      .from("missionary_followers")
      .select("missionary_id, user_id, missionaries!inner(user_id, first_name, last_name)")
      .eq("id", followerId)
      .single();

    if (fetchError || !followerRecord) {
      return { success: false, error: "Follower not found" };
    }

    // Check authorization
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = userData?.role === 1 || userData?.role === 2;
    const isMissionaryOwner = followerRecord.missionaries?.user_id === user.id;

    if (!isAdmin && !isMissionaryOwner) {
      return { success: false, error: "Unauthorized" };
    }

    // Update status
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
      return { success: false, error: "Failed to update follower status" };
    }

    // Send notification to the follower
    await createFollowerNotification(
      followerRecord.user_id,
      followerRecord.missionary_id,
      status,
      followerRecord.missionaries?.first_name || '',
      followerRecord.missionaries?.last_name || ''
    );

    return { success: true };
  } catch (error) {
    console.error("Error in updateMissionaryFollowerStatus:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

async function createFollowNotification(missionaryId: number, userId: string, type: 'new' | 'resubmit') {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: missionary } = await supabase
      .from("missionaries")
      .select("user_id, first_name, last_name")
      .eq("id", missionaryId)
      .single();

    if (!missionary?.user_id) return;

    const { data: follower, error: followerError } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .single();

    if (followerError) {
      console.error("Error fetching follower profile:", followerError);
      return;
    }

    if (!follower?.first_name || !follower?.last_name) {
      console.warn("Follower profile incomplete for user:", userId);
      return;
    }

    const followerName = `${follower.first_name} ${follower.last_name}`;

    const { data: followerRecord } = await supabase
      .from("missionary_followers")
      .select("id")
      .eq("missionary_id", missionaryId)
      .eq("user_id", userId)
      .single();

    // Use admin client to bypass RLS when creating notification for another user
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: missionary.user_id,
        type: "follow_request",
        title: "New Follow Request",
        message: `${followerName} wants to follow you`,
        related_entity_type: "missionary_follower",
        related_entity_id: followerRecord?.id || null
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error inserting follow notification:", notificationError);
      console.error("Notification data:", {
        user_id: missionary.user_id,
        missionary_id: missionaryId,
        follower_user_id: userId,
        follower_name: followerName
      });
    } else {
      console.log("✅ Follow notification created successfully for missionary:", missionaryId);
    }
  } catch (error) {
    console.error("Error creating follow notification:", error);
  }
}

async function createFollowerNotification(
  followerId: string,
  missionaryId: number,
  status: 'accepted' | 'rejected',
  missionaryFirstName: string,
  missionaryLastName: string
) {
  const supabase = await getSupabaseServer();

  try {
    const missionaryName = `${missionaryFirstName} ${missionaryLastName}`;
    const message = status === 'accepted'
      ? `${missionaryName} accepted your follow request`
      : `${missionaryName} declined your follow request`;

    await supabase
      .from("notifications")
      .insert({
        user_id: followerId,
        type: `follow_${status}`,
        title: status === 'accepted' ? "Follow Request Accepted" : "Follow Request Declined",
        message,
        related_entity_type: "missionary",
        related_entity_id: missionaryId,
      });
  } catch (error) {
    console.error("Error creating follower notification:", error);
  }
}
