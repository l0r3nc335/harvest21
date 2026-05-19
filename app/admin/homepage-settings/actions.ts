"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff, AuthorizationError } from "@/lib/apiAuth";
import { BannerFormData, HomepageSettings } from "@/types/homepage";
import { revalidatePath } from "next/cache";
import {
  validateUpload,
  sanitizeFilename,
  MAX_BANNER_BYTES,
} from "@/lib/uploadValidation";
import { reportServerError } from "@/lib/errorReporting";

function authFailure(error: unknown) {
  if (error instanceof AuthorizationError) {
    return {
      success: false as const,
      data: null,
      error: error.message,
    };
  }
  return null;
}

export async function createBanner(formData: BannerFormData) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("homepage_banners")
      .insert({
        location: formData.location,
        description: formData.description,
        image_url: formData.image_url,
        is_active: formData.is_active,
        display_order: formData.display_order,
        scroll_duration: formData.scroll_duration || 5000,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/admin/homepage-settings");
    revalidatePath("/");

    return { success: true, data, error: null };
  } catch (error: unknown) {
    const authResult = authFailure(error);
    if (authResult) return authResult;
    const { incidentId } = reportServerError(error, { path: "createBanner" });
    return {
      success: false,
      data: null,
      error: `Failed to create banner (incident ${incidentId})`,
    };
  }
}

export async function updateBanner(id: number, formData: Partial<BannerFormData>) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (formData.location !== undefined) updateData.location = formData.location;
    if (formData.description !== undefined) updateData.description = formData.description;
    if (formData.image_url !== undefined) updateData.image_url = formData.image_url;
    if (formData.is_active !== undefined) updateData.is_active = formData.is_active;
    if (formData.display_order !== undefined) updateData.display_order = formData.display_order;
    if (formData.scroll_duration !== undefined) updateData.scroll_duration = formData.scroll_duration;

    const { data, error } = await supabase
      .from("homepage_banners")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/admin/homepage-settings");
    revalidatePath("/");

    return { success: true, data, error: null };
  } catch (error: unknown) {
    const authResult = authFailure(error);
    if (authResult) return authResult;
    const { incidentId } = reportServerError(error, { path: "updateBanner" });
    return {
      success: false,
      data: null,
      error: `Failed to update banner (incident ${incidentId})`,
    };
  }
}

export async function deleteBanner(id: number) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("homepage_banners")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/admin/homepage-settings");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    const { incidentId } = reportServerError(error, { path: "deleteBanner" });
    return {
      success: false,
      error: `Failed to delete banner (incident ${incidentId})`,
    };
  }
}

export async function toggleBannerActive(id: number, isActive: boolean) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("homepage_banners")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/admin/homepage-settings");
    revalidatePath("/");

    return { success: true, data, error: null };
  } catch (error: unknown) {
    const authResult = authFailure(error);
    if (authResult) return authResult;
    const { incidentId } = reportServerError(error, { path: "toggleBannerActive" });
    return {
      success: false,
      data: null,
      error: `Failed to toggle banner (incident ${incidentId})`,
    };
  }
}

export async function reorderBanners(bannerIds: number[]) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const updates = bannerIds.map((id, index) =>
      supabase
        .from("homepage_banners")
        .update({ display_order: index + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
    );

    await Promise.all(updates);

    revalidatePath("/admin/homepage-settings");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    const { incidentId } = reportServerError(error, { path: "reorderBanners" });
    return {
      success: false,
      error: `Failed to reorder banners (incident ${incidentId})`,
    };
  }
}

export async function updateHomepageSettings(settings: Partial<HomepageSettings>) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("homepage_settings")
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/admin/homepage-settings");
    revalidatePath("/");

    return { success: true, data, error: null };
  } catch (error: unknown) {
    const authResult = authFailure(error);
    if (authResult) return authResult;
    const { incidentId } = reportServerError(error, { path: "updateHomepageSettings" });
    return {
      success: false,
      data: null,
      error: `Failed to update settings (incident ${incidentId})`,
    };
  }
}

export async function uploadBannerImage(file: File) {
  try {
    await assertAdminOrStaff();
    const validation = await validateUpload(file, {
      category: "image",
      maxBytes: MAX_BANNER_BYTES,
      filename: file.name,
    });
    if (!validation.ok) {
      return { success: false, url: null, error: validation.error };
    }

    const supabase = await getSupabaseServer();
    const safeName = sanitizeFilename(file.name);
    const fileName = `banner-${Date.now()}-${safeName}`;
    const filePath = `assets/banner/${fileName}`;

    const { error } = await supabase.storage
      .from("h21-dev")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("h21-dev")
      .getPublicUrl(filePath);

    return { success: true, url: urlData.publicUrl, error: null };
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return { success: false, url: null, error: error.message };
    }
    const { incidentId } = reportServerError(error, { path: "uploadBannerImage" });
    return {
      success: false,
      url: null,
      error: `Failed to upload image (incident ${incidentId})`,
    };
  }
}
