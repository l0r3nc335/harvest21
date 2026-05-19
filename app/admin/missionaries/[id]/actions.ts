"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { adminCreateUser, adminDeleteUser } from "@/lib/authAdmin";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { generateUniquePageUrl } from "@/lib/pageHelpers";
import { generateActivationToken } from "@/lib/tokenHelpers";
import { sendActivationEmail } from "@/lib/emailHelpers";
import { revalidateTag, revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { syncChurchFollowMissionary, syncChurchUnfollowMissionary } from "@/lib/affiliationFollowSync";
import {
  validateUpload,
  sanitizeFilename,
  MAX_PROFILE_BYTES,
  MAX_BANNER_BYTES,
  MAX_MEDIA_IMAGE_BYTES,
  MAX_MEDIA_VIDEO_BYTES,
} from "@/lib/uploadValidation";

export type UpdateMissionaryDetailsData = {
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  countryOfResidence?: string;
  destinationCountry: string;
  missionStatus: string;
  openToVisits: boolean;
  visitsStartDate?: string | null;
  visitsEndDate?: string | null;
  agencyId?: number | null;
  sendingChurchId?: number | null;
  missionFieldChurchId?: number | null;
};

/**
 * Update missionary details
 * Handles updating missionaries table and regenerating page_url slug if name changes
 */
export async function updateMissionaryDetails(
  missionaryId: number,
  data: UpdateMissionaryDetailsData,
  originalFirstName: string,
  originalLastName: string
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
    if (!data.destinationCountry || data.destinationCountry.trim() === "") {
      return { success: false, message: "Destination country is required" };
    }
    if (!data.missionStatus || data.missionStatus.trim() === "") {
      return { success: false, message: "Mission status is required" };
    }

    const { data: existingMissionary, error: fetchError } = await supabaseAdmin
      .from("missionaries")
      .select("email, user_id, sending_church_id")
      .eq("id", missionaryId)
      .single();

    if (fetchError || !existingMissionary) {
      return { success: false, message: "Missionary not found" };
    }

    const isManaged = existingMissionary.user_id == null;
    if (!isManaged) {
      if (!data.email || data.email.trim() === "") {
        return { success: false, message: "Email is required" };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return { success: false, message: "Invalid email format" };
      }
    } else if (data.email && data.email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return { success: false, message: "Invalid email format" };
      }
    }

    if (data.email && data.email.trim() !== "" && data.email.trim() !== existingMissionary.email) {
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

    let missionStatus = data.missionStatus;
    if (missionStatus === "On-field") {
      missionStatus = "On-Field";
    } else if (missionStatus === "Furlough") {
      missionStatus = "Furlough";
    } else if (missionStatus === "Deputation") {
      missionStatus = "Deputation";
    }

    const visitsStartDate = data.openToVisits && data.visitsStartDate?.trim()
      ? data.visitsStartDate.trim()
      : null;
    const visitsEndDate = data.openToVisits && data.visitsEndDate?.trim()
      ? data.visitsEndDate.trim()
      : null;

    const updatePayload: {
      first_name: string;
      last_name: string;
      email: string | null;
      phone_number?: string | null;
      country_of_residence?: string | null;
      destination_country: string;
      mission_status: string;
      open_to_visits: boolean;
      visits_start_date?: string | null;
      visits_end_date?: string | null;
      agency_id?: number | null;
      sending_church_id?: number | null;
      mission_field_church_id?: number | null;
    } = {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email: data.email?.trim() || null,
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

    // Update missionaries table
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

    // Check if name changed - if so, regenerate page_url slug
    const nameChanged = 
      data.firstName.trim() !== originalFirstName.trim() || 
      data.lastName.trim() !== originalLastName.trim();

    if (nameChanged) {
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
      
      try {
        // Generate new unique slug
        const newSlug = await generateUniquePageUrl(fullName, supabaseAdmin);

        // Find the associated page record
        const { data: pageRecord, error: pageFetchError } = await supabaseAdmin
          .from("pages")
          .select("id")
          .eq("organization_type", "missionary")
          .eq("organization_id", missionaryId)
          .single();

        if (!pageFetchError && pageRecord) {
          // Update the page_url slug
          const { error: pageUpdateError } = await supabaseAdmin
            .from("pages")
            .update({ page_url: newSlug })
            .eq("id", pageRecord.id);

          if (pageUpdateError) {
            console.error("Error updating page URL:", pageUpdateError);
            // Don't fail the entire operation if page update fails
          }
        }
      } catch (slugError) {
        console.error("Error generating new slug:", slugError);
        // Don't fail the entire operation if slug generation fails
      }
    }

    if (data.email?.trim() && data.email.trim() !== existingMissionary.email && existingMissionary.user_id) {
      await supabaseAdmin
        .from("users")
        .update({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          email: data.email.trim(),
        })
        .eq("user_id", existingMissionary.user_id);
    }

    // Sending church follow sync: when sending church is set, church auto-follows missionary; when removed/changed, unfollow
    const previousSendingChurchId = existingMissionary.sending_church_id ?? null;
    const newSendingChurchId = data.sendingChurchId ?? null;
    if (previousSendingChurchId !== null && previousSendingChurchId !== newSendingChurchId) {
      await syncChurchUnfollowMissionary(missionaryId, previousSendingChurchId);
    }
    if (newSendingChurchId !== null) {
      await syncChurchFollowMissionary(missionaryId, newSendingChurchId);
    }

    // Revalidate cache
    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return { 
      success: true, 
      data: updatedMissionary,
      message: "Missionary details saved successfully!"
    };
  } catch (error) {
    console.error("Error updating missionary details:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

function generateRandomPassword(length: number = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

export async function sendInviteToManagedMissionary(
  missionaryId: number,
  data: { email: string; firstName: string; lastName: string }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email?.trim() || !emailRegex.test(data.email)) {
    return { success: false, message: "Valid email is required" };
  }
  try {
    const { data: missionary, error: mErr } = await supabaseAdmin
      .from("missionaries")
      .select("id, user_id, first_name, last_name, email")
      .eq("id", missionaryId)
      .single();
    if (mErr || !missionary || missionary.user_id) {
      return { success: false, message: "Missionary not found or already has an account" };
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
    const { error: userErr } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: userId,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email: data.email.trim(),
        role: 3,
        status: "Active",
        last_activity: null,
      });
    if (userErr) {
      await adminDeleteUser(userId);
      return { success: false, message: userErr.message || "Failed to create user record" };
    }
    const { error: updateErr } = await supabaseAdmin
      .from("missionaries")
      .update({
        user_id: userId,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        email: data.email.trim(),
      })
      .eq("id", missionaryId);
    if (updateErr) {
      await supabaseAdmin.from("users").delete().eq("user_id", userId);
      await adminDeleteUser(userId);
      return { success: false, message: updateErr.message || "Failed to link missionary" };
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
    revalidateTag("missionaries", {});
    revalidatePath("/admin/missionaries");
    revalidatePath(`/admin/missionaries/${missionaryId}`);
    return { success: true, message: `Activation email sent to ${data.email.trim()}` };
  } catch (error) {
    console.error("sendInviteToManagedMissionary error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Update page details for a missionary
 */
export async function updateMissionaryPageDetails(
  missionaryId: number,
  data: {
    pageUrl?: string;
    pageName?: string;
    pageTemplate?: string;
    profilePhotoUrl?: string;
    bannerPhotoUrl?: string;
    shortQuote?: string;
    aboutText?: string;
    introText?: string;
    templateContent?: string;
    videoHashedId?: string | null;
  }
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Find the associated page record
    const { data: pageRecord, error: pageFetchError } = await supabaseAdmin
      .from("pages")
      .select("id, page_url")
      .eq("organization_type", "missionary")
      .eq("organization_id", missionaryId)
      .single();

    if (pageFetchError || !pageRecord) {
      return { success: false, message: "Page record not found" };
    }

    const updatePayload: {
      page_url?: string;
      name?: string | null;
      page_template?: string | null;
      profile_photo_url?: string | null;
      banner_photo_url?: string | null;
      short_quote?: string | null;
      about_text?: string | null;
      intro_text?: string | null;
      template_content?: string | null;
      video_hashed_id?: string | null;
      updated_at?: string;
    } = {};

    if (data.pageUrl !== undefined) {
      // Validate and generate unique slug if needed
      const slug = data.pageUrl.trim().replace(/^\//, ""); // Remove leading slash
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      
      // Check if slug changed and if it's unique
      if (cleanSlug !== pageRecord.page_url) {
        const { data: existingPage } = await supabaseAdmin
          .from("pages")
          .select("id")
          .eq("page_url", cleanSlug)
          .neq("id", pageRecord.id)
          .maybeSingle();

        if (existingPage) {
          // Generate unique slug with suffix
          const uniqueSlug = await generateUniquePageUrl(cleanSlug, supabaseAdmin);
          updatePayload.page_url = uniqueSlug;
        } else {
          updatePayload.page_url = cleanSlug;
        }
      }
    }

    if (data.pageName !== undefined) {
      updatePayload.name = data.pageName.trim() || null;
    }
    if (data.pageTemplate !== undefined) {
      updatePayload.page_template = data.pageTemplate.trim() || null;
    }
    if (data.profilePhotoUrl !== undefined) {
      updatePayload.profile_photo_url = data.profilePhotoUrl.trim() || null;
    }
    if (data.bannerPhotoUrl !== undefined) {
      updatePayload.banner_photo_url = data.bannerPhotoUrl.trim() || null;
    }
    if (data.shortQuote !== undefined) {
      updatePayload.short_quote = data.shortQuote.trim() || null;
    }
    if (data.aboutText !== undefined) {
      updatePayload.about_text = data.aboutText.trim() || null;
    }
    if (data.introText !== undefined) {
      updatePayload.intro_text = data.introText.trim() || null;
    }
    if (data.templateContent !== undefined) {
      updatePayload.template_content = data.templateContent || null;
    }
    if (data.videoHashedId !== undefined) {
      updatePayload.video_hashed_id = data.videoHashedId || null;
    }

    // Always update updated_at
    updatePayload.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("pages")
      .update(updatePayload)
      .eq("id", pageRecord.id);

    if (updateError) {
      console.error("Error updating page details:", updateError);
      return { success: false, message: updateError.message || "Failed to update page details" };
    }

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return { success: true, message: "Page details saved successfully!" };
  } catch (error) {
    console.error("Error updating page details:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Fetch donations for a missionary page
 */
export async function getMissionaryDonations(pageId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: donations, error } = await supabaseAdmin
      .from("page_donations")
      .select("*")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching donations:", error);
      return { success: false, data: [], message: error.message };
    }

    // Get donor IDs
    const donorIds = (donations || [])
      .map((d: { donor_id?: number }) => d.donor_id)
      .filter((id: number | undefined): id is number => id != null);

    // Fetch donors
    let donorsMap = new Map();
    if (donorIds.length > 0) {
      const { data: donors } = await supabaseAdmin
        .from("donors")
        .select("id, first_name, last_name, email")
        .in("id", donorIds);
      
      if (donors) {
        donorsMap = new Map(donors.map((d: { id: number; first_name?: string; last_name?: string; email?: string }) => [d.id, d]));
      }
    }

    // Map donations with donor info
    const donationsWithDonors = (donations || []).map((donation: {
      id: number;
      transaction_ref?: string;
      created_at: string;
      donor_id?: number;
      amount?: number;
      status?: string;
      type?: string;
      designation?: string | null;
      donor_first_name?: string | null;
      donor_last_name?: string | null;
      donor_email?: string | null;
    }) => {
      const donor = donation.donor_id ? donorsMap.get(donation.donor_id) : null;
      return {
        id: donation.id,
        transaction_ref: donation.transaction_ref || `TXN-${donation.id}`,
        date: donation.created_at,
        donor_id: donation.donor_id || 0,
        donor: donor ? {
          id: donor.id,
          first_name: donor.first_name || "",
          last_name: donor.last_name || "",
          email: donor.email || "",
        } : null,
        donor_first_name: donation.donor_first_name ?? null,
        donor_last_name: donation.donor_last_name ?? null,
        donor_email: donation.donor_email ?? null,
        amount: donation.amount || 0,
        status: donation.status || "Pending",
        type: donation.type || "DONATION",
        designation: donation.designation ?? null,
      };
    });

    return { success: true, data: donationsWithDonors };
  } catch (error) {
    console.error("Error fetching donations:", error);
    return { success: false, data: [], message: "An unexpected error occurred" };
  }
}

/**
 * Get missionary page ID
 */
export async function getMissionaryPageId(missionaryId: number): Promise<number | null> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: page, error } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", "missionary")
      .eq("organization_id", missionaryId)
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
 * Fetch page approvals for a missionary page
 */

/**
 * Publish/Unpublish missionary page
 */
export async function updateMissionaryPagePublishStatus(
  pageId: number,
  isPublished: boolean
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Update pages table
    const { error: pageError } = await supabaseAdmin
      .from("pages")
      .update({
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .eq("id", pageId);

    if (pageError) {
      console.error("Error updating publish status:", pageError);
      return { success: false, message: pageError.message || "Failed to update publish status" };
    }

    if (isPublished) {
      await supabaseAdmin
        .from("pages")
        .update({
          is_review: false,
        })
        .eq("id", pageId);
    }

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return { success: true, message: isPublished ? "Page published successfully!" : "Page unpublished successfully!" };
  } catch (error) {
    console.error("Error updating publish status:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Upload media file or save media URL
 */
export async function uploadMissionaryMedia(
  pageId: number,
  mediaUrl: string,
  mediaType: "image" | "video",
  description?: string,
  thumbnailUrl?: string
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Delete placeholder record if exists
    await supabaseAdmin
      .from("page_media")
      .delete()
      .eq("page_id", pageId)
      .eq("media_url", "placeholder");

    const { data, error } = await supabaseAdmin
      .from("page_media")
      .insert({
        page_id: pageId,
        media_type: mediaType,
        media_url: mediaUrl,
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error uploading media:", error);
      return { success: false, message: error.message || "Failed to upload media" };
    }

    // Update pages table updated_at
    await supabaseAdmin
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", pageId);

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return { success: true, data, message: "Media uploaded successfully!" };
  } catch (error) {
    console.error("Error uploading media:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Update profile or banner photo URL in pages table
 */
export async function updateMissionaryPhoto(
  missionaryId: number,
  photoType: "profile" | "banner",
  photoUrl: string | null
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Find the associated page record
    const { data: pageRecord, error: pageFetchError } = await supabaseAdmin
      .from("pages")
      .select("id, profile_photo_url, banner_photo_url")
      .eq("organization_type", "missionary")
      .eq("organization_id", missionaryId)
      .single();

    if (pageFetchError || !pageRecord) {
      return { success: false, message: "Page record not found" };
    }

    const updatePayload: {
      profile_photo_url?: string | null;
      banner_photo_url?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (photoType === "profile") {
      updatePayload.profile_photo_url = photoUrl;
    } else {
      updatePayload.banner_photo_url = photoUrl;
    }

    const { error: updateError } = await supabaseAdmin
      .from("pages")
      .update(updatePayload)
      .eq("id", pageRecord.id);

    if (updateError) {
      console.error("Error updating photo:", updateError);
      return { success: false, message: updateError.message || "Failed to update photo" };
    }

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");
    revalidatePath(`/admin/missionaries/${missionaryId}`, "page");
    revalidatePath(`/admin/missionaries/${missionaryId}`, "layout");

    return {
      success: true,
      message: `${photoType === "profile" ? "Profile" : "Banner"} photo updated successfully!`,
      data: { ...pageRecord, ...updatePayload },
    };
  } catch (error) {
    console.error("Error updating photo:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Delete media and its file from storage
 */
export async function deleteMissionaryMedia(mediaId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Get media record to find the file URL and thumbnail URL
    const { data: mediaRecord, error: fetchError } = await supabaseAdmin
      .from("page_media")
      .select("media_url, thumbnail_url, page_id")
      .eq("id", mediaId)
      .single();

    if (fetchError || !mediaRecord) {
      return { success: false, message: "Media record not found" };
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from("page_media")
      .delete()
      .eq("id", mediaId);

    if (deleteError) {
      console.error("Error deleting media:", deleteError);
      return { success: false, message: deleteError.message || "Failed to delete media" };
    }

    // Update pages table updated_at
    await supabaseAdmin
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", mediaRecord.page_id);

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return {
      success: true,
      message: "Media deleted successfully!",
      fileUrl: mediaRecord.media_url,
      thumbnailUrl: mediaRecord.thumbnail_url,
    };
  } catch (error) {
    console.error("Error deleting media:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Get media for a missionary page
 */
export async function getMissionaryMedia(pageId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data, error } = await supabaseAdmin
      .from("page_media")
      .select("*")
      .eq("page_id", pageId)
      .neq("media_url", "placeholder") // Exclude placeholder records
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching media:", error);
      return { success: false, data: [], message: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error("Error fetching media:", error);
    return { success: false, data: [], message: "An unexpected error occurred" };
  }
}

/**
 * Create widget
 */
export async function createMissionaryWidget(
  pageId: number,
  widgetType: string,
  widgetTitle: string,
  widgetData: Record<string, unknown>
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Delete placeholder record if exists
    await supabaseAdmin
      .from("page_widgets")
      .delete()
      .eq("page_id", pageId)
      .is("widget_type", null);

    const { data, error } = await supabaseAdmin
      .from("page_widgets")
      .insert({
        page_id: pageId,
        widget_type: widgetType,
        widget_title: widgetTitle,
        widget_data: widgetData,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating widget:", error);
      return { success: false, message: error.message || "Failed to create widget" };
    }

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return { success: true, data, message: "Widget created successfully!" };
  } catch (error) {
    console.error("Error creating widget:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Delete widget
 */
export async function deleteMissionaryWidget(widgetId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { error } = await supabaseAdmin
      .from("page_widgets")
      .delete()
      .eq("id", widgetId);

    if (error) {
      console.error("Error deleting widget:", error);
      return { success: false, message: error.message || "Failed to delete widget" };
    }

    revalidateTag("missionaries", "max");
    revalidatePath("/admin/missionaries", "page");

    return { success: true, message: "Widget deleted successfully!" };
  } catch (error) {
    console.error("Error deleting widget:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Get widgets for a missionary page
 */
export async function getMissionaryWidgets(pageId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data, error } = await supabaseAdmin
      .from("page_widgets")
      .select("*")
      .eq("page_id", pageId)
      .not("widget_type", "is", null) // Exclude placeholder records
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching widgets:", error);
      return { success: false, data: [], message: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error("Error fetching widgets:", error);
    return { success: false, data: [], message: "An unexpected error occurred" };
  }
}

/**
 * Get upload URL for Supabase storage
 */
export async function getUploadUrl(path: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  
  // Return public URL for uploaded file
  return `${supabaseUrl}/storage/v1/object/public/media/${path}`;
}

/**
 * Upload file to Supabase storage using Admin client (bypasses RLS)
 */
export async function uploadFileToStorage(
  entityType: "missionaries" | "agencies" | "churches" | "colleges",
  entityId: number,
  folder: "profile" | "banner" | "media" | "update-letters",
  file: File | Blob,
  existingUrl?: string | null
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  const bucket = "h21-dev";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) {
    return { success: false, error: "NEXT_PUBLIC_SUPABASE_URL is not configured" };
  }

  try {
    const category: "image" | "video" =
      (file.type || "").startsWith("video/") ? "video" : "image";
    let maxBytes: number;
    if (category === "video") {
      maxBytes = MAX_MEDIA_VIDEO_BYTES;
    } else if (folder === "profile") {
      maxBytes = MAX_PROFILE_BYTES;
    } else if (folder === "banner") {
      maxBytes = MAX_BANNER_BYTES;
    } else {
      maxBytes = MAX_MEDIA_IMAGE_BYTES;
    }

    const fileName = file instanceof File ? file.name : "file";
    const validation = await validateUpload(file, {
      category,
      maxBytes,
      filename: fileName,
    });
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    if (existingUrl) {
      const bucketIndex = existingUrl.indexOf(`${bucket}/`);
      if (bucketIndex !== -1) {
        const oldPath = existingUrl.substring(bucketIndex + bucket.length + 1);
        if (oldPath) {
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucket)
            .remove([oldPath]);

          if (deleteError) {
            console.warn("Failed to delete old file:", deleteError);
          }
        }
      }
    }

    const uuid = uuidv4();
    const sanitizedFileName = sanitizeFilename(fileName);
    const newFileName = `${uuid}-${sanitizedFileName}`;

    const path = `${entityType}/${entityId}/${folder}/${newFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return { success: false, error: uploadError.message || "Failed to upload file" };
    }

    // Step 5: Generate public URL
    const publicUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;

    return { success: true, publicUrl };
  } catch (error) {
    console.error("Error in uploadFileToStorage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Delete file from Supabase storage using Admin client (bypasses RLS)
 */
export async function deleteFileFromStorage(
  url: string,
  bucket: string = "h21-dev"
): Promise<{ success: boolean; error?: string }> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Extract path from URL
    const bucketIndex = url.indexOf(`${bucket}/`);
    if (bucketIndex === -1) {
      return { success: false, error: "Invalid URL format" };
    }

    const path = url.substring(bucketIndex + bucket.length + 1);
    if (!path) {
      return { success: false, error: "Invalid URL format" };
    }

    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) {
      console.error("Error deleting file:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteFileFromStorage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Fetch missionary preview data for inline admin preview
 * Includes page data, media, donations, and approval status
 */
export async function getMissionaryPreviewData(missionaryId: number): Promise<{
  success: boolean;
  data?: {
    missionary: {
      id: number;
      first_name: string;
      last_name: string;
      destination_country: string | null;
      user_id: string | null;
      is_managed_by_harvest21: boolean;
      agency?: {
        id: number;
        name: string;
      } | null;
      church?: {
        id: number;
        name: string;
      } | null;
    };
    page: {
      id: number;
      page_url: string;
      name: string | null;
      profile_photo_url: string | null;
      banner_photo_url: string | null;
      short_quote: string | null;
      about_text: string | null;
      intro_text: string | null;
      page_template: string | null;
      template_content: string | null;
      video_hashed_id: string | null;
      donation_percentage: number | null;
      is_published: boolean;
      published_at: string | null;
    };
    media: Array<{
      id: number;
      media_type: "image" | "video";
      media_url: string;
      description?: string | null;
      thumbnail_url?: string | null;
      created_at: string;
    }>;
    widgets: Array<{
      id: number;
      widget_type: string;
      widget_title: string;
      widget_data: Record<string, unknown>;
      created_at: string;
    }>;
    donations?: {
      totalPledged: number;
      totalReceived: number;
    };
    isApproved: boolean;
  };
  error?: string;
}> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Fetch page by missionary ID
    const { data: pageData, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("organization_type", "missionary")
      .eq("organization_id", missionaryId)
      .maybeSingle();

    if (pageError || !pageData) {
      return { success: false, error: "Page not found" };
    }

    // Fetch missionary data
    const { data: missionaryData, error: missionaryError } = await supabaseAdmin
      .from("missionaries")
      .select("id, first_name, last_name, destination_country, agency_id, sending_church_id, mission_field_church_id, user_id, is_managed_by_harvest21")
      .eq("id", missionaryId)
      .single();

    if (missionaryError || !missionaryData) {
      return { success: false, error: "Missionary not found" };
    }

    // Determine church ID (prefer mission_field_church, fallback to sending_church)
    const churchId = missionaryData.mission_field_church_id || missionaryData.sending_church_id;

    // Fetch all related data in parallel
    const [agencyResult, churchResult, mediaResult, widgetsResult, donationsResult] = await Promise.all([
      // Agency
      missionaryData.agency_id
        ? supabaseAdmin.from("agencies").select("id, name").eq("id", missionaryData.agency_id).single()
        : Promise.resolve({ data: null, error: null }),
      
      // Church
      churchId
        ? supabaseAdmin.from("churches").select("id, name").eq("id", churchId).single()
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

    // Extract results
    const agency = agencyResult.data || null;
    const church = churchResult.data || null;
    const mediaData = mediaResult.data || [];
    const widgetsData = widgetsResult.data || [];
    const donations = donationsResult.data || [];

    const totalPledged = donations?.reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0) || 0;
    const totalReceived = donations
      ?.filter((d: { status?: string }) => d.status === "Complete")
      .reduce((sum: number, d: { amount?: number | null }) => sum + (d.amount || 0), 0) || 0;

    const isApproved = pageData.is_published === true;

    return {
      success: true,
      data: {
        missionary: {
          id: missionaryData.id,
          first_name: missionaryData.first_name,
          last_name: missionaryData.last_name,
          destination_country: missionaryData.destination_country,
          user_id: missionaryData.user_id,
          is_managed_by_harvest21: missionaryData.is_managed_by_harvest21 ?? false,
          agency,
          church,
        },
        page: {
          id: pageData.id,
          page_url: pageData.page_url,
          name: pageData.name,
          profile_photo_url: pageData.profile_photo_url,
          banner_photo_url: pageData.banner_photo_url,
          short_quote: pageData.short_quote,
          about_text: pageData.about_text,
          intro_text: pageData.intro_text,
          page_template: (pageData as { page_template?: string | null }).page_template ?? null,
          template_content: pageData.template_content,
          video_hashed_id: pageData.video_hashed_id,
          donation_percentage: pageData.donation_percentage,
          is_published: pageData.is_published,
          published_at: pageData.published_at,
        },
        media: mediaData || [],
        widgets: widgetsData || [],
        donations: {
          totalPledged,
          totalReceived,
        },
        isApproved,
      },
    };
  } catch (error) {
    console.error("Error fetching missionary preview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function getMissionarySocialAdminDiagnostics(missionaryId: number) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();
  const { data: connection } = await supabaseAdmin
    .from("missionary_social_connections")
    .select(
      "facebook_status, instagram_status, facebook_page_name, instagram_username, last_facebook_verified_at, last_instagram_verified_at"
    )
    .eq("missionary_id", missionaryId)
    .maybeSingle();

  const { data: attempts } = await supabaseAdmin
    .from("social_cross_post_attempts")
    .select("platform, status, source_table, source_id, error_detail, updated_at")
    .eq("missionary_id", missionaryId)
    .order("updated_at", { ascending: false })
    .limit(8);

  return {
    connection,
    attempts: attempts || [],
  };
}

