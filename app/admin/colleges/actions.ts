"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminCreateUser, adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createPageForEntity, generateUniquePageUrl } from "@/lib/pageHelpers";
import { generateActivationToken } from "@/lib/tokenHelpers";
import { sendActivationEmail } from "@/lib/emailHelpers";

export type CreateCollegeFormData = {
  collegeName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phoneNumber: string;
};

/**
 * Generate a random secure password
 */
function generateRandomPassword(length: number = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

export async function createCollege(data: CreateCollegeFormData) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
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
        message: authError.message || "Failed to create user account. Please check Supabase configuration and logs.",
      };
    }

    if (!createdAuthUser?.id) {
      return {
        success: false,
        message: "Failed to create user account - no user ID returned",
      };
    }

    const userId = createdAuthUser.id;

    // Step 3: Use role ID 7 (COLLEGE ADMIN) for college contacts
    // User Roles:
    // 1: ADMIN
    // 2: SUPER ADMIN
    // 3: MISSIONARY
    // 4: SUPPORTER
    // 5: MISSION AGENCY
    // 6: CHURCH
    // 7: COLLEGE ADMIN
    const collegeAdminRoleId = 7;

    // Step 4: Insert into users table using admin client to bypass RLS
    const { data: newUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.contactFirstName,
        last_name: data.contactLastName,
        email: data.email,
        role: collegeAdminRoleId,
        status: "Active", // Set to Active by default
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

    // Step 5: Generate and validate unique page URL BEFORE creating entity
    let pageUrl: string;
    try {
      pageUrl = await generateUniquePageUrl(data.collegeName, supabaseAdmin);
    } catch (urlError) {
      console.error("Error generating page URL:", urlError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: urlError instanceof Error ? urlError.message : "Page URL already exists",
      };
    }

    // Step 6: Insert into colleges table with contact_user_id using admin client to bypass RLS
    const { data: newCollege, error: collegeError } = await supabaseAdmin
      .from("colleges")
      .insert({
        name: data.collegeName,
        contact_user_id: userId, // Link to the created user
        phone_number: data.phoneNumber,
        // Leave blank for columns that don't have values
        address: null,
        city: null,
        country: null,
      })
      .select()
      .single();

    if (collegeError) {
      console.error("Error creating college:", collegeError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: collegeError.message || "Failed to create college",
      };
    }

    // Step 7: Create page record and related records (page_widgets, page_media)
    const pageResult = await createPageForEntity("college", newCollege.id, userId, pageUrl);
    
    if (!pageResult.success) {
      console.error("Error creating page for college:", pageResult.message);
      await supabaseAdmin.from("colleges").delete().eq("id", newCollege.id);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: pageResult.message || "Failed to create page for college",
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
    revalidateTag("colleges", {});
    revalidateTag("users", {});
    revalidatePath("/admin/colleges");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "College created successfully! Activation email sent.",
      college: newCollege,
      user: newUser,
    };
  } catch (error) {
    console.error("Unexpected error creating college:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating the college",
    };
  }
}

/**
 * Delete a college and all related data
 */
export async function deleteCollege(collegeId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Step 1: Get the college record to find contact_user_id
    const { data: college, error: collegeError } = await supabaseAdmin
      .from("colleges")
      .select("contact_user_id")
      .eq("id", parseInt(collegeId))
      .single();

    if (collegeError || !college) {
      return {
        success: false,
        message: "College not found",
      };
    }

    const contactUserId = college.contact_user_id;

    // Step 2: Find and delete related page records
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", "college")
      .eq("organization_id", parseInt(collegeId));

    if (!pagesError && pages && pages.length > 0) {
      const pageIds = pages.map((p: { id: number }) => p.id);
      
      // Delete page_donations
      await supabaseAdmin
        .from("page_donations")
        .delete()
        .in("page_id", pageIds);

      // Delete page_widgets
      await supabaseAdmin
        .from("page_widgets")
        .delete()
        .in("page_id", pageIds);

      // Delete page_media
      await supabaseAdmin
        .from("page_media")
        .delete()
        .in("page_id", pageIds);

      // Delete pages
      await supabaseAdmin
        .from("pages")
        .delete()
        .in("id", pageIds);
    }

    // Step 3: Delete missionaries that reference this college (college_id)
    await supabaseAdmin
      .from("missionaries")
      .delete()
      .eq("college_id", parseInt(collegeId));

    // Step 4: Delete from colleges table
    const { error: deleteError } = await supabaseAdmin
      .from("colleges")
      .delete()
      .eq("id", parseInt(collegeId));

    if (deleteError) {
      console.error("Error deleting college:", deleteError);
      return {
        success: false,
        message: deleteError.message || "Failed to delete college",
      };
    }

    // Step 5: Delete from users table if contact_user_id exists
    if (contactUserId) {
      const { error: userDeleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("user_id", contactUserId);

      if (userDeleteError) {
        console.error("Error deleting user:", userDeleteError);
        // Continue even if user delete fails
      }

      try {
        await adminDeleteUser(contactUserId);
      } catch (authError) {
        console.error("Error deleting auth user:", authError);
      }
    }

    // Revalidate cache tags and paths
    revalidateTag("colleges", {});
    revalidateTag("users", {});
    revalidateTag("missionaries", {});
    revalidatePath("/admin/colleges");
    revalidatePath("/admin/users");
    revalidatePath("/admin/missionaries");

    return {
      success: true,
      message: "College deleted successfully",
    };
  } catch (error) {
    console.error("Unexpected error deleting college:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

/**
 * Disable/Enable a college
 */
export async function toggleCollegeStatus(collegeId: string, isDisabled: boolean) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: college, error: collegeError } = await supabaseAdmin
      .from("colleges")
      .select("contact_user_id")
      .eq("id", parseInt(collegeId))
      .single();

    if (collegeError || !college || !college.contact_user_id) {
      return {
        success: false,
        message: "College not found",
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: isDisabled ? "Inactive" : "Active" })
      .eq("user_id", college.contact_user_id);

    if (updateError) {
      return {
        success: false,
        message: updateError.message || "Failed to update college status",
      };
    }

    revalidateTag("colleges", {});
    revalidateTag("users", {});
    revalidatePath("/admin/colleges");

    return {
      success: true,
      message: `College ${isDisabled ? "disabled" : "enabled"} successfully`,
    };
  } catch (error) {
    console.error("Unexpected error updating college status:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}