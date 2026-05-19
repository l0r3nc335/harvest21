"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { revalidateTag } from "next/cache";

/**
 * Update user's last_activity timestamp in the users table
 * This function joins auth.users and public.users using: public.users.user_id = auth.users.id
 * @param authUserId - The UUID from auth.users.id (this is the user_id in public.users)
 * @param forceUpdate - If true, updates regardless of throttling
 */
export async function updateUserLastActivity(
  authUserId: string,
  forceUpdate: boolean = false
): Promise<void> {
  if (!authUserId || authUserId.trim() === "") {
    console.warn("updateUserLastActivity called with empty authUserId");
    return;
  }

  try {
    const supabaseAdmin = await getSupabaseServer();

    // If not forcing update, check if we should throttle (update only if last update was > 5 minutes ago)
    if (!forceUpdate) {
      const { data: userData, error: selectError } = await supabaseAdmin
        .from("users")
        .select("last_activity")
        .eq("user_id", authUserId)
        .single();

      if (selectError) {
        console.error("Error fetching user for activity update:", selectError);
        // Continue to try update anyway
      } else if (userData?.last_activity) {
        const lastUpdate = new Date(userData.last_activity);
        const now = new Date();
        const minutesSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

        // Only update if last update was more than 5 minutes ago
        if (minutesSinceLastUpdate < 5) {
          return;
        }
      }
    }

    // Update last_activity to current timestamp in the public.users table
    // Join relationship: public.users.user_id = auth.users.id (UUID)
    const { error, data } = await supabaseAdmin
      .from("users")
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq("user_id", authUserId)
      .select("id");

    if (error) {
      console.error("Error updating user last_activity in users table:", {
        error,
        authUserId,
        errorCode: error.code,
        errorMessage: error.message,
        table: "public.users",
        field: "last_activity",
        relationship: "public.users.user_id = auth.users.id",
      });
    } else if (!data || data.length === 0) {
      console.warn("No user found in users table to update last_activity:", {
        authUserId,
        table: "public.users",
        field: "user_id",
        relationship: "public.users.user_id = auth.users.id",
      });
    } else {
      console.log("Successfully updated last_activity for user:", {
        authUserId,
        updatedRows: data.length,
        timestamp: new Date().toISOString(),
        relationship: "public.users.user_id = auth.users.id",
      });
      
      // Invalidate the users cache so the /admin/users page shows updated last_activity
      revalidateTag("users", {});
    }
  } catch (error) {
    // Log error but don't break the user experience
    console.error("Error in updateUserLastActivity:", {
      error,
      authUserId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
