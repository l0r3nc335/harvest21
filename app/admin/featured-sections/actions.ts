"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidatePath } from "next/cache";

const PATHS = ["/admin/featured-sections", "/"] as const;

function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

export async function createSection(data: {
  title: string;
  description?: string;
  is_active?: boolean;
}) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();

    const { count, error: countError } = await supabase
      .from("homepage_featured_sections")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    if ((count ?? 0) >= 3) {
      return { success: false, data: null, error: "Maximum of 3 featured sections allowed." };
    }

    const { data: maxData } = await supabase
      .from("homepage_featured_sections")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxData?.display_order ?? -1) + 1;

    const { data: section, error } = await supabase
      .from("homepage_featured_sections")
      .insert({
        title: data.title,
        description: data.description ?? null,
        is_active: data.is_active ?? true,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    revalidateAll();
    return { success: true, data: section, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to create section",
    };
  }
}

export async function updateSection(
  id: number,
  data: { title?: string; description?: string | null; is_active?: boolean }
) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { data: section, error } = await supabase
      .from("homepage_featured_sections")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidateAll();
    return { success: true, data: section, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to update section",
    };
  }
}

export async function deleteSection(id: number) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("homepage_featured_sections")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidateAll();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete section",
    };
  }
}

export async function addProfile(
  sectionId: number,
  pageId: number,
  profileType: 'missionary' | 'church' | 'agency'
) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();

    const { data: maxData } = await supabase
      .from("homepage_section_profiles")
      .select("display_order")
      .eq("section_id", sectionId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxData?.display_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("homepage_section_profiles")
      .insert({
        section_id: sectionId,
        profile_id: pageId,
        profile_type: profileType,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    revalidateAll();
    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to add profile",
    };
  }
}

export async function removeProfile(sectionProfileId: number) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("homepage_section_profiles")
      .delete()
      .eq("id", sectionProfileId);

    if (error) throw error;

    revalidateAll();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove profile",
    };
  }
}

export async function reorderSections(orderedIds: number[]) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("homepage_featured_sections")
          .update({ display_order: index, updated_at: new Date().toISOString() })
          .eq("id", id)
      )
    );

    revalidateAll();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder sections",
    };
  }
}

export async function reorderProfiles(orderedIds: number[]) {
  try {
    await assertAdminOrStaff();
    const supabase = await getSupabaseServer();
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("homepage_section_profiles")
          .update({ display_order: index })
          .eq("id", id)
      )
    );

    revalidateAll();
    return { success: true, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder profiles",
    };
  }
}
