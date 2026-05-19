"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminCreateUser, adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createPageForEntity, generateUniquePageUrl } from "@/lib/pageHelpers";
import { generateActivationToken } from "@/lib/tokenHelpers";
import { sendActivationEmail } from "@/lib/emailHelpers";
import { revalidateMissionaryRegionListCaches } from "@/app/missionaries/[region]/actions";

export type CreateMissionaryFormData = {
  isManagedByHarvest21?: "yes" | "no";
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  countryOfResidence: string;
  agencyName: string;
  sendingChurchName: string;
  missionFieldChurchName: string;
  collegeName?: string;
  missionStatus: string;
  openToVisits: string;
  destinationCountry: string;
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

export async function createMissionary(data: CreateMissionaryFormData) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    if (data.isManagedByHarvest21 === "yes") {
      let agencyId: number | null = null;
      let sendingChurchId: number | null = null;
      let missionFieldChurchId: number | null = null;
      let collegeId: number | null = null;
      if (data.agencyName) {
        const { data: ad } = await supabaseAdmin.from("agencies").select("id").eq("name", data.agencyName).single();
        if (ad) agencyId = ad.id;
      }
      if (data.sendingChurchName) {
        const { data: cd } = await supabaseAdmin.from("churches").select("id").eq("name", data.sendingChurchName).single();
        if (cd) sendingChurchId = cd.id;
      }
      if (data.missionFieldChurchName) {
        const { data: cd } = await supabaseAdmin.from("churches").select("id").eq("name", data.missionFieldChurchName).single();
        if (cd) missionFieldChurchId = cd.id;
      }
      if (data.collegeName) {
        const { data: cd } = await supabaseAdmin.from("colleges").select("id").eq("name", data.collegeName).single();
        if (cd) collegeId = cd.id;
      }
      let missionStatus = data.missionStatus;
      if (missionStatus === "On-field") missionStatus = "On-Field";
      else if (missionStatus === "Furlough") missionStatus = "Furlough";
      else if (missionStatus === "Deputation") missionStatus = "Deputation";
      const missionaryFullName = `${data.firstName} ${data.lastName}`;
      const pageUrl = await generateUniquePageUrl(missionaryFullName, supabaseAdmin);
      const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser();
      const adminUserId = adminUser?.id;
      if (!adminUserId) {
        return { success: false, message: "Admin session required to create managed missionary" };
      }
      const { data: newMissionary, error: missionaryError } = await supabaseAdmin
        .from("missionaries")
        .insert({
          user_id: null,
          first_name: data.firstName,
          last_name: data.lastName,
          email: null,
          phone_number: data.phoneNumber || null,
          country_of_residence: data.countryOfResidence || null,
          destination_country: data.destinationCountry || null,
          mission_status: missionStatus,
          open_to_visits: data.openToVisits === "Yes",
          agency_id: agencyId,
          sending_church_id: sendingChurchId,
          mission_field_church_id: missionFieldChurchId,
          college_id: collegeId,
          is_managed_by_harvest21: true,
          allow_direct_messages: false,
        })
        .select()
        .single();
      if (missionaryError) {
        return { success: false, message: missionaryError.message || "Failed to create missionary" };
      }
      const pageResult = await createPageForEntity("missionary", newMissionary.id, adminUserId, pageUrl);
      if (!pageResult.success) {
        await supabaseAdmin.from("missionaries").delete().eq("id", newMissionary.id);
        return { success: false, message: pageResult.message || "Failed to create page" };
      }
      revalidateTag("missionaries", {});
      await revalidateMissionaryRegionListCaches();
      revalidatePath("/admin/missionaries");
      return {
        success: true,
        message: "Missionary created successfully. Add email and send invite from the account tab when ready.",
        missionary: newMissionary,
        user: null,
      };
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

    // Step 3: Use role ID 3 (MISSIONARY) for missionaries
    // User Roles:
    // 1: ADMIN
    // 2: SUPER ADMIN
    // 3: MISSIONARY
    // 4: SUPPORTER
    // 5: MISSION AGENCY
    // 6: CHURCH
    // 7: COLLEGE ADMIN
    const missionaryRoleId = 3;

    // Step 4: Insert into users table using admin client to bypass RLS
    const { data: newUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        role: missionaryRoleId,
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

    // Step 5: Look up IDs for related entities (agency, churches, college) by name
    let agencyId: number | null = null;
    let sendingChurchId: number | null = null;
    let missionFieldChurchId: number | null = null;
    let collegeId: number | null = null;

    // Look up agency ID
    if (data.agencyName) {
      const { data: agencyData, error: agencyLookupError } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("name", data.agencyName)
        .single();

      if (!agencyLookupError && agencyData) {
        agencyId = agencyData.id;
      } else {
        console.warn(`Agency "${data.agencyName}" not found, continuing without agency_id`);
      }
    }

    // Look up sending church ID
    if (data.sendingChurchName) {
      const { data: churchData, error: sendingChurchLookupError } = await supabaseAdmin
        .from("churches")
        .select("id")
        .eq("name", data.sendingChurchName)
        .single();

      if (!sendingChurchLookupError && churchData) {
        sendingChurchId = churchData.id;
      } else {
        console.warn(`Sending church "${data.sendingChurchName}" not found, continuing without sending_church_id`);
      }
    }

    // Look up mission field church ID
    if (data.missionFieldChurchName) {
      const { data: churchData, error: missionFieldChurchLookupError } = await supabaseAdmin
        .from("churches")
        .select("id")
        .eq("name", data.missionFieldChurchName)
        .single();

      if (!missionFieldChurchLookupError && churchData) {
        missionFieldChurchId = churchData.id;
      } else {
        console.warn(`Mission field church "${data.missionFieldChurchName}" not found, continuing without mission_field_church_id`);
      }
    }

    // Look up college ID
    if (data.collegeName) {
      const { data: collegeData, error: collegeLookupError } = await supabaseAdmin
        .from("colleges")
        .select("id")
        .eq("name", data.collegeName)
        .single();

      if (!collegeLookupError && collegeData) {
        collegeId = collegeData.id;
      } else {
        console.warn(`College "${data.collegeName}" not found, continuing without college_id`);
      }
    }

    // Map mission_status to match database enum values
    // Database expects: 'On-Field', 'Furlough', 'Deputation'
    let missionStatus = data.missionStatus;
    if (missionStatus === "On-field") {
      missionStatus = "On-Field";
    } else if (missionStatus === "Furlough") {
      missionStatus = "Furlough";
    } else if (missionStatus === "Deputation") {
      missionStatus = "Deputation";
    }

    // Step 6: Generate and validate unique page URL BEFORE creating entity
    // Use full name for missionaries: firstName + lastName
    const missionaryFullName = `${data.firstName} ${data.lastName}`;
    let pageUrl: string;
    try {
      pageUrl = await generateUniquePageUrl(missionaryFullName, supabaseAdmin);
    } catch (urlError) {
      console.error("Error generating page URL:", urlError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: urlError instanceof Error ? urlError.message : "Page URL already exists",
      };
    }

    // Step 7: Insert into missionaries table using admin client to bypass RLS
    const { data: newMissionary, error: missionaryError } = await supabaseAdmin
      .from("missionaries")
      .insert({
        user_id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone_number: data.phoneNumber || null,
        country_of_residence: data.countryOfResidence || null,
        destination_country: data.destinationCountry || null,
        mission_status: missionStatus,
        open_to_visits: data.openToVisits === "Yes",
        agency_id: agencyId,
        sending_church_id: sendingChurchId,
        mission_field_church_id: missionFieldChurchId,
        college_id: collegeId,
      })
      .select()
      .single();

    if (missionaryError) {
      console.error("Error creating missionary:", missionaryError);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: missionaryError.message || "Failed to create missionary",
      };
    }

    // Step 8: Create page record and related records (page_widgets, page_media)
    const pageResult = await createPageForEntity("missionary", newMissionary.id, userId, pageUrl);
    
    if (!pageResult.success) {
      console.error("Error creating page for missionary:", pageResult.message);
      await supabaseAdmin.from("missionaries").delete().eq("id", newMissionary.id);
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return {
        success: false,
        message: pageResult.message || "Failed to create page for missionary",
      };
    }

    // Step 9: Generate activation token and send email
    try {
      const activationToken = await generateActivationToken(userId, data.email);
      
      const emailResult = await sendActivationEmail(
        data.email,
        `${data.firstName} ${data.lastName}`,
        activationToken
      );

      if (!emailResult.success) {
        console.warn("Failed to send activation email:", emailResult.error);
      }
    } catch (emailError) {
      console.error("Error sending activation email:", emailError);
    }

    // Revalidate cache tags and path
    revalidateTag("missionaries", {});
    revalidateTag("users", {});
    await revalidateMissionaryRegionListCaches();
    revalidatePath("/admin/missionaries");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "Missionary created successfully! Activation email sent.",
      missionary: newMissionary,
      user: newUser,
    };
  } catch (error) {
    console.error("Unexpected error creating missionary:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating the missionary",
    };
  }
}

/**
 * Delete a missionary and all related data
 */
export async function deleteMissionary(missionaryId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Step 1: Get the missionary record to find user_id
    const { data: missionary, error: missionaryError } = await supabaseAdmin
      .from("missionaries")
      .select("user_id")
      .eq("id", parseInt(missionaryId))
      .single();

    if (missionaryError || !missionary) {
      return {
        success: false,
        message: "Missionary not found",
      };
    }

    const userId = missionary.user_id;

    // Step 2: Find and delete related page records
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", "missionary")
      .eq("organization_id", parseInt(missionaryId));

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

    // Step 3: Delete from missionaries table
    const { error: deleteError } = await supabaseAdmin
      .from("missionaries")
      .delete()
      .eq("id", parseInt(missionaryId));

    if (deleteError) {
      console.error("Error deleting missionary:", deleteError);
      return {
        success: false,
        message: deleteError.message || "Failed to delete missionary",
      };
    }

    // Step 3.5: Delete prayers and related data BEFORE deleting auth user
    // This must be done before deleting the auth user to avoid RLS policy conflicts
    // The foreign keys have ON DELETE CASCADE, but RLS blocks the cascade
    if (userId) {
      // Delete prayer_reactions first (child of prayers)
      await supabaseAdmin
        .from("prayer_reactions")
        .delete()
        .eq("user_id", userId);

      // Delete prayer_updates (child of prayers)
      await supabaseAdmin
        .from("prayer_updates")
        .delete()
        .eq("user_id", userId);

      // Delete prayers (parent table)
      await supabaseAdmin
        .from("prayers")
        .delete()
        .eq("user_id", userId);
    }

    // Step 4: Delete from users table if user_id exists
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
    revalidateTag("missionaries", {});
    revalidateTag("users", {});
    await revalidateMissionaryRegionListCaches();
    revalidatePath("/admin/missionaries");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "Missionary deleted successfully",
    };
  } catch (error) {
    console.error("Unexpected error deleting missionary:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

/**
 * Disable/Enable a missionary
 */
export async function toggleMissionaryStatus(missionaryId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const parsedId = parseInt(missionaryId);
    const isNumericId = !isNaN(parsedId);

    let missionary;
    let missionaryError;

    if (isNumericId) {
      const result = await supabaseAdmin
        .from("missionaries")
        .select("user_id")
        .eq("id", parsedId)
        .single();
      missionary = result.data;
      missionaryError = result.error;
    } else {
      const result = await supabaseAdmin
        .from("missionaries")
        .select("user_id")
        .eq("user_id", missionaryId)
        .single();
      missionary = result.data;
      missionaryError = result.error;
    }

    if (missionaryError || !missionary || !missionary.user_id) {
      console.error("Error fetching missionary:", missionaryError);
      return {
        success: false,
        message: "Missionary not found",
      };
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("status")
      .eq("user_id", missionary.user_id)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user status:", userError);
      return {
        success: false,
        message: "Failed to fetch user status",
      };
    }

    const currentStatus = userData.status || "Inactive";
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: newStatus })
      .eq("user_id", missionary.user_id);

    if (updateError) {
      console.error("Error updating user status:", updateError);
      return {
        success: false,
        message: updateError.message || "Failed to update missionary status",
      };
    }

    revalidateTag("missionaries", {});
    revalidateTag("users", {});
    await revalidateMissionaryRegionListCaches();
    revalidatePath("/admin/missionaries");

    return {
      success: true,
      message: `Missionary ${newStatus === "Inactive" ? "disabled" : "enabled"} successfully`,
    };
  } catch (error) {
    console.error("Unexpected error updating missionary status:", error);
    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
}

export async function resendActivationEmail(missionaryId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: missionary, error: missionaryError } = await supabaseAdmin
      .from("missionaries")
      .select("user_id, first_name, last_name, email")
      .eq("id", parseInt(missionaryId))
      .single();

    if (missionaryError || !missionary || !missionary.user_id) {
      return {
        success: false,
        message: "Missionary not found",
      };
    }

    const activationToken = await generateActivationToken(missionary.user_id, missionary.email);
    
    const emailResult = await sendActivationEmail(
      missionary.email,
      `${missionary.first_name} ${missionary.last_name}`,
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
      message: "Activation email sent successfully!",
    };
  } catch (error) {
    console.error("Unexpected error sending activation email:", error);
    return {
      success: false,
      message: "An unexpected error occurred while sending the email",
    };
  }
}
export async function searchAgencies(query: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data, error } = await supabaseAdmin
      .from("agencies")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error searching agencies:", error);
      return [];
    }

    return (data || []).map((agency: { id: number; name: string }) => ({
      id: agency.id,
      name: agency.name,
    }));
  } catch (error) {
    console.error("Unexpected error searching agencies:", error);
    return [];
  }
}

export async function searchChurches(query: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data, error } = await supabaseAdmin
      .from("churches")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error searching churches:", error);
      return [];
    }

    return (data || []).map((church: { id: number; name: string }) => ({
      id: church.id,
      name: church.name,
    }));
  } catch (error) {
    console.error("Unexpected error searching churches:", error);
    return [];
  }
}

export async function searchColleges(query: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data, error } = await supabaseAdmin
      .from("colleges")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error searching colleges:", error);
      return [];
    }

    return (data || []).map((college: { id: number; name: string }) => ({
      id: college.id,
      name: college.name,
    }));
  } catch (error) {
    console.error("Unexpected error searching colleges:", error);
    return [];
  }
}

// Fetch initial options (first 20)
export async function getInitialAgencies() {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data, error } = await supabaseAdmin
      .from("agencies")
      .select("id, name")
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching agencies:", error);
      return [];
    }

    return (data || []).map((agency: { id: number; name: string }) => ({
      id: agency.id,
      name: agency.name,
    }));
  } catch (error) {
    console.error("Unexpected error fetching agencies:", error);
    return [];
  }
}

export async function getInitialChurches() {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data, error } = await supabaseAdmin
      .from("churches")
      .select("id, name")
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching churches:", error);
      return [];
    }

    return (data || []).map((church: { id: number; name: string }) => ({
      id: church.id,
      name: church.name,
    }));
  } catch (error) {
    console.error("Unexpected error fetching churches:", error);
    return [];
  }
}

export async function getInitialColleges() {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  try {
    const { data, error } = await supabaseAdmin
      .from("colleges")
      .select("id, name")
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching colleges:", error);
      return [];
    }

    return (data || []).map((college: { id: number; name: string }) => ({
      id: college.id,
      name: college.name,
    }));
  } catch (error) {
    console.error("Unexpected error fetching colleges:", error);
    return [];
  }
}
