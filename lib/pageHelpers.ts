"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

type SupabaseClient = ReturnType<typeof createClient>;

type OrganizationType = "agency" | "college" | "church" | "missionary";

/**
 * Generates a clean, URL-friendly slug from an entity name
 * @param name - The entity name to convert to a slug
 * @returns A clean slug (e.g., "Ajay Pogi" -> "ajay-pogi")
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}

/**
 * Generates a unique slug for an entity and validates it doesn't already exist.
 * - Base slug is derived from the name (e.g. "First Baptist Church" → "first-baptist-church")
 * - If a duplicate exists, a simple numeric suffix is appended ("first-baptist-church-2", "-3", etc.)
 * @param name - The entity name to generate slug from
 * @param supabase - Supabase admin client
 * @returns The unique slug (e.g., "ajay-pogi" or "ajay-pogi-2" if duplicate)
 */
export async function generateUniquePageUrl(
  name: string,
  supabase: SupabaseClient
): Promise<string> {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  while (attempts < maxAttempts) {
    // Check if slug already exists in pages table
    const { data: existing, error: checkError } = await supabase
      .from("pages")
      .select("id")
      .eq("page_url", slug)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      console.error("Error checking page URL:", checkError);
      throw new Error("Failed to validate page URL");
    }

    if (!existing) {
      // Slug is unique, we can use it
      return slug;
    }

    // Slug exists, append simple numeric suffix: -2, -3, ...
    attempts += 1;
    slug = `${baseSlug}-${attempts + 1}`;
  }

  throw new Error("Failed to generate unique slug after multiple attempts");
}

/**
 * Creates a page record and related records (page_widgets, page_media)
 * for a newly created entity (agency, college, church, or missionary).
 * 
 * @param entityType - The type of organization ('agency', 'college', 'church', 'missionary')
 * @param entityId - The ID of the newly created entity
 * @param requestedByUserId - The user ID who requested the page creation
 * @param pageUrl - The unique page slug for this entity (e.g., "ajay-pogi", not a full URL)
 * @returns Object with success status and created page ID, or error message
 */
export async function createPageForEntity(
  entityType: OrganizationType,
  entityId: number,
  requestedByUserId: string,
  pageUrl: string
): Promise<{ success: boolean; pageId?: number; message?: string }> {
  void requestedByUserId;
  const supabase = await getSupabaseServer();

  try {
    const { data: newPage, error: pageError } = await supabase
      .from("pages")
      .insert({
        organization_type: entityType,
        organization_id: entityId,
        page_url: pageUrl, // Store only the slug (e.g., "ajay-pogi")
        profile_photo_url: null,
        banner_photo_url: null,
        short_quote: null,
        about_text: null,
        intro_text: null,
        is_published: false,
        published_at: null,
      })
      .select()
      .single();

    if (pageError || !newPage) {
      console.error("Error creating page:", pageError);
      return {
        success: false,
        message: pageError?.message || "Failed to create page record",
      };
    }

    const pageId = newPage.id;

    // Step 2: Create default page_widgets record (optional placeholder)
    // Note: All fields are nullable, so we can create an empty placeholder
    const { error: widgetsError } = await supabase
      .from("page_widgets")
      .insert({
        page_id: pageId,
        widget_type: null,
        widget_title: null,
        widget_data: null,
      });

    if (widgetsError) {
      console.error("Error creating page_widgets:", widgetsError);
      // Clean up: delete the page if widgets creation fails
      await supabase.from("pages").delete().eq("id", pageId);
      return {
        success: false,
        message: widgetsError.message || "Failed to create page widgets",
      };
    }

    // Step 3: Create default page_media record (optional placeholder)
    // Note: media_url is NOT NULL, so we use a placeholder URL
    const { error: mediaError } = await supabase
      .from("page_media")
      .insert({
        page_id: pageId,
        media_type: null,
        media_url: "placeholder", // Required field, using placeholder value
      });

    if (mediaError) {
      console.error("Error creating page_media:", mediaError);
      // Clean up: delete page and widgets if media creation fails
      await supabase.from("page_widgets").delete().eq("page_id", pageId);
      await supabase.from("pages").delete().eq("id", pageId);
      return {
        success: false,
        message: mediaError.message || "Failed to create page media",
      };
    }


    return {
      success: true,
      pageId: pageId,
    };
  } catch (error) {
    console.error("Unexpected error creating page for entity:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating page records",
    };
  }
}

