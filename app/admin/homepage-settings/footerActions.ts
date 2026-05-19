"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidatePath } from "next/cache";
import { FooterContent, FooterPageType } from "@/types/homepage";

// ============= FOOTER CONTENT =============

/**
 * Fetch footer content by page type
 */
export async function fetchFooterContent(pageType: FooterPageType) {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from("footer_content")
    .select("*")
    .eq("page_type", pageType)
    .single();

  if (error) {
    console.error(`Error fetching ${pageType} content:`, error);
    return { success: false, error: error.message, data: null };
  }

  return { success: true, data: data as FooterContent };
}

/**
 * Update footer content
 */
export async function updateFooterContent(
  pageType: FooterPageType,
  title: string,
  content: string,
  userId?: string
) {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  const updateData: {
    title: string;
    content: string;
    updated_at: string;
    updated_by?: string;
  } = {
    title,
    content,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    updateData.updated_by = userId;
  }

  const { data, error} = await supabaseAdmin
    .from("footer_content")
    .update(updateData)
    .eq("page_type", pageType)
    .select()
    .single();

  if (error) {
    console.error("Error updating footer content:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/homepage-settings");
  revalidatePath(`/${pageType.replace('_', '-')}`);

  return { success: true, data };
}

