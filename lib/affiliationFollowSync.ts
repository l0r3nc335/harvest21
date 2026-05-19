"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * When a church is affiliated with a missionary, the church's contact user is
 * automatically set as an accepted follower of that missionary via the
 * sync_church_follow_missionary SECURITY DEFINER RPC.
 */
export async function syncChurchFollowMissionary(
  missionaryId: number,
  churchId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc("sync_church_follow_missionary", {
    p_missionary_id: missionaryId,
    p_church_id: churchId,
  });
  if (error) {
    console.error("[affiliationFollowSync] sync_church_follow_missionary:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function syncChurchUnfollowMissionary(
  missionaryId: number,
  churchId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc("sync_church_unfollow_missionary", {
    p_missionary_id: missionaryId,
    p_church_id: churchId,
  });
  if (error) {
    console.error("[affiliationFollowSync] sync_church_unfollow_missionary:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
