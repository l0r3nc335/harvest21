"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Delete a user and all related data
 */
export async function deleteUser(userId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Step 1: Get the user record to find user_id (uuid) and role
    // userId is the numeric id from users table (as string)
    let authUserId: string | null = null;
    
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_id, role")
      .eq("id", parseInt(userId))
      .single();

    if (userError || !user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    authUserId = user.user_id;
    const userRole = user.role;

    if (!authUserId) {
      return {
        success: false,
        message: "User ID not found - cannot delete user without auth user ID",
      };
    }

    // Step 2: Check and delete related records based on user role
    // User Roles:
    // 1: ADMIN
    // 2: SUPER ADMIN
    // 3: MISSIONARY
    // 4: SUPPORTER
    // 5: MISSION AGENCY
    // 6: CHURCH
    // 7: COLLEGE ADMIN

    if (userRole === 3) {
      // MISSIONARY - delete from missionaries table
      await supabaseAdmin
        .from("missionaries")
        .delete()
        .eq("user_id", authUserId);
    } else if (userRole === 4) {
      // SUPPORTER - delete from donors table
      await supabaseAdmin
        .from("donors")
        .delete()
        .eq("user_id", authUserId);
    } else if (userRole === 5) {
      // MISSION AGENCY - delete from agencies table
      await supabaseAdmin
        .from("agencies")
        .delete()
        .eq("contact_user_id", authUserId);
    } else if (userRole === 6) {
      // CHURCH - delete from churches table
      await supabaseAdmin
        .from("churches")
        .delete()
        .eq("contact_user_id", authUserId);
    } else if (userRole === 7) {
      // COLLEGE ADMIN - delete from colleges table
      await supabaseAdmin
        .from("colleges")
        .delete()
        .eq("contact_user_id", authUserId);
    }
    // Roles 1 (ADMIN) and 2 (SUPER ADMIN) don't have related tables to delete

    // Step 3: Delete from users table (using numeric id)
    const { error: deleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", parseInt(userId));

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return {
        success: false,
        message: deleteError.message || "Failed to delete user",
      };
    }

    try {
      await adminDeleteUser(authUserId);
    } catch (authError) {
      console.error("Error deleting auth user:", authError);
    }

    // Revalidate cache tags and paths based on role
    revalidateTag("users", {});
    revalidatePath("/admin/users");
    
    if (userRole === 3) {
      revalidateTag("missionaries", {});
      revalidatePath("/admin/missionaries");
    } else if (userRole === 4) {
      revalidateTag("donors", {});
      revalidatePath("/admin/donors");
    } else if (userRole === 5) {
      revalidateTag("agencies", {});
      revalidatePath("/admin/agencies");
    } else if (userRole === 6) {
      revalidateTag("churches", {});
      revalidatePath("/admin/churches");
    } else if (userRole === 7) {
      revalidateTag("colleges", {});
      revalidatePath("/admin/colleges");
    }

    return {
      success: true,
      message: "User deleted successfully",
    };
  } catch (error) {
    console.error("Unexpected error deleting user:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

/**
 * Disable/Enable a user
 */
export async function toggleUserStatus(userId: string, isDisabled: boolean) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // userId is the numeric id from users table (as string)
    // Find user by numeric id and update using user_id (UUID)
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("id", parseInt(userId))
      .single();

    if (userError || !user || !user.user_id) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: isDisabled ? "Inactive" : "Active" })
      .eq("user_id", user.user_id);

    if (updateError) {
      return {
        success: false,
        message: updateError.message || "Failed to update user status",
      };
    }

    revalidateTag("users", {});
    revalidatePath("/admin/users");

    return {
      success: true,
      message: `User ${isDisabled ? "disabled" : "enabled"} successfully`,
    };
  } catch (error) {
    console.error("Unexpected error updating user status:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

