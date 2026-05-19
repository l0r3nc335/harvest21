"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import {
  assertOrgOwnerOrStaff,
  assertPageOwnerOrStaff,
  AuthorizationError,
} from "@/lib/apiAuth";
import { generateUniquePageUrl } from "@/lib/pageHelpers";
import { revalidateTag, revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { updateUserLastActivity } from "@/lib/userActivityHelpers";
import {
  validateUpload,
  sanitizeFilename,
  MAX_PROFILE_BYTES,
  MAX_BANNER_BYTES,
  MAX_MEDIA_IMAGE_BYTES,
  MAX_MEDIA_VIDEO_BYTES,
} from "@/lib/uploadValidation";

export type OrganizationType = "agency" | "college" | "church" | "missionary" | "donor";

function authFail(err: unknown): { success: false; message: string } | null {
  if (err instanceof AuthorizationError) {
    return { success: false, message: err.message };
  }
  return null;
}

export async function getPageByEntity(
  organizationType: OrganizationType,
  organizationId: number
): Promise<{ success: boolean; data?: { id: number; page_url: string; [key: string]: unknown } | null; error?: string }> {
  try {
    await assertOrgOwnerOrStaff(organizationType, organizationId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message };
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data, error } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching page:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || null };
  } catch (error) {
    console.error("Error fetching page:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getOrganizationName(
  organizationType: OrganizationType,
  organizationId: number
): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    await assertOrgOwnerOrStaff(organizationType, organizationId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message };
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    if (organizationType === "missionary") {
      const { data, error } = await supabaseAdmin
        .from("missionaries")
        .select("first_name, last_name")
        .eq("id", organizationId)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || "Missionary not found" };
      }

      const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
      return { success: true, name: name || undefined };
    } else {
      const tableName = organizationType === "agency" ? "agencies" : organizationType === "church" ? "churches" : "colleges";
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select("name")
        .eq("id", organizationId)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || `${organizationType} not found` };
      }

      return { success: true, name: data.name || undefined };
    }
  } catch (error) {
    console.error("Error fetching organization name:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updatePageDetails(
  organizationType: OrganizationType,
  organizationId: number,
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
    /** For missionary pages: support percentage 0–100. Pass null to clear. */
    donationPercentage?: number | null;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertOrgOwnerOrStaff(organizationType, organizationId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return fail;
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: pageRecord, error: pageFetchError } = await supabaseAdmin
      .from("pages")
      .select("id, page_url")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
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
      donation_percentage?: number | null;
      updated_at?: string;
    } = {};

    if (data.pageUrl !== undefined) {
      const slug = data.pageUrl.trim().replace(/^\//, "");
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      
      if (cleanSlug !== pageRecord.page_url) {
        const { data: existingPage } = await supabaseAdmin
          .from("pages")
          .select("id")
          .eq("page_url", cleanSlug)
          .neq("id", pageRecord.id)
          .maybeSingle();

        if (existingPage) {
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
    if (data.donationPercentage !== undefined) {
      const val = data.donationPercentage;
      updatePayload.donation_percentage =
        val === null || val === undefined
          ? null
          : Math.min(100, Math.max(0, Number(val)));
    }

    updatePayload.updated_at = new Date().toISOString();

    const { error: updateError, data: updatedPage } = await supabaseAdmin
      .from("pages")
      .update(updatePayload)
      .eq("id", pageRecord.id)
      .select("name")
      .single();

    if (updateError) {
      console.error("Error updating page details:", updateError);
      return { success: false, message: updateError.message || "Failed to update page details" };
    }

    // Verify the save was successful by checking the returned data
    if (data.pageName !== undefined) {
      const expectedValue = data.pageName.trim() || null;
      const actualValue = updatedPage?.name || null;
      
      // Compare both as null if empty, or compare as strings
      if (expectedValue !== actualValue) {
        console.error("Save verification failed: saved value doesn't match input", {
          expected: expectedValue,
          actual: actualValue
        });
        return { success: false, message: "Save verification failed: value not saved correctly" };
      }
    }

    const getPluralTag = (type: OrganizationType): string => {
      switch (type) {
        case "missionary":
          return "missionaries";
        case "agency":
          return "agencies";
        case "college":
          return "colleges";
        case "church":
          return "churches";
        case "donor":
          return "donors";
        default:
          return `${type}s`;
      }
    };

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    try {
      const supabase = await getSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.id) {
        // Use UUID directly from auth user (this is user_id in public.users)
        await updateUserLastActivity(user.id, true);
      } else {
        // Fallback: get user_id from organization if auth user not available
        let userId: string | null = null;
        if (organizationType === "missionary") {
          const { data: missionary } = await supabaseAdmin
            .from("missionaries")
            .select("user_id")
            .eq("id", organizationId)
            .single();
          userId = missionary?.user_id || null;
        } else if (organizationType === "church") {
          const { data: church } = await supabaseAdmin
            .from("churches")
            .select("contact_user_id")
            .eq("id", organizationId)
            .single();
          userId = church?.contact_user_id || null;
        } else if (organizationType === "agency") {
          const { data: agency } = await supabaseAdmin
            .from("agencies")
            .select("contact_user_id")
            .eq("id", organizationId)
            .single();
          userId = agency?.contact_user_id || null;
        } else if (organizationType === "college") {
          const { data: college } = await supabaseAdmin
            .from("colleges")
            .select("contact_user_id")
            .eq("id", organizationId)
            .single();
          userId = college?.contact_user_id || null;
        }
        
        // Use user_id directly (this is the UUID from auth.users.id)
        if (userId) {
          await updateUserLastActivity(userId, true);
        }
      }
    } catch (error) {
      // Silently fail - don't break page update if activity tracking fails
      console.error("Error updating user activity in updatePageDetails:", error);
    }

    const pluralTag = getPluralTag(organizationType);
    revalidateTag(pluralTag, "max");
    revalidateTag(`page-${organizationType}-${organizationId}`, "max");
    revalidatePath(`/admin/${pluralTag}`, "page");

    return { success: true, message: "Page details saved successfully!" };
  } catch (error) {
    console.error("Error updating page details:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updatePagePhoto(
  organizationType: OrganizationType,
  organizationId: number,
  photoType: "profile" | "banner",
  photoUrl: string | null
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertOrgOwnerOrStaff(organizationType, organizationId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return fail;
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: pageRecord, error: pageFetchError } = await supabaseAdmin
      .from("pages")
      .select("id, profile_photo_url, banner_photo_url")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
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

    const getPluralTag = (type: OrganizationType): string => {
      switch (type) {
        case "missionary":
          return "missionaries";
        case "agency":
          return "agencies";
        case "college":
          return "colleges";
        case "church":
          return "churches";
        case "donor":
          return "donors";
        default:
          return `${type}s`;
      }
    };

    const pluralTag = getPluralTag(organizationType);
    revalidateTag(pluralTag, "max");
    revalidateTag(`page-${organizationType}-${organizationId}`, "max");
    revalidatePath(`/admin/${pluralTag}`, "page");

    return {
      success: true,
      message: `${photoType === "profile" ? "Profile" : "Banner"} photo updated successfully!`,
    };
  } catch (error) {
    console.error("Error updating photo:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export type SocialCrossPostOptions = {
  postToFacebook?: boolean;
  postToInstagram?: boolean;
};

export async function uploadPageMedia(
  pageId: number,
  mediaUrl: string,
  mediaType: "image" | "video",
  description?: string,
  thumbnailUrl?: string,
  hashedId?: string,
  social?: SocialCrossPostOptions
): Promise<{ success: boolean; data?: unknown; message?: string }> {
  try {
    await assertPageOwnerOrStaff(pageId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return fail;
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
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
        hashed_id: hashedId || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error uploading media:", error);
      return { success: false, message: error.message || "Failed to upload media" };
    }

    await supabaseAdmin
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", pageId);

    // Notify followers of new content
    const { notifyMissionaryFollowers } = await import("@/lib/notificationHelpers");
    const contentType = mediaType === "video" ? "video" : "photo";
    await notifyMissionaryFollowers(pageId, contentType, description || undefined, {
      sourceTable: "page_media",
      sourceId: data.id as number,
    });

    if (
      social?.postToFacebook ||
      social?.postToInstagram
    ) {
      const { data: pageRow } = await supabaseAdmin
        .from("pages")
        .select("organization_type, organization_id")
        .eq("id", pageId)
        .single();
      if (pageRow?.organization_type === "missionary") {
        const { scheduleSocialCrossPost } = await import("@/lib/social-cross-post-schedule");
        scheduleSocialCrossPost({
          pageId,
          missionaryId: pageRow.organization_id as number,
          sourceTable: "page_media",
          sourceId: data.id as number,
          kind: mediaType === "video" ? "video" : "photo",
          postToFacebook: !!social.postToFacebook,
          postToInstagram: !!social.postToInstagram,
          textBody: description || "",
          mediaUrl,
          mediaType: mediaType === "video" ? "video" : "image",
        });
      }
    }

    return { success: true, data, message: "Media uploaded successfully!" };
  } catch (error) {
    console.error("Error uploading media:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function deletePageMedia(mediaId: number): Promise<{ success: boolean; message?: string; fileUrl?: string; thumbnailUrl?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: mediaRecord, error: fetchError } = await supabaseAdmin
      .from("page_media")
      .select("media_url, thumbnail_url, page_id")
      .eq("id", mediaId)
      .single();

    if (fetchError || !mediaRecord) {
      return { success: false, message: "Media record not found" };
    }

    try {
      await assertPageOwnerOrStaff(mediaRecord.page_id as number);
    } catch (err) {
      const fail = authFail(err);
      if (fail) return fail;
      throw err;
    }

    const { error: deleteError } = await supabaseAdmin
      .from("page_media")
      .delete()
      .eq("id", mediaId);

    if (deleteError) {
      console.error("Error deleting media:", deleteError);
      return { success: false, message: deleteError.message || "Failed to delete media" };
    }

    await supabaseAdmin
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", mediaRecord.page_id);

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

export async function getPageMedia(pageId: number): Promise<{ success: boolean; data?: unknown[]; message?: string }> {
  try {
    await assertPageOwnerOrStaff(pageId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return { ...fail, data: [] };
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data, error } = await supabaseAdmin
      .from("page_media")
      .select("*")
      .eq("page_id", pageId)
      .neq("media_url", "placeholder")
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

export async function createPageWidget(
  pageId: number,
  widgetType: string,
  widgetTitle: string,
  widgetData: Record<string, unknown>,
  social?: SocialCrossPostOptions
): Promise<{ success: boolean; data?: unknown; message?: string }> {
  try {
    await assertPageOwnerOrStaff(pageId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return fail;
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
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

    if (widgetType === "update_letter") {
      const { notifyMissionaryFollowers } = await import("@/lib/notificationHelpers");
      await notifyMissionaryFollowers(pageId, "update_letter", widgetTitle, {
        sourceTable: "page_widgets",
        sourceId: data.id as number,
      });
      if (social?.postToFacebook || social?.postToInstagram) {
        const { data: pageRow } = await supabaseAdmin
          .from("pages")
          .select("organization_type, organization_id")
          .eq("id", pageId)
          .single();
        if (pageRow?.organization_type === "missionary") {
          const thumb = typeof widgetData.thumbnail_url === "string" ? widgetData.thumbnail_url : "";
          const desc = typeof widgetData.description === "string" ? widgetData.description : "";
          const textBody = [widgetTitle, desc].filter(Boolean).join("\n\n");
          const { scheduleSocialCrossPost } = await import("@/lib/social-cross-post-schedule");
          scheduleSocialCrossPost({
            pageId,
            missionaryId: pageRow.organization_id as number,
            sourceTable: "page_widgets",
            sourceId: data.id as number,
            kind: "update_letter",
            postToFacebook: !!social.postToFacebook,
            postToInstagram: !!social.postToInstagram,
            textBody,
            mediaUrl: thumb || null,
            mediaType: "image",
          });
        }
      }
    }

    if (widgetType === "text_update") {
      const { notifyMissionaryFollowers } = await import("@/lib/notificationHelpers");
      await notifyMissionaryFollowers(pageId, "text_update", widgetTitle, {
        sourceTable: "page_widgets",
        sourceId: data.id as number,
      });
      if (social?.postToFacebook) {
        const { data: pageRow } = await supabaseAdmin
          .from("pages")
          .select("organization_type, organization_id")
          .eq("id", pageId)
          .single();
        if (pageRow?.organization_type === "missionary") {
          const body = typeof widgetData.body === "string" ? widgetData.body : "";
          const { scheduleSocialCrossPost } = await import("@/lib/social-cross-post-schedule");
          scheduleSocialCrossPost({
            pageId,
            missionaryId: pageRow.organization_id as number,
            sourceTable: "page_widgets",
            sourceId: data.id as number,
            kind: "text_update",
            postToFacebook: true,
            postToInstagram: false,
            textBody: body || widgetTitle,
          });
        }
      }
    }

    return { success: true, data, message: "Widget created successfully!" };
  } catch (error) {
    console.error("Error creating widget:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function deletePageWidget(widgetId: number): Promise<{ success: boolean; message?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: widget } = await supabaseAdmin
      .from("page_widgets")
      .select("page_id")
      .eq("id", widgetId)
      .maybeSingle();

    if (!widget) {
      return { success: false, message: "Widget not found" };
    }

    try {
      await assertPageOwnerOrStaff(widget.page_id as number);
    } catch (err) {
      const fail = authFail(err);
      if (fail) return fail;
      throw err;
    }

    const { error } = await supabaseAdmin
      .from("page_widgets")
      .delete()
      .eq("id", widgetId);

    if (error) {
      console.error("Error deleting widget:", error);
      return { success: false, message: error.message || "Failed to delete widget" };
    }

    return { success: true, message: "Widget deleted successfully!" };
  } catch (error) {
    console.error("Error deleting widget:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getPageWidgets(pageId: number): Promise<{ success: boolean; data?: unknown[]; message?: string }> {
  try {
    await assertPageOwnerOrStaff(pageId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return { ...fail, data: [] };
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data, error } = await supabaseAdmin
      .from("page_widgets")
      .select("*")
      .eq("page_id", pageId)
      .not("widget_type", "is", null)
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

export async function updatePagePublishStatus(
  organizationType: OrganizationType,
  pageId: number,
  isPublished: boolean
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertPageOwnerOrStaff(pageId);
  } catch (err) {
    const fail = authFail(err);
    if (fail) return fail;
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { error: pageError } = await supabaseAdmin
      .from("pages")
      .update({
        is_published: isPublished,
        is_review: isPublished ? false : null,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .eq("id", pageId);

    if (pageError) {
      console.error("Error updating publish status:", pageError);
      return { success: false, message: pageError.message || "Failed to update publish status" };
    }


    const getPluralTag = (type: OrganizationType): string => {
      switch (type) {
        case "missionary":
          return "missionaries";
        case "agency":
          return "agencies";
        case "college":
          return "colleges";
        case "church":
          return "churches";
        case "donor":
          return "donors";
        default:
          return `${type}s`;
      }
    };

    const pluralTag = getPluralTag(organizationType);
    const { data: pageRecord } = await supabaseAdmin
      .from("pages")
      .select("organization_id")
      .eq("id", pageId)
      .single();
    
    const orgId = pageRecord?.organization_id;
    revalidateTag(pluralTag, "max");
    revalidateTag(`page-${organizationType}-${orgId}`, "max");
    revalidatePath(`/admin/${pluralTag}`, "page");

    return { success: true, message: isPublished ? "Page published successfully!" : "Page unpublished successfully!" };
  } catch (error) {
    console.error("Error updating publish status:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function uploadFileToStorage(
  organizationType: OrganizationType,
  organizationId: number,
  folder: "profile" | "banner" | "media" | "update-letters" | "videos",
  file: File | Blob,
  existingUrl?: string | null
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    await assertOrgOwnerOrStaff(organizationType, organizationId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message };
    throw err;
  }
  const supabaseAdmin = await getSupabaseServer();
  const bucket = "h21-dev";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) {
    return { success: false, error: "NEXT_PUBLIC_SUPABASE_URL is not configured" };
  }

  const getPluralType = (type: OrganizationType): string => {
    switch (type) {
      case "missionary":
        return "missionaries";
      case "agency":
        return "agencies";
      case "college":
        return "colleges";
      case "church":
        return "churches";
      case "donor":
        return "donors";
      default:
        return `${type}s`;
    }
  };

  try {
    const category: "image" | "video" =
      (file.type || "").startsWith("video/") || folder === "videos" ? "video" : "image";
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

    const path = `${getPluralType(organizationType)}/${organizationId}/${folder}/${newFileName}`;

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

export async function deleteFileFromStorage(
  url: string,
  bucket: string = "h21-dev"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  const supabaseAdmin = await getSupabaseServer();

  try {
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

