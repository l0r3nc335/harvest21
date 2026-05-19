"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import type { Missionary } from "@/types/missionary";

export async function getCollegeMissionaries(collegeId: number): Promise<Missionary[]> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch missionaries filtered by college_id
    const { data: missionariesData, error: missionariesError } = await supabaseAdmin
      .from("missionaries")
      .select("*")
      .eq("college_id", collegeId)
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
    console.error("Error fetching college missionaries:", error);
    return [];
  }
}

export async function updateCollegeInfo(
  collegeId: number,
  data: {
    name: string;
    website?: string;
    address?: string;
    city?: string;
    country?: string;
  }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Validate required fields
    if (!data.name || data.name.trim() === "") {
      return { success: false, message: "College name is required" };
    }

    const updatePayload: {
      name: string;
      website?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    } = {
      name: data.name.trim(),
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
    };

    const { data: updatedCollege, error } = await supabaseAdmin
      .from("colleges")
      .update(updatePayload)
      .eq("id", collegeId)
      .select()
      .single();

    if (error) {
      console.error("Error updating college info:", error);
      return { success: false, message: error.message || "Failed to update college information" };
    }

    revalidateTag("colleges", "max");
    revalidatePath(`/admin/colleges/${collegeId}`, "page");

    return { success: true, data: updatedCollege };
  } catch (error) {
    console.error("Error updating college info:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updateContactPerson(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
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

    // If phoneNumber is provided, update the college table (for college admin role)
    if (data.phoneNumber !== undefined) {
      const collegeUpdatePayload: {
        phone_number?: string | null;
      } = {};

      if (data.phoneNumber !== undefined) {
        collegeUpdatePayload.phone_number = data.phoneNumber.trim() || null;
      }

      // Find the college using contact_user_id
      await supabaseAdmin
        .from("colleges")
        .update(collegeUpdatePayload)
        .eq("contact_user_id", userId);
    }

    return { success: true, data: updatedUser };
  } catch (error) {
    console.error("Error updating contact person:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

