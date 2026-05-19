"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export async function togglePhotoReaction(
  photoId: number
): Promise<{ success: boolean; data?: { has_reacted: boolean; reaction_count: number }; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    // Check if reaction exists
    const { data: existingReaction } = await supabaseAdmin
      .from("page_media_reactions")
      .select("id")
      .eq("media_id", photoId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    // Get current reaction count
    const { data: media } = await supabaseAdmin
      .from("page_media")
      .select("reaction_count")
      .eq("id", photoId)
      .single();

    const currentCount = media?.reaction_count || 0;

    if (existingReaction) {
      // Remove reaction
      const { error: deleteError } = await supabaseAdmin
        .from("page_media_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      const newCount = Math.max(0, currentCount - 1);

      await supabaseAdmin
        .from("page_media")
        .update({ reaction_count: newCount })
        .eq("id", photoId);

      return {
        success: true,
        data: { has_reacted: false, reaction_count: newCount },
      };
    } else {
      // Add reaction
      const { error: insertError } = await supabaseAdmin
        .from("page_media_reactions")
        .insert({
          media_id: photoId,
          user_id: session.user.id,
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      const newCount = currentCount + 1;

      await supabaseAdmin
        .from("page_media")
        .update({ reaction_count: newCount })
        .eq("id", photoId);

      return {
        success: true,
        data: { has_reacted: true, reaction_count: newCount },
      };
    }
  } catch (error) {
    console.error("Error toggling photo reaction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function incrementPhotoView(
  photoId: number
): Promise<{ success: boolean; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: media } = await supabaseAdmin
      .from("page_media")
      .select("view_count")
      .eq("id", photoId)
      .single();

    const currentCount = media?.view_count || 0;

    await supabaseAdmin
      .from("page_media")
      .update({ view_count: currentCount + 1 })
      .eq("id", photoId);

    return { success: true };
  } catch (error) {
    console.error("Error incrementing photo view:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sharePhoto(
  photoId: number
): Promise<{ success: boolean; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: media } = await supabaseAdmin
      .from("page_media")
      .select("share_count")
      .eq("id", photoId)
      .single();

    const currentCount = media?.share_count || 0;

    await supabaseAdmin
      .from("page_media")
      .update({ share_count: currentCount + 1 })
      .eq("id", photoId);

    return { success: true };
  } catch (error) {
    console.error("Error sharing photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updatePhoto(
  photoId: number,
  description: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { error: updateError } = await supabaseAdmin
      .from("page_media")
      .update({ description: description || null, updated_at: new Date().toISOString() })
      .eq("id", photoId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Error updating photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deletePhoto(
  photoId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    // Get media record with page_id
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("page_media")
      .select("page_id, media_url, thumbnail_url")
      .eq("id", photoId)
      .single();

    if (mediaError || !media) {
      return { success: false, error: "Photo not found" };
    }

    // Get page with organization info
    const { data: page, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("organization_type, organization_id")
      .eq("id", media.page_id)
      .single();

    if (pageError || !page) {
      return { success: false, error: "Page not found" };
    }

    // Check if user owns the organization
    let isOwner = false;
    const { organization_type, organization_id } = page;

    if (organization_type === "missionary") {
      const { data: missionary } = await supabaseAdmin
        .from("missionaries")
        .select("user_id")
        .eq("id", organization_id)
        .single();
      isOwner = missionary?.user_id === session.user.id;
    } else if (organization_type === "agency") {
      const { data: agency } = await supabaseAdmin
        .from("agencies")
        .select("contact_user_id")
        .eq("id", organization_id)
        .single();
      isOwner = agency?.contact_user_id === session.user.id;
    } else if (organization_type === "church") {
      const { data: church } = await supabaseAdmin
        .from("churches")
        .select("contact_user_id")
        .eq("id", organization_id)
        .single();
      isOwner = church?.contact_user_id === session.user.id;
    } else if (organization_type === "college") {
      const { data: college } = await supabaseAdmin
        .from("colleges")
        .select("contact_user_id")
        .eq("id", organization_id)
        .single();
      isOwner = college?.contact_user_id === session.user.id;
    }

    if (!isOwner) {
      return { success: false, error: "You don't have permission to delete this photo" };
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from("page_media")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Update page updated_at
    await supabaseAdmin
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", media.page_id);

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Error deleting photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

