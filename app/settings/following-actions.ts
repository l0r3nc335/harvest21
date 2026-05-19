"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import type { SupporterFollows, ActionResult, FollowItem } from "@/types/supporter";

export async function getSupporterFollows(): Promise<ActionResult<SupporterFollows>> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Fetch missionary follows
    const { data: missionaryFollows, error: missionaryError } = await supabase
      .from("missionary_followers")
      .select("status, requested_at, missionary_id")
      .eq("user_id", user.id)
      .neq("status", "unfollowed");

    if (missionaryError) {
      console.error("Error fetching missionary follows:", missionaryError);
      return { success: false, error: `Failed to fetch missionary follows: ${missionaryError.message}` };
    }

    // Fetch church follows
    const { data: churchFollows, error: churchError } = await supabase
      .from("church_followers")
      .select("status, requested_at, church_id")
      .eq("user_id", user.id)
      .neq("status", "unfollowed");

    if (churchError) {
      console.error("Error fetching church follows:", churchError);
      return { success: false, error: `Failed to fetch church follows: ${churchError.message}` };
    }

    // Fetch missionary details separately using admin client to bypass RLS
    const missionaryIds = missionaryFollows?.map((f: any) => f.missionary_id) || [];
    const { data: missionaries, error: missionariesError } = missionaryIds.length > 0 
      ? await supabaseAdmin
          .from("missionaries")
          .select("id, first_name, last_name")
          .in("id", missionaryIds)
      : { data: [], error: null };

    if (missionariesError) {
      console.error("Error fetching missionaries:", missionariesError);
    }

    // Fetch church details separately using admin client to bypass RLS
    const churchIds = churchFollows?.map((f: any) => f.church_id) || [];
    const { data: churches, error: churchesError } = churchIds.length > 0
      ? await supabaseAdmin
          .from("churches")
          .select("id, name")
          .in("id", churchIds)
      : { data: [], error: null };

    if (churchesError) {
      console.error("Error fetching churches:", churchesError);
    }

    // Get page data for all entities
    const { data: missionaryPages } = missionaryIds.length > 0
      ? await supabase
          .from("pages")
          .select("organization_id, page_url, profile_photo_url, name")
          .eq("organization_type", "missionary")
          .in("organization_id", missionaryIds)
      : { data: [] };

    const { data: churchPages } = churchIds.length > 0
      ? await supabase
          .from("pages")
          .select("organization_id, page_url, profile_photo_url, name")
          .eq("organization_type", "church")
          .in("organization_id", churchIds)
      : { data: [] };

    // Map missionary follows to FollowItem
    const missionaryItems: FollowItem[] = missionaryFollows?.map((f: any) => {
      const missionary = missionaries?.find((m: any) => m.id === f.missionary_id);
      const page = missionaryPages?.find((p: any) => p.organization_id === f.missionary_id);
      return {
        entity_type: 'missionary',
        entity_id: f.missionary_id,
        entity_name: missionary ? `${missionary.first_name} ${missionary.last_name}` : 'Unknown Missionary',
        status: f.status,
        requested_at: f.requested_at,
        page_url: page?.page_url || null,
        profile_photo_url: page?.profile_photo_url || null,
      };
    }) || [];

    // Map church follows to FollowItem
    const churchItems: FollowItem[] = churchFollows?.map((f: any) => {
      const church = churches?.find((c: any) => c.id === f.church_id);
      const page = churchPages?.find((p: any) => p.organization_id === f.church_id);
      return {
        entity_type: 'church',
        entity_id: f.church_id,
        entity_name: church?.name || 'Unknown Church',
        status: f.status,
        requested_at: f.requested_at,
        page_url: page?.page_url || null,
        profile_photo_url: page?.profile_photo_url || null,
      };
    }) || [];

    // Combine and sort
    const allItems = [...missionaryItems, ...churchItems];
    const following = allItems.filter((f) => f.status === 'accepted').sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );
    const pending = allItems.filter((f) => f.status === 'pending').sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );
    const rejected = allItems.filter((f) => f.status === 'rejected').sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );

    return {
      success: true,
      data: {
        following,
        pending,
        rejected
      }
    };
  } catch (error) {
    console.error("Error in getSupporterFollows:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function unfollowEntity(
  entityType: 'missionary' | 'church',
  entityId: number
): Promise<ActionResult> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const table = entityType === 'missionary' ? 'missionary_followers' : 'church_followers';
    const column = entityType === 'missionary' ? 'missionary_id' : 'church_id';

    // Try to update status to 'unfollowed' first (if migration has been run)
    const { data: updateData, error: updateError } = await supabase
      .from(table)
      .update({ 
        status: "unfollowed",
        unfollowed_at: new Date().toISOString()
      })
      .eq(column, entityId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .select("id");

    const didUpdate = !updateError && (updateData?.length ?? 0) > 0;

    // If update fails or no rows were updated (e.g. due to RLS), fall back to delete
    if (updateError || !didUpdate) {
      if (updateError) {
        console.log("Update failed, falling back to delete:", updateError.message);
      }
      
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq(column, entityId)
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (deleteError) {
        console.error(`Error deleting ${entityType} follow:`, deleteError);
        return { success: false, error: `Failed to unfollow ${entityType}` };
      }
    }

    return { success: true, message: `Unfollowed ${entityType} successfully` };
  } catch (error) {
    console.error("Error in unfollowEntity:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function cancelFollowRequest(
  entityType: 'missionary' | 'church',
  entityId: number
): Promise<ActionResult> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const table = entityType === 'missionary' ? 'missionary_followers' : 'church_followers';
    const column = entityType === 'missionary' ? 'missionary_id' : 'church_id';

    const { error } = await supabase
      .from(table)
      .delete()
      .eq(column, entityId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (error) {
      console.error(`Error cancelling ${entityType} follow request:`, error);
      return { success: false, error: "Failed to cancel follow request" };
    }

    return { success: true, message: "Follow request cancelled" };
  } catch (error) {
    console.error("Error in cancelFollowRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

