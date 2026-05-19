"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import type { Missionary } from "@/types/missionary";

export async function getAgencyMissionaries(agencyId: number): Promise<Missionary[]> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch missionaries filtered by agency_id
    const { data: missionariesData, error: missionariesError } = await supabaseAdmin
      .from("missionaries")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    if (missionariesError) {
      console.error("Error fetching missionaries:", missionariesError);
      return [];
    }

    // Get all unique user_ids
    const userIds = (missionariesData || [])
      .map((m: { user_id?: string | null }) => m.user_id)
      .filter((id: string | null | undefined): id is string => id != null);

    // Fetch users data for all user_ids
    let usersData: Array<{
      user_id: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      status?: string;
      last_activity?: string | null;
    }> = [];

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("user_id, first_name, last_name, email, status, last_activity")
        .in("user_id", userIds);

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else {
        usersData = (users || []);
      }
    }

    // Create a map of user_id to user data for quick lookup
    const usersMap = new Map(usersData.map((u) => [u.user_id, u]));

    // Map database data to Missionary type
    const missionaries: Missionary[] = (missionariesData || []).map((missionary: {
      id?: number;
      user_id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      destination_country?: string | null;
      mission_status?: string | null;
      created_at?: string;
    }) => {
      const user = missionary.user_id ? usersMap.get(missionary.user_id) : undefined;
      const location = missionary.destination_country || "N/A";
      
      // Format last activity from user's last_activity
      let lastActivity = "N/A";
      if (user?.last_activity) {
        const date = new Date(user.last_activity);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          lastActivity = "Today";
        } else if (diffDays === 1) {
          lastActivity = "Yesterday";
        } else if (diffDays < 7) {
          lastActivity = `${diffDays} days ago`;
        } else {
          lastActivity = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      }

      // Map user status to missionary accountStatus
      let accountStatus: Missionary["accountStatus"] = "Active";
      if (user?.status === "Inactive") {
        accountStatus = "Inactive";
      } else if (user?.status === "Pending" || user?.status === "Pending Invite") {
        accountStatus = "Pending Invite";
      } else if (user?.status === "Active") {
        accountStatus = "Active";
      }

      // Map mission_status to Missionary type
      let missionStatus: Missionary["missionStatus"] = "On-field";
      if (missionary.mission_status === "On-Field") {
        missionStatus = "On-field";
      } else if (missionary.mission_status === "Furlough") {
        missionStatus = "Off-field";
      } else if (missionary.mission_status === "Deputation") {
        missionStatus = "Pending";
      }

      // Use missionaries table's first_name and last_name (required fields)
      const fullName = `${missionary.first_name || ""} ${missionary.last_name || ""}`.trim() || "Unknown";

      return {
        id: missionary.id?.toString() || missionary.user_id || "",
        name: fullName,
        location: location,
        missionStatus: missionStatus,
        accountStatus: accountStatus,
        lastActivity: lastActivity,
      } as Missionary;
    });

    return missionaries;
  } catch (error) {
    console.error("Error fetching agency missionaries:", error);
    return [];
  }
}

export async function updateAgencyInfo(
  agencyId: number,
  data: {
    name: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phoneNumber?: string;
  }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Validate required fields
    if (!data.name || data.name.trim() === "") {
      return { success: false, message: "Agency name is required" };
    }

    const updatePayload: {
      name: string;
      website?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      phone_number?: string | null;
    } = {
      name: data.name.trim(),
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      phone_number: data.phoneNumber?.trim() || null,
    };

    // Only include state if it's provided (column may not exist until migration is applied)
    if (data.state !== undefined) {
      updatePayload.state = data.state?.trim() || null;
    }

    const { data: updatedAgency, error } = await supabaseAdmin
      .from("agencies")
      .update(updatePayload)
      .eq("id", agencyId)
      .select()
      .single();

    if (error) {
      console.error("Error updating agency info:", error);
      return { success: false, message: error.message || "Failed to update agency information" };
    }

    revalidatePath(`/admin/agencies/${agencyId}`, "page");
    revalidatePath(`/`, "page");

    return { success: true, data: updatedAgency };
  } catch (error) {
    console.error("Error updating agency info:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updateContactPerson(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    contactPersonPhoneNumber?: string;
  }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Validate required fields
    if (!data.firstName || data.firstName.trim() === "") {
      return { success: false, message: "First name is required" };
    }
    if (!data.lastName || data.lastName.trim() === "") {
      return { success: false, message: "Last name is required" };
    }
    if (!data.email || data.email.trim() === "") {
      return { success: false, message: "Email is required" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { success: false, message: "Invalid email format" };
    }

    // Update users table (only fields that exist: first_name, last_name, email)
    const updatePayload: {
      first_name: string;
      last_name: string;
      email: string;
    } = {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email: data.email.trim(),
    };

    const { data: updatedUser, error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating contact person:", error);
      return { success: false, message: error.message || "Failed to update contact person information" };
    }

    // Find the agency using contact_user_id to update contact_person_phone_number
    const { data: agencyData, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .eq("contact_user_id", userId)
      .single();

    if (agencyError) {
      console.error("Error finding agency:", agencyError);
      return { success: false, message: "Failed to find agency record" };
    }

    // Update contact_person_phone_number in agency table
    if (agencyData) {
      console.log(`Updating agency ${agencyData.id} contact_person_phone_number to:`, data.contactPersonPhoneNumber?.trim() || null);
      
      const { data: updatedAgency, error: updatePhoneError } = await supabaseAdmin
        .from("agencies")
        .update({ contact_person_phone_number: data.contactPersonPhoneNumber?.trim() || null })
        .eq("id", agencyData.id)
        .select("id, contact_person_phone_number")
        .single();

      if (updatePhoneError) {
        console.error("Error updating contact person phone number:", updatePhoneError);
        return { success: false, message: `Failed to update contact person phone number: ${updatePhoneError.message}` };
      }

      console.log("Successfully updated agency contact_person_phone_number:", updatedAgency);

      // Revalidate the agency page cache after updating contact person info
      revalidateTag("agencies", "max");
      revalidateTag("agency-detail", "max");
      revalidatePath(`/admin/agencies/${agencyData.id}`, "page");
      revalidatePath(`/`, "page");

      // Return updated user data along with the contact_person_phone_number
      return { 
        success: true, 
        data: updatedUser,
        contactPersonPhoneNumber: updatedAgency.contact_person_phone_number 
      };
    }

    return { success: true, data: updatedUser };
  } catch (error) {
    console.error("Error updating contact person:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

