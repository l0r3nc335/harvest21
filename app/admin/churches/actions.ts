"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminCreateUser, adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import { syncChurchFollowMissionary, syncChurchUnfollowMissionary } from "@/lib/affiliationFollowSync";
import { generateUniquePageUrl } from "@/lib/pageHelpers";
import { generateActivationToken } from "@/lib/tokenHelpers";
import { sendActivationEmail } from "@/lib/emailHelpers";
import type { ChurchFollowerStatus } from "@/types/church";

// ============================================================================
// CHURCH CREATION (Original)
// ============================================================================

type CreateChurchFormData = {
  isManagedByHarvest21?: "yes" | "no";
  churchName: string;
  contactFirstName?: string;
  contactLastName?: string;
  email?: string;
  phoneNumber?: string;
};

function generateRandomPassword(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function createChurch(data: CreateChurchFormData) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    if (data.isManagedByHarvest21 === "yes") {
      const pageUrl = await generateUniquePageUrl(data.churchName, supabaseAdmin);
      const { data: newChurch, error: churchError } = await supabaseAdmin
        .from("churches")
        .insert({
          name: data.churchName,
          contact_user_id: null,
          phone_number: null,
          is_managed_by_harvest21: true,
          address: null,
          city: null,
          state: null,
          country: null,
          website: null,
        })
        .select()
        .single();
      if (churchError) {
        return { success: false, message: churchError.message || "Failed to create church" };
      }
      const { error: pageError } = await supabaseAdmin
        .from("pages")
        .insert({
          organization_type: "church",
          organization_id: newChurch.id,
          page_url: pageUrl,
          name: data.churchName,
          is_published: false,
          published_at: null,
        });
      if (pageError) {
        await supabaseAdmin.from("churches").delete().eq("id", newChurch.id);
        return { success: false, message: pageError.message || "Failed to create page" };
      }
      revalidateTag("churches", {});
      revalidatePath("/admin/churches");
      return {
        success: true,
        message: "Church created successfully. Add contact and send invite from the account tab when ready.",
        church: newChurch,
        user: null,
      };
    }

    if (!data.email || !data.contactFirstName || !data.contactLastName || !data.phoneNumber) {
      return { success: false, message: "Contact information is required when not managed by Harvest21" };
    }
    const randomPassword = generateRandomPassword(16);
    const { user: createdAuthUser, error: authError } = await adminCreateUser({
      email: data.email,
      password: randomPassword,
      emailConfirm: true,
    });

    if (authError) {
      console.error("Error creating auth user:", authError);

      if (authError.message?.includes("already registered") ||
          authError.message?.includes("already exists") ||
          authError.message?.includes("User already registered")) {
        return {
          success: false,
          message: "A user with this email already exists. Please use a different email.",
        };
      }

      return {
        success: false,
        message: authError.message || "Failed to create user account.",
      };
    }

    if (!createdAuthUser?.id) {
      return {
        success: false,
        message: "Failed to create user account - no user ID returned",
      };
    }

    const userId = createdAuthUser.id;

    // User role: 6 = CHURCH
    const churchRoleId = 6;

    // Step 3: Insert into users table
    const { data: newUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.contactFirstName,
        last_name: data.contactLastName,
        email: data.email,
        role: churchRoleId,
        status: "Active",
        last_activity: null,
      })
      .select()
      .single();

    if (userError) {
      console.error("Error creating user record:", userError);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: userError.message || "Failed to create user record",
      };
    }

    // Step 4: Generate unique page URL
    let pageUrl: string;
    try {
      pageUrl = await generateUniquePageUrl(data.churchName, supabaseAdmin);
    } catch (urlError) {
      console.error("Error generating page URL:", urlError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: urlError instanceof Error ? urlError.message : "Page URL already exists",
      };
    }

    // Step 5: Insert into churches table
    const { data: newChurch, error: churchError } = await supabaseAdmin
      .from("churches")
      .insert({
        name: data.churchName,
        contact_user_id: userId,
        phone_number: data.phoneNumber,
        address: null,
        city: null,
        state: null,
        country: null,
        website: null,
      })
      .select()
      .single();

    if (churchError) {
      console.error("Error creating church:", churchError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: churchError.message || "Failed to create church",
      };
    }

    // Step 6: Create page for church
    const { data: newPage, error: pageError } = await supabaseAdmin
      .from("pages")
      .insert({
        organization_type: "church",
        organization_id: newChurch.id,
        page_url: pageUrl,
        name: data.churchName,
        is_published: false,
        published_at: null,
      })
      .select()
      .single();

    if (pageError) {
      console.error("Error creating page:", pageError);
      await supabaseAdmin.from("churches").delete().eq("id", newChurch.id);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: pageError.message || "Failed to create page",
      };
    }

    // Step 8: Generate activation token and send email
    try {
      const activationToken = await generateActivationToken(userId, data.email);
      
      const emailResult = await sendActivationEmail(
        data.email,
        `${data.contactFirstName} ${data.contactLastName}`,
        activationToken
      );

      if (!emailResult.success) {
        console.warn("Failed to send activation email:", emailResult.error);
      }
    } catch (emailError) {
      console.error("Error sending activation email:", emailError);
    }

    // Revalidate cache tags and path
    revalidateTag("churches", {});
    revalidateTag("users", {});
    revalidatePath("/admin/churches");

    return {
      success: true,
      message: "Church created successfully! Activation email sent.",
      church: newChurch,
      user: newUser,
      page: newPage,
    };
  } catch (error) {
    console.error("Unexpected error creating church:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// ============================================================================
// CHURCH FOLLOW SYSTEM (New - Church Landing Page)
// ============================================================================

/**
 * Follow a church (CHLP-003)
 * Creates a follow request with "pending" status
 */
export async function followChurch(churchId: number, note?: string) {
  const supabase = await getSupabaseServer();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { success: false, error: "You must be logged in to follow a church" };
  }

  const sanitizedNote = note?.trim().slice(0, 100) || null;

  const { data, error } = await supabase
    .from("church_followers")
    .insert({
      church_id: churchId,
      user_id: user.id,
      status: "pending",
      note: sanitizedNote,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You already have a follow request for this church" };
    }
    console.error("Error following church:", error);
    return { success: false, error: error.message };
  }

  await createChurchFollowNotification(churchId, user.id);

  // Update user activity - Join relationship: public.users.user_id = auth.users.id
  const { updateUserLastActivity } = await import("@/lib/userActivityHelpers");
  await updateUserLastActivity(user.id, true);

  revalidatePath(`/church/${churchId}`);
  return { success: true, data };
}

async function createChurchFollowNotification(churchId: number, userId: string) {
  const supabase = await getSupabaseServer();

  try {
    const { data: church } = await supabase
      .from("churches")
      .select("contact_user_id, name")
      .eq("id", churchId)
      .single();

    // Church contact user receives the notification (same as missionary user_id)
    const churchContactUserId = church?.contact_user_id;
    if (!churchContactUserId) return;

    const { data: follower } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .single();

    if (!follower?.first_name || !follower?.last_name) return;

    const followerName = `${follower.first_name} ${follower.last_name}`;
    const churchName = church.name || "your church";

    const { data: followerRecord } = await supabase
      .from("church_followers")
      .select("id")
      .eq("church_id", churchId)
      .eq("user_id", userId)
      .single();

    const { createNotification } = await import("@/lib/notificationRpc");
    const { id: notificationId, error: notificationError } = await createNotification({
      targetUserId: churchContactUserId,
      type: "follow_request",
      title: "New Follow Request",
      message: `${followerName} wants to follow ${churchName}`,
      relatedEntityType: "church_follower",
      relatedEntityId: followerRecord?.id ?? null,
    });

    if (notificationError) {
      console.error("Error inserting church follow notification:", notificationError);
    } else if (notificationId) {
      console.log("Church follow notification created successfully for church:", churchId);
    }
  } catch (error) {
    console.error("Error creating church follow notification:", error);
  }
}

/**
 * Unfollow a church (CHLP-003)
 * Deletes the follow relationship
 */
export async function unfollowChurch(churchId: number) {
  const supabase = await getSupabaseServer();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { success: false, error: "You must be logged in" };
  }

  // Try to update status to 'unfollowed' first (if migration has been run)
  const { data: updateData, error: updateError } = await supabase
    .from("church_followers")
    .update({ 
      status: "unfollowed",
      unfollowed_at: new Date().toISOString()
    })
    .eq("church_id", churchId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .select("id");

  const didUpdate = !updateError && (updateData?.length ?? 0) > 0;

  // If update fails or no rows were updated (e.g. due to RLS), fall back to delete
  if (updateError || !didUpdate) {
    if (updateError) {
      console.log("Update failed, falling back to delete:", updateError.message);
    }

    const { error: deleteError } = await supabase
      .from("church_followers")
      .delete()
      .eq("church_id", churchId)
      .eq("user_id", user.id)
      .eq("status", "accepted");

    if (deleteError) {
      console.error("Error deleting church follower record:", deleteError);
      return { success: false, error: deleteError.message };
    }
  }

  // Update user activity - Join relationship: public.users.user_id = auth.users.id
  const { updateUserLastActivity } = await import("@/lib/userActivityHelpers");
  await updateUserLastActivity(user.id, true);

  revalidatePath(`/church/${churchId}`);
  revalidatePath("/settings/following");
  return { success: true };
}

/**
 * Get church follower status for current user
 */
export async function getChurchFollowerStatus(churchId: number): Promise<ChurchFollowerStatus> {
  const supabase = await getSupabaseServer();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return "none";
  }

  const { data, error } = await supabase
    .from("church_followers")
    .select("status")
    .eq("church_id", churchId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return "none";
  }

  // Treat 'unfollowed' as 'none' for UI purposes
  if (data.status === "unfollowed") {
    return "none";
  }

  return data.status as ChurchFollowerStatus;
}

/**
 * Check if user is an accepted follower
 * Used for access control to "Our Missionaries" tab (CHLP-009)
 */
export async function isChurchFollower(churchId: number): Promise<boolean> {
  const status = await getChurchFollowerStatus(churchId);
  return status === "accepted";
}

/**
 * Get church followers (for admin/church owner)
 */
export async function getChurchFollowers(churchId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Step 1: Fetch follower records (exclude unfollowed)
    const { data: followers, error } = await supabaseAdmin
      .from("church_followers")
      .select("id, user_id, status, created_at, reviewed_at, reviewed_by, note")
      .eq("church_id", churchId)
      .neq("status", "unfollowed")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching church followers:", error);
      return { success: false, error: error.message, data: [] };
    }

    if (!followers || followers.length === 0) {
      return { success: true, data: [] };
    }

    // Step 2: Get user details separately
    const userIds = followers.map((f: { user_id: string }) => f.user_id);
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("user_id, first_name, last_name, email, role")
      .in("user_id", userIds);

    if (usersError) {
      console.error("Error fetching user details:", usersError);
      return { success: false, error: usersError.message, data: [] };
    }

    // Step 3: Combine the data
    const usersMap = new Map(users?.map((u: { user_id: string; first_name: string; last_name: string; email: string }) => [u.user_id, u]) || []);
    const followersWithUsers = followers.map((follower: { id: number; user_id: string; status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null }) => ({
      ...follower,
      user: usersMap.get(follower.user_id) || {
        user_id: follower.user_id,
        first_name: "Unknown",
        last_name: "User",
        email: "N/A",
      },
    }));

    return { success: true, data: followersWithUsers };
  } catch (error) {
    console.error("Unexpected error fetching church followers:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      data: [] 
    };
  }
}

/**
 * Update follower status (approve/reject/block/remove)
 * For church owners and admins.
 * Notifies the user who sent the follow request when accepted, rejected, or removed (any user type).
 */
export async function updateFollowerStatus(
  followerId: number,
  status: "accepted" | "rejected" | "blocked" | "unfollowed"
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  const { data: { user } } = await supabaseAdmin.auth.getUser();
  
  if (!user) {
    return { success: false, error: "You must be logged in" };
  }

  const updatePayload: Record<string, unknown> = {
    status,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (status === "unfollowed") {
    updatePayload.unfollowed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("church_followers")
    .update(updatePayload)
    .eq("id", followerId)
    .select()
    .single();

  if (error) {
    console.error("Error updating follower status:", error);
    return { success: false, error: error.message };
  }

  const notifyStatus = status === "blocked" || status === "unfollowed" ? "rejected" : status;
  if (notifyStatus === "accepted" || notifyStatus === "rejected") {
    const { data: church } = await supabaseAdmin
      .from("churches")
      .select("name")
      .eq("id", data.church_id)
      .single();
    const { createFollowerNotificationForChurch } = await import("@/lib/notificationHelpers");
    await createFollowerNotificationForChurch(
      data.user_id,
      data.church_id,
      notifyStatus,
      church?.name ?? "Church"
    );
  }

  revalidatePath("/admin/churches");
  revalidatePath(`/admin/churches/${data.church_id}`);
  revalidatePath("/settings/following");
  return { success: true, data };
}

/**
 * Get church missionaries (for "Our Missionaries" tab - CHLP-011)
 */
export async function getChurchMissionaries(churchId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  const { data, error } = await supabaseAdmin
    .from("missionary_churches")
    .select(`
      *,
      missionary:missionaries (
        id,
        first_name,
        last_name,
        destination_country,
        mission_status,
        open_to_visits,
        page:pages!pages_organization_id_fkey (
          page_url,
          name,
          profile_photo_url,
          is_published
        )
      )
    `)
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching church missionaries:", error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data };
}

/**
 * Add missionary to church
 */
export async function addChurchMissionary(
  churchId: number,
  missionaryId: number,
  relationshipType: "sending" | "supporting" | "partner" = "supporting"
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  const { data, error } = await supabaseAdmin
    .from("missionary_churches")
    .insert({
      missionary_id: missionaryId,
      church_id: churchId,
      relationship_type: relationshipType,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This missionary is already linked to this church" };
    }
    console.error("Error adding church missionary:", error);
    return { success: false, error: error.message };
  }

  await syncChurchFollowMissionary(missionaryId, churchId);

  revalidatePath("/admin/churches");
  return { success: true, data };
}

/**
 * Remove missionary from church
 */
export async function removeChurchMissionary(churchMissionaryId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  const { data: row, error: selectError } = await supabaseAdmin
    .from("missionary_churches")
    .select("church_id, missionary_id")
    .eq("id", churchMissionaryId)
    .maybeSingle();

  if (selectError) {
    console.error("Error fetching church missionary:", selectError);
    return { success: false, error: selectError.message };
  }

  const { error } = await supabaseAdmin
    .from("missionary_churches")
    .delete()
    .eq("id", churchMissionaryId);

  if (error) {
    console.error("Error removing church missionary:", error);
    return { success: false, error: error.message };
  }

  if (row?.church_id != null && row?.missionary_id != null) {
    await syncChurchUnfollowMissionary(row.missionary_id, row.church_id);
  }

  revalidatePath("/admin/churches");
  return { success: true };
}

// ============================================================================
// CHURCH MANAGEMENT (Admin Operations)
// ============================================================================

/**
 * Delete a church and all associated data
 */
export async function deleteChurch(churchId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const id = parseInt(churchId);
    if (isNaN(id)) {
      return { success: false, message: "Invalid church ID" };
    }

    // Fetch church details for cleanup
    const { data: church } = await supabaseAdmin
      .from("churches")
      .select("id, contact_user_id")
      .eq("id", id)
      .single();

    if (!church) {
      return { success: false, message: "Church not found" };
    }

    // Delete the church (cascading will handle related data)
    const { error: deleteError } = await supabaseAdmin
      .from("churches")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting church:", deleteError);
      return { success: false, message: deleteError.message };
    }

    if (church.contact_user_id) {
      await adminDeleteUser(church.contact_user_id);
      await supabaseAdmin
        .from("users")
        .delete()
        .eq("user_id", church.contact_user_id);
    }

    revalidatePath("/admin/churches");
    return { success: true, message: "Church deleted successfully" };
  } catch (error) {
    console.error("Error deleting church:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete church",
    };
  }
}

/**
 * Toggle church status (Active/Inactive)
 */
export async function toggleChurchStatus(churchId: string, disable: boolean) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const id = parseInt(churchId);
    if (isNaN(id)) {
      return { success: false, message: "Invalid church ID" };
    }

    // Get church to find contact user
    const { data: church } = await supabaseAdmin
      .from("churches")
      .select("contact_user_id")
      .eq("id", id)
      .single();

    if (!church || !church.contact_user_id) {
      return { success: false, message: "Church or contact user not found" };
    }

    // Update user status
    const newStatus = disable ? "Inactive" : "Active";
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: newStatus })
      .eq("user_id", church.contact_user_id);

    if (updateError) {
      console.error("Error updating church status:", updateError);
      return { success: false, message: updateError.message };
    }

    revalidatePath("/admin/churches");
    return {
      success: true,
      message: `Church ${disable ? "disabled" : "enabled"} successfully`,
    };
  } catch (error) {
    console.error("Error toggling church status:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update church status",
    };
  }
}

export async function sendInviteToManagedChurch(
  churchId: number,
  data: { email: string; firstName: string; lastName: string; contactPersonPhoneNumber?: string }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email?.trim() || !emailRegex.test(data.email)) {
    return { success: false, message: "Valid email is required" };
  }
  try {
    const { data: church, error: mErr } = await supabaseAdmin
      .from("churches")
      .select("id, contact_user_id")
      .eq("id", churchId)
      .single();
    if (mErr || !church || church.contact_user_id) {
      return { success: false, message: "Church not found or already has a contact" };
    }
    const randomPassword = generateRandomPassword(16);
    const { user: invitedAuthUser, error: authError } = await adminCreateUser({
      email: data.email.trim(),
      password: randomPassword,
      emailConfirm: true,
    });
    if (authError) {
      if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
        return { success: false, message: "A user with this email already exists." };
      }
      return { success: false, message: authError.message || "Failed to create user" };
    }
    const userId = invitedAuthUser?.id;
    if (!userId) return { success: false, message: "Failed to create user" };
    const churchRoleId = 6;
    const { error: userErr } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email: data.email.trim(),
        role: churchRoleId,
        status: "Pending Invite",
        last_activity: null,
      });
    if (userErr) {
      await adminDeleteUser(userId);
      return { success: false, message: userErr.message || "Failed to create user record" };
    }
    const updatePayload: Record<string, unknown> = {
      contact_user_id: userId,
      contact_person_phone_number: data.contactPersonPhoneNumber?.trim() || null,
    };
    const { error: updateErr } = await supabaseAdmin
      .from("churches")
      .update(updatePayload)
      .eq("id", churchId);
    if (updateErr) {
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return { success: false, message: updateErr.message || "Failed to link church" };
    }
    const activationToken = await generateActivationToken(userId, data.email.trim());
    const emailResult = await sendActivationEmail(
      data.email.trim(),
      `${data.firstName} ${data.lastName}`.trim(),
      activationToken
    );
    if (!emailResult.success) {
      return { success: false, message: emailResult.error || "Failed to send activation email" };
    }
    revalidateTag("churches", {});
    revalidatePath("/admin/churches");
    revalidatePath(`/admin/churches/${churchId}`);
    return { success: true, message: `Activation email sent to ${data.email.trim()}` };
  } catch (error) {
    console.error("sendInviteToManagedChurch error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function resendActivationEmail(churchId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch church details
    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("id, contact_user_id")
      .eq("id", parseInt(churchId))
      .single();

    if (churchError || !church || !church.contact_user_id) {
      return {
        success: false,
        message: "Church not found or contact user not set",
      };
    }

    // Fetch contact user details separately
    const { data: contactUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_id, first_name, last_name, email")
      .eq("user_id", church.contact_user_id)
      .single();

    if (userError || !contactUser || !contactUser.email) {
      return {
        success: false,
        message: "Contact user email not found",
      };
    }

    const activationToken = await generateActivationToken(
      contactUser.user_id,
      contactUser.email
    );

    const emailResult = await sendActivationEmail(
      contactUser.email,
      `${contactUser.first_name || ""} ${contactUser.last_name || ""}`.trim() || "Church Contact",
      activationToken
    );

    if (!emailResult.success) {
      console.error("Failed to send activation email:", emailResult.error);
      return {
        success: false,
        message: emailResult.error || "Failed to send activation email",
      };
    }

    return {
      success: true,
      message: `Activation email sent successfully to ${contactUser.email}`,
    };
  } catch (error) {
    console.error("Error resending activation email:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}