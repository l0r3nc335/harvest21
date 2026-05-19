"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { v4 as uuidv4 } from "uuid";
import type { ActionResult } from "@/types/supporter";
import {
  validateUpload,
  sanitizeFilename,
  MAX_PROFILE_BYTES,
} from "@/lib/uploadValidation";

export async function uploadSupporterProfilePhoto(
  file: File | Blob,
  existingUrl?: string | null
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();
  const supabase = await getSupabaseServer();
  const bucket = "h21-dev";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) {
    return { success: false, error: "NEXT_PUBLIC_SUPABASE_URL is not configured" };
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const validation = await validateUpload(file, {
      category: "image",
      maxBytes: MAX_PROFILE_BYTES,
      filename: file instanceof File ? file.name : undefined,
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

    const fileName = file instanceof File ? file.name : "profile.jpg";
    const uuid = uuidv4();
    const sanitizedFileName = sanitizeFilename(fileName);
    const newFileName = `${uuid}-${sanitizedFileName}`;

    const path = `supporters/${user.id}/profile/${newFileName}`;

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
    console.error("Error in uploadSupporterProfilePhoto:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateSupporterProfilePhoto(photoUrl: string | null): Promise<ActionResult> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("supporter_profiles")
      .update({
        profile_photo_url: photoUrl,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating profile photo:", error);
      return { success: false, error: "Failed to update profile photo" };
    }

    return { success: true, message: "Profile photo updated successfully" };
  } catch (error) {
    console.error("Error in updateSupporterProfilePhoto:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function deleteSupporterProfilePhoto(photoUrl: string): Promise<ActionResult> {
  const supabaseAdmin = await getSupabaseServer();
  const supabase = await getSupabaseServer();
  const bucket = "h21-dev";

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const bucketIndex = photoUrl.indexOf(`${bucket}/`);
    if (bucketIndex !== -1) {
      const filePath = photoUrl.substring(bucketIndex + bucket.length + 1);
      if (filePath) {
        const { error: deleteError } = await supabaseAdmin.storage
          .from(bucket)
          .remove([filePath]);

        if (deleteError) {
          console.error("Failed to delete file:", deleteError);
          return { success: false, error: "Failed to delete file from storage" };
        }
      }
    }

    const { error } = await supabase
      .from("supporter_profiles")
      .update({
        profile_photo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error removing profile photo:", error);
      return { success: false, error: "Failed to remove profile photo" };
    }

    return { success: true, message: "Profile photo removed successfully" };
  } catch (error) {
    console.error("Error in deleteSupporterProfilePhoto:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

