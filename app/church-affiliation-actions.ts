"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { syncChurchFollowMissionary, syncChurchUnfollowMissionary } from "@/lib/affiliationFollowSync";

export type AffiliatedChurch = {
  id: number;
  church_id: number;
  church_name: string;
  created_at: string;
};

export async function getAffiliatedChurches(missionaryId: number): Promise<{
  success: boolean;
  data?: AffiliatedChurch[];
  error?: string;
}> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data, error } = await supabaseAdmin
      .from("missionary_churches")
      .select(`
        id,
        church_id,
        created_at,
        churches:church_id (
          id,
          name
        )
      `)
      .eq("missionary_id", missionaryId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching affiliated churches:", error);
      return { success: false, error: error.message };
    }

    const affiliatedChurches = (data || []).map((item: {
      id: number;
      church_id: number;
      created_at: string;
      churches: { id: number; name: string } | null;
    }) => ({
      id: item.id,
      church_id: item.church_id,
      church_name: item.churches?.name || "Unknown Church",
      created_at: item.created_at,
    }));

    return { success: true, data: affiliatedChurches };
  } catch (error) {
    console.error("Error in getAffiliatedChurches:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function searchAvailableChurches(
  missionaryId: number,
  query: string,
  excludeIds: number[] = []
): Promise<{ id: number; name: string }[]> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    let churchQuery = supabaseAdmin
      .from("churches")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(20);

    if (query && query.trim().length > 0) {
      churchQuery = churchQuery.ilike("name", `%${query.trim()}%`);
    }

    if (excludeIds.length > 0) {
      churchQuery = churchQuery.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await churchQuery;

    if (error) {
      console.error("Error searching churches:", error);
      return [];
    }

    return (data || []).map((church: { id: number; name: string }) => ({
      id: church.id,
      name: church.name,
    }));
  } catch (error) {
    console.error("Error in searchAvailableChurches:", error);
    return [];
  }
}

export async function addChurchAffiliation(
  missionaryId: number,
  churchId: number
): Promise<{
  success: boolean;
  message?: string;
}> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    const { data: existingAffiliation } = await supabaseAdmin
      .from("missionary_churches")
      .select("id")
      .eq("missionary_id", missionaryId)
      .eq("church_id", churchId)
      .maybeSingle();

    if (existingAffiliation) {
      return { success: false, message: "This church is already affiliated" };
    }

    const { error: insertError } = await supabaseAdmin
      .from("missionary_churches")
      .insert({
        missionary_id: missionaryId,
        church_id: churchId,
        relationship_type: "supporting",
        is_active: true,
      });

    if (insertError) {
      console.error("Error adding church affiliation:", insertError);
      return { success: false, message: insertError.message || "Failed to add affiliation" };
    }

    await syncChurchFollowMissionary(missionaryId, churchId);

    revalidatePath("/settings");
    revalidatePath(`/admin/missionaries/${missionaryId}`);
    revalidatePath(`/church/${churchId}`);

    return { success: true, message: "Church affiliation added successfully" };
  } catch (error) {
    console.error("Error in addChurchAffiliation:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function removeChurchAffiliation(
  affiliationId: number,
  missionaryId: number
): Promise<{
  success: boolean;
  message?: string;
}> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    // Get church_id before deleting for revalidation
    const { data: affiliation } = await supabaseAdmin
      .from("missionary_churches")
      .select("church_id")
      .eq("id", affiliationId)
      .eq("missionary_id", missionaryId)
      .maybeSingle();

    const { error: deleteError } = await supabaseAdmin
      .from("missionary_churches")
      .delete()
      .eq("id", affiliationId)
      .eq("missionary_id", missionaryId);

    if (deleteError) {
      console.error("Error removing church affiliation:", deleteError);
      return { success: false, message: deleteError.message || "Failed to remove affiliation" };
    }

    if (affiliation?.church_id) {
      await syncChurchUnfollowMissionary(missionaryId, affiliation.church_id);
      revalidatePath(`/church/${affiliation.church_id}`);
    }

    revalidatePath("/settings");
    revalidatePath(`/admin/missionaries/${missionaryId}`);

    return { success: true, message: "Church affiliation removed successfully" };
  } catch (error) {
    console.error("Error in removeChurchAffiliation:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function bulkAddChurchAffiliations(
  missionaryId: number,
  churchIds: number[]
): Promise<{
  success: boolean;
  message?: string;
}> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Not authenticated" };
    }

    if (churchIds.length === 0) {
      return { success: true, message: "No churches to add" };
    }

    const rows = churchIds.map((churchId) => ({
      missionary_id: missionaryId,
      church_id: churchId,
      relationship_type: "supporting",
      is_active: true,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("missionary_churches")
      .upsert(rows, { onConflict: "missionary_id,church_id" });

    if (insertError) {
      console.error("Error bulk adding church affiliations:", insertError);
      return { success: false, message: insertError.message || "Failed to add affiliations" };
    }

    for (const churchId of churchIds) {
      await syncChurchFollowMissionary(missionaryId, churchId);
    }

    revalidatePath("/settings");
    revalidatePath(`/admin/missionaries/${missionaryId}`);
    churchIds.forEach((churchId) => revalidatePath(`/church/${churchId}`));

    return { success: true, message: "Church affiliations added successfully" };
  } catch (error) {
    console.error("Error in bulkAddChurchAffiliations:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

