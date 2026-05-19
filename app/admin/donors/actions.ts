"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Delete a donor and all related data
 */
export async function deleteDonor(donorId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Step 1: Get the donor record to find user_id
    const { data: donor, error: donorError } = await supabaseAdmin
      .from("donors")
      .select("user_id")
      .eq("id", parseInt(donorId))
      .single();

    if (donorError || !donor) {
      return {
        success: false,
        message: "Donor not found",
      };
    }

    const userId = donor.user_id;

    // Step 2: Delete from donors table
    const { error: deleteError } = await supabaseAdmin
      .from("donors")
      .delete()
      .eq("id", parseInt(donorId));

    if (deleteError) {
      console.error("Error deleting donor:", deleteError);
      return {
        success: false,
        message: deleteError.message || "Failed to delete donor",
      };
    }

    // Step 3: Delete from users table if user_id exists
    if (userId) {
      const { error: userDeleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("user_id", userId);

      if (userDeleteError) {
        console.error("Error deleting user:", userDeleteError);
        // Continue even if user delete fails
      }

      try {
        await adminDeleteUser(userId);
      } catch (authError) {
        console.error("Error deleting auth user:", authError);
      }
    }

    // Revalidate cache tags and paths
    revalidateTag("donors", {});
    revalidateTag("users", {});
    revalidatePath("/admin/donors");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "Donor deleted successfully",
    };
  } catch (error) {
    console.error("Unexpected error deleting donor:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

/**
 * Disable/Enable a donor
 */
export async function toggleDonorStatus(donorId: string, isDisabled: boolean) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: donor, error: donorError } = await supabaseAdmin
      .from("donors")
      .select("user_id, is_active")
      .eq("id", parseInt(donorId))
      .single();

    if (donorError || !donor) {
      return {
        success: false,
        message: "Donor not found",
      };
    }

    // Update donor is_active status
    const { error: updateError } = await supabaseAdmin
      .from("donors")
      .update({ is_active: !isDisabled })
      .eq("id", parseInt(donorId));

    if (updateError) {
      return {
        success: false,
        message: updateError.message || "Failed to update donor status",
      };
    }

    // Also update user status if user_id exists
    if (donor.user_id) {
      await supabaseAdmin
        .from("users")
        .update({ status: isDisabled ? "Inactive" : "Active" })
        .eq("user_id", donor.user_id);
    }

    revalidateTag("donors", {});
    revalidateTag("users", {});
    revalidatePath("/admin/donors");

    return {
      success: true,
      message: `Donor ${isDisabled ? "disabled" : "enabled"} successfully`,
    };
  } catch (error) {
    console.error("Unexpected error updating donor status:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

