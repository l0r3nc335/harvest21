"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminCreateUser, adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createPageForEntity, generateUniquePageUrl } from "@/lib/pageHelpers";
import { generateActivationToken } from "@/lib/tokenHelpers";
import { sendActivationEmail } from "@/lib/emailHelpers";

export type CreateAgencyFormData = {
  isManagedByHarvest21?: "yes" | "no";
  agencyName: string;
  contactFirstName?: string;
  contactLastName?: string;
  email?: string;
  phoneNumber?: string;
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

export async function createAgency(data: CreateAgencyFormData) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    if (data.isManagedByHarvest21 === "yes") {
      const pageUrl = await generateUniquePageUrl(data.agencyName, supabaseAdmin);
      const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser();
      const adminUserId = adminUser?.id;
      if (!adminUserId) {
        return { success: false, message: "Admin session required to create managed agency" };
      }
      const { data: newAgency, error: agencyError } = await supabaseAdmin
        .from("agencies")
        .insert({
          name: data.agencyName,
          contact_user_id: null,
          is_managed_by_harvest21: true,
          phone_number: null,
          address: null,
          city: null,
          country: null,
        })
        .select()
        .single();
      if (agencyError) {
        return { success: false, message: agencyError.message || "Failed to create agency" };
      }
      const pageResult = await createPageForEntity("agency", newAgency.id, adminUserId, pageUrl);
      if (!pageResult.success) {
        await supabaseAdmin.from("agencies").delete().eq("id", newAgency.id);
        return { success: false, message: pageResult.message || "Failed to create page" };
      }
      revalidateTag("agencies", {});
      revalidatePath("/admin/agencies");
      return {
        success: true,
        message: "Agency created successfully. Add contact and send invite from the account tab when ready.",
        agency: newAgency,
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

    // Step 3: Use role ID 5 (MISSION AGENCY) for agency contacts
    // User Roles:
    // 1: ADMIN
    // 2: SUPER ADMIN
    // 3: MISSIONARY
    // 4: SUPPORTER
    // 5: MISSION AGENCY
    // 6: CHURCH
    // 7: COLLEGE ADMIN
    const agencyRoleId = 5;

    // Step 4: Insert into users table using admin client to bypass RLS
    const { data: newUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.contactFirstName,
        last_name: data.contactLastName,
        email: data.email,
        role: agencyRoleId,
        status: "Active", // Set to Active by default
        last_activity: null,
      })
      .select()
      .single();

    if (userError) {
      console.error("Error creating user record:", userError);
      // Clean up: try to delete the auth user if user table insert fails
      await adminDeleteUser(userId);
      return {
        success: false,
        message: userError.message || "Failed to create user record",
      };
    }

    // Step 5: Generate and validate unique page URL BEFORE creating entity
    let pageUrl: string;
    try {
      pageUrl = await generateUniquePageUrl(data.agencyName, supabaseAdmin);
    } catch (urlError) {
      console.error("Error generating page URL:", urlError);
      // Clean up: delete user records if URL validation fails
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: urlError instanceof Error ? urlError.message : "Page URL already exists",
      };
    }

    // Step 6: Insert into agencies table with contact_user_id using admin client to bypass RLS
    const { data: newAgency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .insert({
        name: data.agencyName,
        contact_user_id: userId, // Link to the created user
        phone_number: data.phoneNumber,
        // Leave blank for columns that don't have values
        address: null,
        city: null,
        country: null,
      })
      .select()
      .single();

    if (agencyError) {
      console.error("Error creating agency:", agencyError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: agencyError.message || "Failed to create agency",
      };
    }

    // Step 7: Create page record and related records (page_widgets, page_media)
    const pageResult = await createPageForEntity("agency", newAgency.id, userId, pageUrl);
    
    if (!pageResult.success) {
      console.error("Error creating page for agency:", pageResult.message);
      await supabaseAdmin.from("agencies").delete().eq("id", newAgency.id);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: pageResult.message || "Failed to create page for agency",
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
    revalidateTag("agencies", {});
    revalidateTag("users", {});
    revalidatePath("/admin/agencies");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "Agency created successfully! Activation email sent.",
      agency: newAgency,
      user: newUser,
    };
  } catch (error) {
    console.error("Unexpected error creating agency:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating the agency",
    };
  }
}

/**
 * Delete an agency and all related data
 */
export async function deleteAgency(agencyId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Step 1: Get the agency record to find contact_user_id
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("contact_user_id")
      .eq("id", parseInt(agencyId))
      .single();

    if (agencyError || !agency) {
      return {
        success: false,
        message: "Agency not found",
      };
    }

    const contactUserId = agency.contact_user_id;

    // Step 2: Find and delete related page records
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", "agency")
      .eq("organization_id", parseInt(agencyId));

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

    // Step 3: Delete missionaries that reference this agency (agency_id)
    await supabaseAdmin
      .from("missionaries")
      .delete()
      .eq("agency_id", parseInt(agencyId));

    // Step 4: Delete from agencies table
    const { error: deleteError } = await supabaseAdmin
      .from("agencies")
      .delete()
      .eq("id", parseInt(agencyId));

    if (deleteError) {
      console.error("Error deleting agency:", deleteError);
      return {
        success: false,
        message: deleteError.message || "Failed to delete agency",
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
    revalidateTag("agencies", {});
    revalidateTag("users", {});
    revalidateTag("missionaries", {});
    revalidatePath("/admin/agencies");
    revalidatePath("/admin/users");
    revalidatePath("/admin/missionaries");

    return {
      success: true,
      message: "Agency deleted successfully",
    };
  } catch (error) {
    console.error("Unexpected error deleting agency:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

/**
 * Disable/Enable an agency
 */
export async function toggleAgencyStatus(agencyId: string, isDisabled: boolean) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("contact_user_id")
      .eq("id", parseInt(agencyId))
      .single();

    if (agencyError || !agency || !agency.contact_user_id) {
      return {
        success: false,
        message: "Agency not found",
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: isDisabled ? "Inactive" : "Active" })
      .eq("user_id", agency.contact_user_id);

    if (updateError) {
      return {
        success: false,
        message: updateError.message || "Failed to update agency status",
      };
    }

    revalidateTag("agencies", {});
    revalidateTag("users", {});
    revalidatePath("/admin/agencies");

    return {
      success: true,
      message: `Agency ${isDisabled ? "disabled" : "enabled"} successfully`,
    };
  } catch (error) {
    console.error("Unexpected error updating agency status:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

export async function sendInviteToManagedAgency(
  agencyId: number,
  data: { email: string; firstName: string; lastName: string; contactPersonPhoneNumber?: string }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email?.trim() || !emailRegex.test(data.email)) {
    return { success: false, message: "Valid email is required" };
  }
  try {
    const { data: agency, error: mErr } = await supabaseAdmin
      .from("agencies")
      .select("id, contact_user_id")
      .eq("id", agencyId)
      .single();
    if (mErr || !agency || agency.contact_user_id) {
      return { success: false, message: "Agency not found or already has a contact" };
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
    const agencyRoleId = 5;
    const { error: userErr } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email: data.email.trim(),
        role: agencyRoleId,
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
      .from("agencies")
      .update(updatePayload)
      .eq("id", agencyId);
    if (updateErr) {
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return { success: false, message: updateErr.message || "Failed to link agency" };
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
    revalidateTag("agencies", {});
    revalidatePath("/admin/agencies");
    revalidatePath(`/admin/agencies/${agencyId}`);
    return { success: true, message: `Activation email sent to ${data.email.trim()}` };
  } catch (error) {
    console.error("sendInviteToManagedAgency error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function resendActivationEmail(agencyId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("id, contact_user_id")
      .eq("id", parseInt(agencyId))
      .single();
    if (agencyError || !agency || !agency.contact_user_id) {
      return { success: false, message: "Agency not found or contact user not set" };
    }
    const { data: contactUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_id, first_name, last_name, email")
      .eq("user_id", agency.contact_user_id)
      .single();
    if (userError || !contactUser || !contactUser.email) {
      return { success: false, message: "Contact user email not found" };
    }
    const activationToken = await generateActivationToken(contactUser.user_id, contactUser.email);
    const emailResult = await sendActivationEmail(
      contactUser.email,
      `${contactUser.first_name || ""} ${contactUser.last_name || ""}`.trim() || "Agency Contact",
      activationToken
    );
    if (!emailResult.success) {
      return { success: false, message: emailResult.error || "Failed to send activation email" };
    }
    const { error: updateError } = await supabaseAdmin
      .from("agencies")
      .update({ is_managed_by_harvest21: false })
      .eq("id", parseInt(agencyId));
    if (updateError) {
      console.error("Failed to update is_managed_by_harvest21:", updateError);
    }
    revalidateTag("agencies", {});
    revalidatePath("/admin/agencies");
    revalidatePath(`/admin/agencies/${agency.id}`);
    return { success: true, message: `Activation email sent to ${contactUser.email}` };
  } catch (error) {
    console.error("resendActivationEmail agency error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}
