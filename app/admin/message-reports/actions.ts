"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff, AuthorizationError } from "@/lib/apiAuth";

export async function updateReportStatus(
  reportId: number,
  status: "pending" | "reviewed" | "resolved"
): Promise<{ success: boolean; error?: string }> {
  let user;
  try {
    user = await assertAdminOrStaff();
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("message_reports")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", reportId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
