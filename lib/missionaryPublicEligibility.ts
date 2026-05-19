import { createClient } from "@supabase/supabase-js";

type SupabaseClientLike = ReturnType<typeof createClient>;

/**
 * IDs of missionaries whose linked `public.users` row has `status === 'Active'`.
 * Uses the `missionary_ids_with_active_users` RPC (SECURITY DEFINER) so it works
 * for anon and authenticated callers without requiring service-role access.
 */
export async function getMissionaryIdsWithActiveUsers(
  supabase: SupabaseClientLike,
  missionaryIds: number[]
): Promise<Set<number>> {
  if (missionaryIds.length === 0) return new Set();

  const uniqueIds = [...new Set(missionaryIds)];
  const { data, error } = await supabase.rpc("missionary_ids_with_active_users", {
    ids: uniqueIds,
  });

  if (error) {
    console.error("missionary_ids_with_active_users RPC error:", error);
    return new Set();
  }

  const result = new Set<number>();
  for (const row of (data as unknown as Array<number | { id: number }>) || []) {
    if (typeof row === "number") {
      result.add(row);
    } else if (row && typeof row.id === "number") {
      result.add(row.id);
    }
  }
  return result;
}
