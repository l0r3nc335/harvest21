import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import {
  validateUpload,
  sanitizeFilename,
  MAX_PROFILE_BYTES,
  MAX_BANNER_BYTES,
  MAX_MEDIA_IMAGE_BYTES,
  MAX_MEDIA_VIDEO_BYTES,
} from "@/lib/uploadValidation";

type SupabaseClient = ReturnType<typeof createClient>;

function maxBytesFor(folder: "profile" | "banner" | "media"): number {
  if (folder === "profile") return MAX_PROFILE_BYTES;
  if (folder === "banner") return MAX_BANNER_BYTES;
  return MAX_MEDIA_IMAGE_BYTES;
}

function categoryFor(file: File | Blob): "image" | "video" {
  return (file.type || "").startsWith("video/") ? "video" : "image";
}

function maxBytesForCategory(
  folder: "profile" | "banner" | "media",
  category: "image" | "video"
): number {
  if (category === "video") return MAX_MEDIA_VIDEO_BYTES;
  return maxBytesFor(folder);
}

type ReplaceAndSaveFileParams = {
  entityType: "missionaries" | "agencies" | "churches" | "colleges";
  entityId: number;
  folder: "profile" | "banner" | "media";
  file: File;
  existingUrl?: string | null;
  supabase: SupabaseClient;
};

/**
 * Safely replaces a file by:
 * 1. Deleting the old file if it exists
 * 2. Uploading the new file with UUID-based filename
 * 3. Returning the public URL
 */
export async function replaceAndSaveFile({
  entityType,
  entityId,
  folder,
  file,
  existingUrl,
  supabase,
}: ReplaceAndSaveFileParams): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  const bucket = "h21-dev";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) {
    return { success: false, error: "NEXT_PUBLIC_SUPABASE_URL is not configured" };
  }

  try {
    const category = categoryFor(file);
    const validation = await validateUpload(file, {
      category,
      maxBytes: maxBytesForCategory(folder, category),
      filename: file.name,
    });
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    if (existingUrl) {
      const bucketIndex = existingUrl.indexOf(`${bucket}/`);
      if (bucketIndex !== -1) {
        const oldPath = existingUrl.substring(bucketIndex + bucket.length + 1);
        if (oldPath) {
          const { error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([oldPath]);

          if (deleteError) {
            console.warn("Failed to delete old file:", deleteError);
          }
        }
      }
    }

    const uuid = uuidv4();
    const sanitizedFileName = sanitizeFilename(file.name);
    const newFileName = `${uuid}-${sanitizedFileName}`;

    const path = `${entityType}/${entityId}/${folder}/${newFileName}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
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
    console.error("Error in replaceAndSaveFile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Extract file path from a Supabase storage URL
 */
export function extractFilePathFromUrl(url: string, bucket: string = "h21-dev"): string | null {
  const bucketIndex = url.indexOf(`${bucket}/`);
  if (bucketIndex === -1) return null;
  return url.substring(bucketIndex + bucket.length + 1);
}

/**
 * Delete a file from Supabase storage by URL
 */
export async function deleteFileFromStorage(
  url: string,
  bucket: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const path = extractFilePathFromUrl(url, bucket);
    if (!path) {
      return { success: false, error: "Invalid URL format" };
    }

    const { error } = await supabase.storage.from(bucket).remove([path]);
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

