"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { revalidatePath } from "next/cache";
import type { ChurchAboutUsContent } from "@/types/church";

/**
 * Save church About Us content (CHLP-005)
 * Stores content in template_content as JSON with 7 fixed sections
 */
export async function saveChurchAboutUs(
  churchId: number,
  content: ChurchAboutUsContent,
  videoHashedId: string | null
): Promise<{ success: boolean; error?: string }> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Validate all sections are completed
    const allSectionsComplete = Object.values(content).every((value) => value.trim().length > 0);
    if (!allSectionsComplete) {
      return {
        success: false,
        error: "All sections must be completed before saving",
      };
    }

    // Serialize content to JSON
    const templateContent = JSON.stringify(content);

    // Find existing page for this church
    const { data: existingPage, error: fetchError } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", "church")
      .eq("organization_id", churchId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(fetchError.message);
    }

    if (existingPage) {
      // Update existing page
      const { error: updateError } = await supabaseAdmin
        .from("pages")
        .update({
          template_content: templateContent,
          video_hashed_id: videoHashedId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPage.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      // This shouldn't happen if church was created properly, but handle it
      return {
        success: false,
        error: "No page found for this church. Please contact support.",
      };
    }

    revalidatePath(`/admin/churches/${churchId}`);
    revalidatePath("/admin/churches");

    return { success: true };
  } catch (error) {
    console.error("Error saving church about us:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save content",
    };
  }
}

/**
 * Submit church page for review (CHLP-006)
 */
export async function submitChurchPageForReview(
  churchId: number
): Promise<{ success: boolean; error?: string }> {
  await assertAdminOrStaff();
  const supabaseAdmin = await getSupabaseServer();

  try {
    // Get the church page
    const { data: page, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("id, template_content")
      .eq("organization_type", "church")
      .eq("organization_id", churchId)
      .single();

    if (pageError || !page) {
      return {
        success: false,
        error: "Church page not found",
      };
    }

    // Validate content is complete
    if (!page.template_content) {
      return {
        success: false,
        error: "Please complete all About Us sections before submitting",
      };
    }

    let content: ChurchAboutUsContent;
    try {
      content = JSON.parse(page.template_content);
    } catch {
      return {
        success: false,
        error: "Invalid content format",
      };
    }

    const allSectionsComplete = Object.values(content).every((value) => value?.trim().length > 0);
    if (!allSectionsComplete) {
      return {
        success: false,
        error: "All About Us sections must be completed before submission",
      };
    }

    // Create or update page approval request
    const { error: approvalError } = await supabaseAdmin
      .from("page_approvals")
      .insert({
        page_id: page.id,
        status: "Pending",
        created_at: new Date().toISOString(),
      });

    if (approvalError) {
      // If already exists, update it
      if (approvalError.code === "23505") {
        const { error: updateError } = await supabaseAdmin
          .from("page_approvals")
          .update({
            status: "Pending",
            reviewed_at: null,
            approved_by: null,
          })
          .eq("page_id", page.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        throw new Error(approvalError.message);
      }
    }

    revalidatePath(`/admin/churches/${churchId}`);
    revalidatePath("/admin/churches");

    return { success: true };
  } catch (error) {
    console.error("Error submitting church page for review:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit for review",
    };
  }
}

