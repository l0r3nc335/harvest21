"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidateTag, revalidatePath } from "next/cache";
import { generateActivationToken } from "@/lib/tokenHelpers";
import { sendActivationEmail } from "@/lib/emailHelpers";
import type { Missionary } from "@/types/missionary";

export async function getChurchMissionaries(churchId: number): Promise<Missionary[]> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch missionaries: (1) missionary_churches pivot, (2) sending_church_id = this church, (3) mission_field_church_id = this church
    const { data: pivotData, error: pivotError } = await supabaseAdmin
      .from("missionary_churches")
      .select(`
        missionary:missionaries (
          id,
          user_id,
          first_name,
          last_name,
          destination_country,
          mission_status,
          created_at
        )
      `)
      .eq("church_id", churchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (pivotError) {
      console.error("Error fetching church missionaries:", pivotError);
      return [];
    }

    const { data: sendingChurchMissionaries } = await supabaseAdmin
      .from("missionaries")
      .select("id, user_id, first_name, last_name, destination_country, mission_status, created_at")
      .eq("sending_church_id", churchId);

    const { data: missionFieldChurchMissionaries } = await supabaseAdmin
      .from("missionaries")
      .select("id, user_id, first_name, last_name, destination_country, mission_status, created_at")
      .eq("mission_field_church_id", churchId);

    type RawRow = { id?: number; user_id?: string | null; first_name?: string | null; last_name?: string | null; destination_country?: string | null; mission_status?: string | null; created_at?: string };
    const fromPivot = (pivotData || [])
      .map((row: { missionary: unknown }) => row.missionary)
      .filter((m: unknown): m is RawRow => m != null);
    const fromSending = (sendingChurchMissionaries || []) as RawRow[];
    const fromMissionField = (missionFieldChurchMissionaries || []) as RawRow[];
    const seenIds = new Set<number>();
    const missionariesData: RawRow[] = [];
    for (const m of fromPivot) {
      const id = m.id ?? 0;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        missionariesData.push(m);
      }
    }
    for (const m of fromSending) {
      const id = m.id ?? 0;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        missionariesData.push(m);
      }
    }
    for (const m of fromMissionField) {
      const id = m.id ?? 0;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        missionariesData.push(m);
      }
    }
    missionariesData.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "", undefined, { numeric: true }));

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
    console.error("Error fetching church missionaries:", error);
    return [];
  }
}

export async function updateChurchInfo(
  churchId: number,
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
      return { success: false, message: "Church name is required" };
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
      state: data.state?.trim() || null,
      country: data.country?.trim() || null,
      phone_number: data.phoneNumber?.trim() || null,
    };

    const { data: updatedChurch, error } = await supabaseAdmin
      .from("churches")
      .update(updatePayload)
      .eq("id", churchId)
      .select()
      .single();

    if (error) {
      console.error("Error updating church info:", error);
      return { success: false, message: error.message || "Failed to update church information" };
    }

    revalidateTag("churches", "max");
    revalidateTag("church-detail", "max");
    revalidatePath(`/admin/churches/${churchId}`, "page");

    return { success: true, data: updatedChurch };
  } catch (error) {
    console.error("Error updating church info:", error);
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

    // Find the church using contact_user_id to update contact_person_phone_number
    const { data: churchData, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("id")
      .eq("contact_user_id", userId)
      .single();

    if (churchError) {
      console.error("Error finding church:", churchError);
      return { success: false, message: "Failed to find church record" };
    }

    // Update contact_person_phone_number in church table
    if (churchData) {
      console.log(`Updating church ${churchData.id} contact_person_phone_number to:`, data.contactPersonPhoneNumber?.trim() || null);
      
      const { data: updatedChurch, error: updatePhoneError } = await supabaseAdmin
        .from("churches")
        .update({ contact_person_phone_number: data.contactPersonPhoneNumber?.trim() || null })
        .eq("id", churchData.id)
        .select("id, contact_person_phone_number")
        .single();

      if (updatePhoneError) {
        console.error("Error updating contact person phone number:", updatePhoneError);
        return { success: false, message: `Failed to update contact person phone number: ${updatePhoneError.message}` };
      }

      console.log("Successfully updated church contact_person_phone_number:", updatedChurch);

      // Revalidate the church page cache after updating contact person info
      revalidateTag("churches", "max");
      revalidateTag("church-detail", "max");
      revalidatePath(`/admin/churches/${churchData.id}`, "page");
      revalidatePath(`/`, "page");

      // Return updated user data along with the contact_person_phone_number
      return { 
        success: true, 
        data: updatedUser,
        contactPersonPhoneNumber: updatedChurch.contact_person_phone_number 
      };
    }

    return { success: true, data: updatedUser };
  } catch (error) {
    console.error("Error updating contact person:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updateChurchStatus(
  churchId: string,
  status: "Pending Invite" | "Active" | "Inactive"
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const id = parseInt(churchId);
    if (isNaN(id)) {
      return { success: false, message: "Invalid church ID" };
    }

    // Get church to find contact user
    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("contact_user_id")
      .eq("id", id)
      .single();

    if (churchError || !church || !church.contact_user_id) {
      return { success: false, message: "Church or contact user not found" };
    }

    // Map status values - "Pending Invite" should be stored as "Pending" in the database
    const dbStatus = status === "Pending Invite" ? "Pending" : status;

    // Update user status
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: dbStatus })
      .eq("user_id", church.contact_user_id);

    if (updateError) {
      console.error("Error updating church status:", updateError);
      return { success: false, message: updateError.message || "Failed to update church status" };
    }

    // Revalidate cache
    revalidateTag("churches", "max");
    revalidateTag("church-detail", "max");
    revalidatePath(`/admin/churches/${id}`, "page");
    revalidatePath("/admin/churches", "page");

    return {
      success: true,
      message: `Church status updated to ${status} successfully`,
    };
  } catch (error) {
    console.error("Error updating church status:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update church status",
    };
  }
}

export async function resendActivationEmail(churchId: string) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch church with contact user details
    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select(`
        id,
        contact_user_id,
        contactUser:users!churches_contact_user_id_fkey (
          user_id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("id", parseInt(churchId))
      .single();

    if (churchError || !church || !church.contact_user_id) {
      return {
        success: false,
        message: "Church not found or contact user not set",
      };
    }

    const contactUser = church.contactUser as {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;

    if (!contactUser || !contactUser.email) {
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
