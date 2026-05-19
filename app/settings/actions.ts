"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { updateUserLastActivity } from "@/lib/userActivityHelpers";
import { revalidatePath } from "next/cache";
import { generateUniquePageUrl } from "@/lib/pageHelpers";
import type { UpdateMissionaryDetailsData } from "@/app/admin/missionaries/[id]/actions";

type UserRole = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type OrganizationType = "missionary" | "donor" | "agency" | "church" | "college";

type UserProfileData = {
  userId: string;
  role: UserRole;
  organizationType: OrganizationType | null;
  organizationId: number | null;
};

export async function getCurrentUserProfile(): Promise<{
  success: boolean;
  data?: UserProfileData;
  error?: string;
}> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error in getCurrentUserProfile:", authError);
      return { success: false, error: "Authentication error: " + authError.message };
    }

    if (!user) {
      return { success: false, error: "Not authenticated. Please log in." };
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userError) {
      console.error("User fetch error:", userError);
      return { success: false, error: "User profile not found in database" };
    }

    if (!userData) {
      return { success: false, error: "User profile not found" };
    }

    let organizationType: OrganizationType | null = null;
    let organizationId: number | null = null;

    switch (userData.role) {
      case 3: {
        const { data: missionary, error: missionaryError } = await supabaseAdmin
          .from("missionaries")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (missionaryError) {
          console.error("Error fetching missionary:", missionaryError);
        }
        
        if (missionary) {
          organizationType = "missionary";
          organizationId = missionary.id;
        }
        break;
      }
      case 4: {
        const { data: donor, error: donorError } = await supabaseAdmin
          .from("donors")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (donorError) {
          console.error("Error fetching donor:", donorError);
        }
        
        if (donor) {
          organizationType = "donor";
          organizationId = donor.id;
        }
        break;
      }
      case 5: {
        const { data: agency, error: agencyError } = await supabaseAdmin
          .from("agencies")
          .select("id")
          .eq("contact_user_id", user.id)
          .maybeSingle();
        
        if (agencyError) {
          console.error("Error fetching agency:", agencyError);
        }
        
        if (agency) {
          organizationType = "agency";
          organizationId = agency.id;
        }
        break;
      }
      case 6: {
        const { data: church, error: churchError } = await supabaseAdmin
          .from("churches")
          .select("id")
          .eq("contact_user_id", user.id)
          .maybeSingle();
        
        if (churchError) {
          console.error("Error fetching church:", churchError);
        }
        
        if (church) {
          organizationType = "church";
          organizationId = church.id;
        }
        break;
      }
      case 7: {
        const { data: college, error: collegeError } = await supabaseAdmin
          .from("colleges")
          .select("id")
          .eq("contact_user_id", user.id)
          .maybeSingle();
        
        if (collegeError) {
          console.error("Error fetching college:", collegeError);
        }
        
        if (college) {
          organizationType = "college";
          organizationId = college.id;
        }
        break;
      }
    }

    console.log("User profile loaded:", {
      userId: user.id,
      role: userData.role,
      organizationType,
      organizationId,
    });

    return {
      success: true,
      data: {
        userId: user.id,
        role: userData.role,
        organizationType,
        organizationId,
      },
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return { success: false, error: "An unexpected error occurred: " + (error instanceof Error ? error.message : String(error)) };
  }
}

type MissionaryDetailData = {
  id: number;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  country_of_residence: string | null;
  destination_country: string;
  mission_status: string;
  open_to_visits: boolean;
  visits_start_date: string | null;
  visits_end_date: string | null;
  biography: string | null;
  agency_id: number | null;
  sending_church_id: number | null;
  mission_field_church_id: number | null;
  college_id: number | null;
  created_at: string;
  agency?: {
    id: number;
    name: string;
  } | null;
  sendingChurch?: {
    id: number;
    name: string;
  } | null;
  missionFieldChurch?: {
    id: number;
    name: string;
  } | null;
  college?: {
    id: number;
    name: string;
  } | null;
  page?: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    is_review: boolean | null;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
  } | null;
};

type EntityDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  contact_person_phone_number?: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  created_at: string;
  contactUser: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string;
  } | null;
  page?: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    is_published: boolean;
    is_review: boolean | null;
  } | null;
};

export async function getCurrentMissionaryData(
  missionaryId?: number
): Promise<{
  success: boolean;
  data?: MissionaryDetailData;
  error?: string;
}> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    if (!missionaryId) {
      const profile = await getCurrentUserProfile();
      if (!profile.success || !profile.data?.organizationId) {
        return { success: false, error: "Missionary ID not found" };
      }
      missionaryId = profile.data.organizationId;
    }

    const { data: missionaryData, error: missionaryError } = await supabaseAdmin
      .from("missionaries")
      .select("*")
      .eq("id", missionaryId)
      .single();

    if (missionaryError || !missionaryData) {
      return { success: false, error: "Missionary profile not found" };
    }

    // Fetch user data from users table to get email
    let userData = null;
    if (missionaryData.user_id) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email, first_name, last_name")
        .eq("user_id", missionaryData.user_id)
        .single();
      
      if (user) {
        userData = user;
      }
    }

    let agency = null;
    if (missionaryData.agency_id) {
      const { data: agencyData } = await supabaseAdmin
        .from("agencies")
        .select("id, name")
        .eq("id", missionaryData.agency_id)
        .single();
      if (agencyData) {
        agency = agencyData;
      }
    }

    let sendingChurch = null;
    if (missionaryData.sending_church_id) {
      const { data: churchData } = await supabaseAdmin
        .from("churches")
        .select("id, name")
        .eq("id", missionaryData.sending_church_id)
        .single();
      if (churchData) {
        sendingChurch = churchData;
      }
    }

    let missionFieldChurch = null;
    if (missionaryData.mission_field_church_id) {
      const { data: churchData } = await supabaseAdmin
        .from("churches")
        .select("id, name")
        .eq("id", missionaryData.mission_field_church_id)
        .single();
      if (churchData) {
        missionFieldChurch = churchData;
      }
    }

    let college = null;
    if (missionaryData.college_id) {
      const { data: collegeData } = await supabaseAdmin
        .from("colleges")
        .select("id, name")
        .eq("id", missionaryData.college_id)
        .single();
      if (collegeData) {
        college = collegeData;
      }
    }

    let page = null;
    const { data: pageData } = await supabaseAdmin
      .from("pages")
      .select("id, page_url, name, profile_photo_url, banner_photo_url, short_quote, about_text, intro_text, donation_percentage, is_published, is_review, donation_mode, external_donation_url")
      .eq("organization_type", "missionary")
      .eq("organization_id", missionaryData.id)
      .maybeSingle();
    
    if (pageData) {
      const p = pageData as Record<string, unknown>;
      page = {
        ...pageData,
        donation_mode: (p.donation_mode as "harvest21" | "external" | "off") ?? null,
        external_donation_url: (p.external_donation_url as string | null) ?? null,
      };
    }

    return {
      success: true,
      data: {
        id: missionaryData.id,
        user_id: missionaryData.user_id,
        first_name: userData?.first_name || missionaryData.first_name || "",
        last_name: userData?.last_name || missionaryData.last_name || "",
        email: userData?.email || missionaryData.email || "",
        phone_number: missionaryData.phone_number,
        country_of_residence: missionaryData.country_of_residence,
        destination_country: missionaryData.destination_country || "",
        mission_status: missionaryData.mission_status || "",
        open_to_visits: missionaryData.open_to_visits || false,
        visits_start_date: (missionaryData as { visits_start_date?: string | null }).visits_start_date ?? null,
        visits_end_date: (missionaryData as { visits_end_date?: string | null }).visits_end_date ?? null,
        biography: missionaryData.biography,
        agency_id: missionaryData.agency_id,
        sending_church_id: missionaryData.sending_church_id,
        mission_field_church_id: missionaryData.mission_field_church_id,
        college_id: missionaryData.college_id,
        created_at: missionaryData.created_at,
        agency,
        sendingChurch,
        missionFieldChurch,
        college,
        page,
      },
    };
  } catch (error) {
    console.error("Error fetching missionary data:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getCurrentEntityData(
  organizationType: OrganizationType,
  entityId?: number
): Promise<{
  success: boolean;
  data?: EntityDetailData;
  error?: string;
}> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    if (!entityId) {
      const profile = await getCurrentUserProfile();
      if (!profile.success || !profile.data?.organizationId) {
        return { success: false, error: "Entity ID not found" };
      }
      entityId = profile.data.organizationId;
    }

    const tableName = organizationType === "agency" ? "agencies" : organizationType === "church" ? "churches" : "colleges";

    const { data: entityData, error: entityError } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .eq("id", entityId)
      .single();

    if (entityError || !entityData) {
      return { success: false, error: `${organizationType} profile not found` };
    }

    let contactUserData = null;
    if (entityData.contact_user_id) {
      const { data } = await supabaseAdmin
        .from("users")
        .select("user_id, first_name, last_name, email, status")
        .eq("user_id", entityData.contact_user_id)
        .maybeSingle();
      contactUserData = data;
    }

    let page = null;
    const { data: pageData } = await supabaseAdmin
      .from("pages")
      .select("id, page_url, name, profile_photo_url, banner_photo_url, short_quote, about_text, intro_text, is_published, is_review")
      .eq("organization_type", organizationType)
      .eq("organization_id", entityData.id)
      .maybeSingle();
    
    if (pageData) {
      page = pageData;
    }

    return {
      success: true,
      data: {
        id: entityData.id,
        name: entityData.name || "",
        contact_user_id: entityData.contact_user_id,
        email: entityData.email,
        phone_number: entityData.phone_number,
        contact_person_phone_number: entityData.contact_person_phone_number ?? null,
        website: entityData.website,
        address: entityData.address,
        city: entityData.city,
        state: entityData.state,
        country: entityData.country,
        created_at: entityData.created_at,
        contactUser: contactUserData ? {
          user_id: contactUserData.user_id,
          first_name: contactUserData.first_name,
          last_name: contactUserData.last_name,
          email: contactUserData.email,
          status: contactUserData.status || "active",
        } : null,
        page,
      },
    };
  } catch (error) {
    console.error(`Error fetching ${organizationType} data:`, error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateCurrentMissionaryDetails(
  data: UpdateMissionaryDetailsData,
  originalFirstName: string,
  originalLastName: string
) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    const profile = await getCurrentUserProfile();
    if (!profile.success || !profile.data?.organizationId || profile.data.role !== 3) {
      return { success: false, message: "Access denied. Missionary role required." };
    }

    const missionaryId = profile.data.organizationId;

    if (!data.firstName || data.firstName.trim() === "") {
      return { success: false, message: "First name is required" };
    }
    if (!data.lastName || data.lastName.trim() === "") {
      return { success: false, message: "Last name is required" };
    }
    if (!data.email || data.email.trim() === "") {
      return { success: false, message: "Email is required" };
    }
    if (!data.destinationCountry || data.destinationCountry.trim() === "") {
      return { success: false, message: "Destination country is required" };
    }
    if (!data.missionStatus || data.missionStatus.trim() === "") {
      return { success: false, message: "Mission status is required" };
    }

    if (data.openToVisits) {
      if (!data.visitsStartDate?.trim() || !data.visitsEndDate?.trim()) {
        return { success: false, message: "Start date and end date are required when Open to Visits is Yes." };
      }
      const start = new Date(data.visitsStartDate.trim());
      const end = new Date(data.visitsEndDate.trim());
      if (end < start) {
        return { success: false, message: "End date must be the same as or later than start date." };
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { success: false, message: "Invalid email format" };
    }

    const { data: existingMissionary, error: fetchError } = await supabaseAdmin
      .from("missionaries")
      .select("email")
      .eq("id", missionaryId)
      .single();

    if (fetchError || !existingMissionary) {
      return { success: false, message: "Missionary not found" };
    }

    if (data.email.trim() !== existingMissionary.email) {
      const { data: emailExists, error: emailCheckError } = await supabaseAdmin
        .from("missionaries")
        .select("id")
        .eq("email", data.email.trim())
        .neq("id", missionaryId)
        .maybeSingle();

      if (emailCheckError && emailCheckError.code !== "PGRST116") {
        return { success: false, message: "Failed to validate email uniqueness" };
      }

      if (emailExists) {
        return { success: false, message: "Email already exists. Please use a different email." };
      }
    }

    let missionStatus = data.missionStatus;
    if (missionStatus === "On-field") {
      missionStatus = "On-Field";
    }

    const visitsStartDate = data.openToVisits && data.visitsStartDate?.trim() ? data.visitsStartDate.trim() : null;
    const visitsEndDate = data.openToVisits && data.visitsEndDate?.trim() ? data.visitsEndDate.trim() : null;

    const updatePayload = {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email: data.email.trim(),
      destination_country: data.destinationCountry.trim(),
      mission_status: missionStatus,
      open_to_visits: data.openToVisits,
      visits_start_date: visitsStartDate,
      visits_end_date: visitsEndDate,
      phone_number: data.phoneNumber?.trim() || null,
      country_of_residence: data.countryOfResidence?.trim() || null,
      agency_id: data.agencyId || null,
      sending_church_id: data.sendingChurchId || null,
      mission_field_church_id: data.missionFieldChurchId || null,
    };

    const { data: updatedMissionary, error: updateError } = await supabaseAdmin
      .from("missionaries")
      .update(updatePayload)
      .eq("id", missionaryId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating missionary:", updateError);
      return { success: false, message: updateError.message || "Failed to update missionary details" };
    }

    const nameChanged = 
      data.firstName.trim() !== originalFirstName.trim() || 
      data.lastName.trim() !== originalLastName.trim();

    if (nameChanged) {
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
      
      try {
        const newSlug = await generateUniquePageUrl(fullName, supabaseAdmin);

        const { data: pageRecord, error: pageFetchError } = await supabaseAdmin
          .from("pages")
          .select("id")
          .eq("organization_type", "missionary")
          .eq("organization_id", missionaryId)
          .single();

        if (!pageFetchError && pageRecord) {
          await supabaseAdmin
            .from("pages")
            .update({ page_url: newSlug })
            .eq("id", pageRecord.id);
        }
      } catch (slugError) {
        console.error("Error generating new slug:", slugError);
      }
    }

    await supabaseAdmin
      .from("users")
      .update({
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email: data.email.trim(),
      })
      .eq("user_id", user.id);

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    await updateUserLastActivity(user.id, true);

    revalidatePath("/settings");

    return { 
      success: true, 
      data: updatedMissionary,
      message: "Your details have been saved successfully!"
    };
  } catch (error) {
    console.error("Error updating missionary details:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getPageIdForCurrentUser(): Promise<number | null> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const profile = await getCurrentUserProfile();
    if (!profile.success || !profile.data?.organizationType || !profile.data?.organizationId) {
      return null;
    }

    const supabaseAdmin = await getSupabaseServer();

    const { data: page, error } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", profile.data.organizationType)
      .eq("organization_id", profile.data.organizationId)
      .single();

    if (error || !page) {
      return null;
    }

    return page.id;
  } catch (error) {
    console.error("Error fetching page ID:", error);
    return null;
  }
}

/**
 * Update current user's entity (church/agency/college) information
 */
export async function updateCurrentEntityInfo(
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
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    // Get user role and organization
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userError || !userData) {
      return { success: false, message: "User not found" };
    }

    // Determine entity type and table
    let tableName: string;
    let entityId: number | null = null;

    switch (userData.role) {
      case 5: // Agency
        tableName = "agencies";
        const { data: agency } = await supabaseAdmin
          .from("agencies")
          .select("id")
          .eq("contact_user_id", user.id)
          .single();
        entityId = agency?.id;
        break;
      case 6: // Church
        tableName = "churches";
        const { data: church } = await supabaseAdmin
          .from("churches")
          .select("id")
          .eq("contact_user_id", user.id)
          .single();
        entityId = church?.id;
        break;
      case 7: // College
        tableName = "colleges";
        const { data: college } = await supabaseAdmin
          .from("colleges")
          .select("id")
          .eq("contact_user_id", user.id)
          .single();
        entityId = college?.id;
        break;
      default:
        return { success: false, message: "Invalid user role for this operation" };
    }

    if (!entityId) {
      return { success: false, message: "Entity not found" };
    }

    // Validate required fields
    if (!data.name || data.name.trim() === "") {
      return { success: false, message: "Name is required" };
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
    };

    // Include state for churches and agencies
    if ((tableName === "churches" || tableName === "agencies") && data.state !== undefined) {
      updatePayload.state = data.state?.trim() || null;
    }

    // Include phone_number for churches and agencies
    if ((tableName === "churches" || tableName === "agencies") && data.phoneNumber !== undefined) {
      updatePayload.phone_number = data.phoneNumber.trim() || null;
    }

    const { data: updatedEntity, error } = await supabaseAdmin
      .from(tableName)
      .update(updatePayload)
      .eq("id", entityId)
      .select("id, name, website, address, city, state, country, phone_number")
      .single();

    if (error) {
      console.error("Error updating entity info:", error);
      return { success: false, message: error.message || "Failed to update information" };
    }

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    await updateUserLastActivity(user.id, true);

    revalidatePath("/settings");

    return { 
      success: true, 
      data: {
        name: updatedEntity.name,
        website: updatedEntity.website,
        address: updatedEntity.address,
        city: updatedEntity.city,
        state: updatedEntity.state,
        country: updatedEntity.country,
        phone_number: updatedEntity.phone_number,
      },
      message: "Information updated successfully!" 
    };
  } catch (error) {
    console.error("Error updating entity info:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Update current user's contact information
 */
export async function updateCurrentContactInfo(
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    contactPersonPhoneNumber?: string;
  }
) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

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

    // Update users table
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
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating contact info:", error);
      return { success: false, message: error.message || "Failed to update contact information" };
    }

    // Get user role to determine entity type
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userData) {
      let tableName: string | null = null;
      if (userData.role === 5) tableName = "agencies";
      else if (userData.role === 6) tableName = "churches";
      else if (userData.role === 7) tableName = "colleges";

      if (tableName) {
        // Find the entity using contact_user_id
        const { data: entityData, error: entityError } = await supabaseAdmin
          .from(tableName)
          .select("id")
          .eq("contact_user_id", user.id)
          .single();

        if (entityError) {
          console.error(`Error finding ${tableName}:`, entityError);
        } else if (entityData) {
          // Update contact_person_phone_number if provided
          if (data.contactPersonPhoneNumber !== undefined) {
            const { data: updatedEntity, error: updatePhoneError } = await supabaseAdmin
              .from(tableName)
              .update({ contact_person_phone_number: data.contactPersonPhoneNumber.trim() || null })
              .eq("id", entityData.id)
              .select("contact_person_phone_number")
              .single();

            if (updatePhoneError) {
              console.error("Error updating contact person phone number:", updatePhoneError);
              // Don't fail the whole operation, just log the error
            } else {
              console.log(`Successfully updated ${tableName} contact_person_phone_number:`, updatedEntity);
            }
          }

          // Update phone_number if provided (for backward compatibility)
          if (data.phoneNumber !== undefined) {
            await supabaseAdmin
              .from(tableName)
              .update({ phone_number: data.phoneNumber.trim() || null })
              .eq("id", entityData.id);
          }
        }
      }
    }

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    await updateUserLastActivity(user.id, true);

    revalidatePath("/settings");

    // Fetch the updated contact_person_phone_number to return it
    let contactPersonPhoneNumber: string | null = null;
    if (userData) {
      let tableName: string | null = null;
      if (userData.role === 5) tableName = "agencies";
      else if (userData.role === 6) tableName = "churches";
      else if (userData.role === 7) tableName = "colleges";

      if (tableName) {
        const { data: entityData } = await supabaseAdmin
          .from(tableName)
          .select("contact_person_phone_number")
          .eq("contact_user_id", user.id)
          .single();
        
        if (entityData) {
          contactPersonPhoneNumber = entityData.contact_person_phone_number;
        }
      }
    }

    return { 
      success: true, 
      data: updatedUser, 
      contactPersonPhoneNumber,
      message: "Contact information updated successfully!" 
    };
  } catch (error) {
    console.error("Error updating contact info:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getDonationsForCurrentUser(pageId: number) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, data: [], message: "Not authenticated" };
    }

    const { data: donations, error } = await supabaseAdmin
      .from("page_donations")
      .select("*")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching donations:", error);
      return { success: false, data: [], message: error.message };
    }

    const donorIds = (donations || [])
      .map((d: { donor_id?: number | null }) => d.donor_id)
      .filter((id: number | undefined | null): id is number => id != null);

    let donorsMap = new Map();
    if (donorIds.length > 0) {
      const { data: donors } = await supabaseAdmin
        .from("donors")
        .select("id, first_name, last_name, email")
        .in("id", donorIds);
      
      if (donors) {
        donorsMap = new Map(donors.map((d: { id: number }) => [d.id, d]));
      }
    }

    const STRIPE_FEE_PERCENT = 0.029;
    const STRIPE_FEE_FIXED = 0.30;

    const donationsAnonymous = (donations || []).map((donation: {
      id: number;
      transaction_ref?: string;
      created_at: string;
      donor_id?: number | null;
      amount?: number | null;
      status?: string;
      type?: string;
      designation?: string | null;
      donor_first_name?: string | null;
      donor_last_name?: string | null;
      donor_email?: string | null;
    }) => {
      const gross = donation.amount || 0;
      const fee = Math.round((gross * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED) * 100) / 100;
      const net = gross;
      return {
        id: donation.id,
        transaction_ref: donation.transaction_ref || `TXN-${donation.id}`,
        date: donation.created_at,
        donor_id: 0,
        donor: null,
        donor_first_name: donation.donor_first_name ?? null,
        donor_last_name: donation.donor_last_name ?? null,
        donor_email: donation.donor_email ?? null,
        amount: gross,
        net_amount: net,
        status: donation.status || "Pending",
        type: donation.type || "one_time",
        designation: donation.designation ?? null,
      };
    });

    return { success: true, data: donationsAnonymous };
  } catch (error) {
    console.error("Error fetching donations:", error);
    return { success: false, data: [], message: "An unexpected error occurred" };
  }
}

const EXTERNAL_URL_REGEX = /^https?:\/\/[^\s]+$/i;

export async function updateDonationOptions(
  pageId: number,
  donationMode: "harvest21" | "external" | "off",
  externalDonationUrl: string | null
): Promise<{ success: boolean; message?: string }> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    const { data: pageRow, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("id, organization_type, organization_id")
      .eq("id", pageId)
      .single();

    if (pageError || !pageRow || pageRow.organization_type !== "missionary") {
      return { success: false, message: "Page not found" };
    }

    const { data: missionary } = await supabaseAdmin
      .from("missionaries")
      .select("user_id")
      .eq("id", pageRow.organization_id)
      .single();

    if (!missionary || missionary.user_id !== user.id) {
      return { success: false, message: "Not authorized to update this page" };
    }

    if (donationMode === "external") {
      const url = (externalDonationUrl || "").trim();
      if (!url) {
        return { success: false, message: "External donation URL is required when using external link" };
      }
      if (!EXTERNAL_URL_REGEX.test(url)) {
        return { success: false, message: "Please enter a valid URL (e.g. https://example.com)" };
      }
      try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
        if (!res.ok && res.status !== 405) {
          return { success: false, message: "URL could not be reached. Check the link and try again." };
        }
      } catch {
        return { success: false, message: "URL could not be reached. Check the link and try again." };
      }
    }

    const updatePayload: { donation_mode: string; external_donation_url: string | null } = {
      donation_mode: donationMode,
      external_donation_url: donationMode === "external" ? (externalDonationUrl || "").trim() : null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("pages")
      .update(updatePayload)
      .eq("id", pageId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    revalidatePath("/settings");
    return { success: true, message: "Donation options saved" };
  } catch (error) {
    console.error("Error updating donation options:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getPreviewDataForCurrentUser() {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const profile = await getCurrentUserProfile();
    if (!profile.success || !profile.data?.organizationType || !profile.data?.organizationId) {
      return { success: false, error: "Profile not found" };
    }

    const { organizationType, organizationId } = profile.data;

    // Fetch page data first as we need the page_id for subsequent queries
    const { data: pageData, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (pageError || !pageData) {
      return { success: false, error: "Page not found" };
    }

    let resultKey: string = organizationType;
    let entityData: Record<string, unknown> | null = null;

    if (organizationType === "missionary") {
      // Fetch missionary data
      const { data: missionaryData } = await supabaseAdmin
        .from("missionaries")
        .select("id, first_name, last_name, biography, country_of_residence, user_id, agency_id, sending_church_id")
        .eq("id", organizationId)
        .single();
      
      if (!missionaryData) {
        return { success: false, error: "Missionary not found" };
      }

      // Fetch all related data in parallel
      const [agencyResult, churchResult, mediaResult, widgetsResult, donationsResult] = await Promise.all([
        // Agency
        missionaryData.agency_id 
          ? supabaseAdmin.from("agencies").select("id, name").eq("id", missionaryData.agency_id).single()
          : Promise.resolve({ data: null, error: null }),
        
        // Church
        missionaryData.sending_church_id
          ? supabaseAdmin.from("churches").select("id, name").eq("id", missionaryData.sending_church_id).single()
          : Promise.resolve({ data: null, error: null }),
        
        // Media
        supabaseAdmin
          .from("page_media")
          .select("id, media_type, media_url, description, thumbnail_url, created_at")
          .eq("page_id", pageData.id)
          .neq("media_url", "placeholder")
          .order("created_at", { ascending: false }),
        
        // Widgets
        supabaseAdmin
          .from("page_widgets")
          .select("id, widget_type, widget_title, widget_data, created_at")
          .eq("page_id", pageData.id)
          .order("created_at", { ascending: false }),
        
        // Donations
        supabaseAdmin
          .from("page_donations")
          .select("amount, status")
          .eq("page_id", pageData.id)
      ]);

      // Build entity data with relations
      entityData = {
        ...missionaryData,
        agency: agencyResult.data || null,
        church: churchResult.data || null,
      };

      console.log("Preview Debug - Data loaded:", {
        missionary: missionaryData.id,
        agency: agencyResult.data?.name || "none",
        church: churchResult.data?.name || "none",
      });

      // Calculate donations
      const donations = donationsResult.data || [];
      const totalPledged = donations.reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0);
      const totalReceived = donations
        .filter((d: { status?: string }) => d.status === "Complete")
        .reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0);

      const isApproved = pageData.is_published === true;

      return {
        success: true,
        data: {
          [resultKey]: entityData,
          page: {
            id: pageData.id,
            page_url: pageData.page_url,
            profile_photo_url: pageData.profile_photo_url,
            banner_photo_url: pageData.banner_photo_url,
            short_quote: pageData.short_quote,
            about_text: pageData.about_text,
            intro_text: pageData.intro_text,
            template_content: pageData.template_content,
            video_hashed_id: pageData.video_hashed_id,
            donation_percentage: pageData.donation_percentage,
            is_published: pageData.is_published,
            published_at: pageData.published_at,
            name: pageData.name,
            page_template: (pageData as { page_template?: string | null }).page_template ?? null,
            donation_mode: pageData.donation_mode ?? null,
            external_donation_url: pageData.external_donation_url ?? null,
          },
          media: mediaResult.data || [],
          widgets: widgetsResult.data || [],
          donations: {
            totalPledged,
            totalReceived,
          },
          isApproved,
        },
      };
    } else {
      // For non-missionary entities (agency, church, college)
      const tableName = organizationType === "agency" ? "agencies" : organizationType === "church" ? "churches" : "colleges";
      
      // Determine fields to select based on organization type
      let selectFields = "id, name";
      if (organizationType === "church") {
        selectFields = "id, name, address, city, state, country, phone_number, website";
      } else if (organizationType === "agency") {
        selectFields = "id, name, address, city, country, phone_number, website, email";
      }
      
      // Fetch entity and page-related data in parallel
      const [entityResult, mediaResult, widgetsResult, donationsResult] = await Promise.all([
        supabaseAdmin.from(tableName).select(selectFields).eq("id", organizationId).single(),
        supabaseAdmin
          .from("page_media")
          .select("id, media_type, media_url, description, thumbnail_url, created_at")
          .eq("page_id", pageData.id)
          .neq("media_url", "placeholder")
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("page_widgets")
          .select("id, widget_type, widget_title, widget_data, created_at")
          .eq("page_id", pageData.id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("page_donations")
          .select("amount, status")
          .eq("page_id", pageData.id)
      ]);

      entityData = entityResult.data;
      resultKey = "organization";

      if (!entityData) {
        return { success: false, error: "Entity not found" };
      }

      // Calculate donations
      const donations = donationsResult.data || [];
      const totalPledged = donations.reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0);
      const totalReceived = donations
        .filter((d: { status?: string }) => d.status === "Complete")
        .reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0);

      const isApproved = pageData.is_published === true;

      // Church/agency user preview: show all related missionaries (including is_published = false), matching admin preview.
      type MissionaryPreviewItem = { id: number; first_name: string; last_name: string; destination_country: string | null; country_of_residence: string | null; is_managed_by_harvest21?: boolean; page_url: string; profile_photo_url: string | null; page_name: string | null; is_published: boolean };
      let missionaries: MissionaryPreviewItem[] = [];

      if (organizationType === "church") {
        const { data: churchMissionaries } = await supabaseAdmin
          .from("missionary_churches")
          .select(`
            missionary:missionaries (
              id,
              first_name,
              last_name,
              country_of_residence,
              destination_country,
              is_managed_by_harvest21
            )
          `)
          .eq("church_id", organizationId)
          .eq("is_active", true);

        const rawMissionaries = (churchMissionaries || [])
          .map((cm: { missionary: unknown }) => cm.missionary)
          .filter((m: unknown): m is { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean } => m != null);

        if (rawMissionaries.length > 0) {
          const missionaryIds = rawMissionaries.map((m: { id: number }) => m.id);
          const { data: missionaryPages } = await supabaseAdmin
            .from("pages")
            .select("organization_id, page_url, name, profile_photo_url, is_published")
            .eq("organization_type", "missionary")
            .in("organization_id", missionaryIds);

          type MissionaryPageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
          const pageMap = new Map<number, MissionaryPageRow>(
            (missionaryPages || []).map((p: MissionaryPageRow) => [p.organization_id, p])
          );

          missionaries = rawMissionaries.map((m: { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }) => {
            const page = pageMap.get(m.id);
            return {
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              destination_country: m.destination_country ?? null,
              country_of_residence: m.country_of_residence ?? null,
              is_managed_by_harvest21: m.is_managed_by_harvest21 ?? false,
              page_url: page?.page_url ?? "",
              profile_photo_url: page?.profile_photo_url ?? null,
              page_name: page?.name ?? null,
              is_published: page?.is_published ?? false,
            };
          });
        }
      } else if (organizationType === "agency") {
        const { data: agencyMissionaries } = await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name, country_of_residence, destination_country, is_managed_by_harvest21")
          .eq("agency_id", organizationId)
          .order("last_name", { ascending: true });

        const rawMissionaries = (agencyMissionaries || []) as { id: number; first_name: string; last_name: string; country_of_residence?: string | null; destination_country?: string | null; is_managed_by_harvest21?: boolean }[];

        if (rawMissionaries.length > 0) {
          const missionaryIds = rawMissionaries.map((m: { id: number }) => m.id);
          const { data: missionaryPages } = await supabaseAdmin
            .from("pages")
            .select("organization_id, page_url, name, profile_photo_url, is_published")
            .eq("organization_type", "missionary")
            .in("organization_id", missionaryIds);

          type MissionaryPageRow = { organization_id: number; page_url: string; name: string | null; profile_photo_url: string | null; is_published: boolean };
          const pageMap = new Map<number, MissionaryPageRow>(
            (missionaryPages || []).map((p: MissionaryPageRow) => [p.organization_id, p])
          );

          missionaries = rawMissionaries.map((m) => {
            const page = pageMap.get(m.id);
            return {
              id: m.id,
              first_name: m.first_name,
              last_name: m.last_name,
              destination_country: m.destination_country ?? null,
              country_of_residence: m.country_of_residence ?? null,
              is_managed_by_harvest21: m.is_managed_by_harvest21 ?? false,
              page_url: page?.page_url ?? "",
              profile_photo_url: page?.profile_photo_url ?? null,
              page_name: page?.name ?? null,
              is_published: page?.is_published ?? false,
            };
          });
        }
      }

      return {
        success: true,
        data: {
          [resultKey]: entityData,
          page: {
            id: pageData.id,
            page_url: pageData.page_url,
            profile_photo_url: pageData.profile_photo_url,
            banner_photo_url: pageData.banner_photo_url,
            short_quote: pageData.short_quote,
            about_text: pageData.about_text,
            intro_text: pageData.intro_text,
            template_content: pageData.template_content,
            video_hashed_id: pageData.video_hashed_id,
            is_published: pageData.is_published,
            published_at: pageData.published_at,
            name: pageData.name,
          },
          media: mediaResult.data || [],
          widgets: widgetsResult.data || [],
          donations: {
            totalPledged,
            totalReceived,
          },
          isApproved,
          missionaries,
        },
      };
    }
  } catch (error) {
    console.error("Error fetching preview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function submitPageForReview() {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    const profile = await getCurrentUserProfile();
    if (!profile.success || !profile.data?.organizationType || !profile.data?.organizationId) {
      return { success: false, message: "Profile not found" };
    }

    const { organizationType, organizationId } = profile.data;

    const { data: pageData } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .single();

    if (!pageData) {
      return { success: false, message: "Page not found" };
    }

    const { error: updateError } = await supabaseAdmin
      .from("pages")
      .update({
        is_review: true,
      })
      .eq("id", pageData.id);

    if (updateError) {
      console.error("Error submitting for review:", updateError);
      return { success: false, message: "Failed to submit for review" };
    }

    revalidatePath("/settings");

    return { success: true, message: "Page submitted for review successfully!" };
  } catch (error) {
    console.error("Error submitting for review:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getDonationsForDonor() {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, data: [], message: "Not authenticated" };
    }

    const { data: donor } = await supabaseAdmin
      .from("donors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let donations: Record<string, unknown>[] = [];

    if (donor) {
      const { data: byDonor, error } = await supabaseAdmin
        .from("page_donations")
        .select("id, amount, currency, status, type, created_at, transaction_ref, stripe_subscription_id, stripe_payment_intent_id, page_id, designation, pages!inner(name, organization_type, organization_id)")
        .eq("donor_id", donor.id)
        .order("created_at", { ascending: false });
      if (error) {
        return { success: false, data: [], message: error.message };
      }
      donations = byDonor || [];
    }

    if (donations.length === 0) {
      const { data: byUser, error: userError } = await supabaseAdmin
        .from("page_donations")
        .select("id, amount, currency, status, type, created_at, transaction_ref, stripe_subscription_id, stripe_payment_intent_id, page_id, designation, pages!inner(name, organization_type, organization_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!userError && byUser) {
        donations = byUser;
      }
    }

    const seenIds = new Set<number>();
    const unique: Record<string, unknown>[] = [];
    for (const d of donations) {
      const id = d.id as number;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        unique.push(d);
      }
    }

    const mapped = unique.map((d) => {
      const page = d.pages as { name?: string; organization_type?: string } | null;
      const rawDes = d.designation as string | null | undefined;
      return {
        id: d.id as number,
        amount: d.amount as number,
        currency: d.currency as string,
        status: d.status as string,
        type: d.type as string,
        created_at: d.created_at as string,
        transaction_ref: d.transaction_ref as string,
        stripe_subscription_id: d.stripe_subscription_id as string | null,
        stripe_payment_intent_id: d.stripe_payment_intent_id as string | null,
        pageName: page?.name?.trim() || null,
        designation:
          typeof rawDes === "string" && rawDes.trim() !== "" ? rawDes.trim() : null,
      };
    });

    return { success: true, data: mapped };
  } catch (error) {
    console.error("Error fetching donor donations:", error);
    return { success: false, data: [], message: "An unexpected error occurred" };
  }
}

export async function cancelRecurringDonation(subscriptionId: string) {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    const { data: donor } = await supabaseAdmin
      .from("donors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!donor) {
      return { success: false, message: "Donor not found" };
    }

    const { data: donation } = await supabaseAdmin
      .from("page_donations")
      .select("id, stripe_subscription_id")
      .eq("donor_id", donor.id)
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    if (!donation) {
      return { success: false, message: "Subscription not found" };
    }

    const Stripe = (await import("stripe")).default;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { success: false, message: "Payment service unavailable" };
    }
    const stripe = new Stripe(stripeKey);
    await stripe.subscriptions.cancel(subscriptionId);

    return { success: true, message: "Recurring donation canceled" };
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return { success: false, message: "Failed to cancel subscription" };
  }
}

export async function publishPage() {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    const profile = await getCurrentUserProfile();
    if (!profile.success || !profile.data?.organizationType || !profile.data?.organizationId) {
      return { success: false, message: "Profile not found" };
    }

    const { organizationType, organizationId } = profile.data;

    const { data: pageData } = await supabaseAdmin
      .from("pages")
      .select("id, page_url")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .single();

    if (!pageData) {
      return { success: false, message: "Page not found" };
    }

    const { error: updateError } = await supabaseAdmin
      .from("pages")
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        is_review: false,
      })
      .eq("id", pageData.id);

    if (updateError) {
      console.error("Error publishing page:", updateError);
      return { success: false, message: "Failed to publish page" };
    }

    await updateUserLastActivity(user.id, true);

    revalidatePath("/settings");
    if (pageData.page_url) {
      revalidatePath(`/${pageData.page_url}`);
    }

    return { success: true, message: "Your page is live!" };
  } catch (error) {
    console.error("Error publishing page:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}
