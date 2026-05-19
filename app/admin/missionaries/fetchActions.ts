"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { Missionary } from "@/types/missionary";

export async function fetchMissionaries(): Promise<Missionary[]> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  try {
    const { data: missionariesData, error: missionariesError } = await supabase
      .from("missionaries")
      .select("*")
      .order("created_at", { ascending: false });

    if (missionariesError) {
      console.error("Error fetching missionaries:", missionariesError);
      return [];
    }

    type MissionaryRow = {
      user_id?: string | null;
      destination_country?: string | null;
      mission_status?: string | null;
      [key: string]: unknown;
    };

    const userIds = (missionariesData || [] as MissionaryRow[])
      .map((m: MissionaryRow) => m.user_id)
      .filter((id: string | null | undefined): id is string => id != null);

    type UserRow = {
      user_id: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      status?: string;
      last_activity?: string | null;
    };

    let usersData: UserRow[] = [];
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, email, status, last_activity")
        .in("user_id", userIds);

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else {
        usersData = (users || []) as UserRow[];
      }
    }

    const usersMap = new Map(usersData.map((u) => [u.user_id, u]));

    const missionaries: Missionary[] = (missionariesData || []).map((missionary: {
      id?: number;
      user_id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      destination_country?: string | null;
      mission_status?: string | null;
      is_managed_by_harvest21?: boolean;
      created_at?: string;
      payout_status?: string | null;
      stripe_account_id?: string | null;
    }) => {
      const user = missionary.user_id ? usersMap.get(missionary.user_id) : undefined;
      const location = missionary.destination_country || "N/A";

      let lastActivity = "N/A";
      if (user?.last_activity) {
        const date = new Date(user.last_activity);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          lastActivity = "Today";
        } else if (diffDays === 1) {
          lastActivity = "Yesterday";
        } else if (diffDays < 7) {
          lastActivity = `${diffDays} days ago`;
        } else {
          lastActivity = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      }

      let accountStatus: Missionary["accountStatus"] = "Active";
      if (user?.status === "Inactive") {
        accountStatus = "Inactive";
      } else if (user?.status === "Pending" || user?.status === "Pending Invite") {
        accountStatus = "Pending Invite";
      } else if (user?.status === "Active") {
        accountStatus = "Active";
      }

      let missionStatus: Missionary["missionStatus"] = "On-field";
      if (missionary.mission_status === "On-Field") {
        missionStatus = "On-field";
      } else if (missionary.mission_status === "Furlough") {
        missionStatus = "Off-field";
      } else if (missionary.mission_status === "Deputation") {
        missionStatus = "Pending";
      }

      const fullName = `${missionary.first_name || ""} ${missionary.last_name || ""}`.trim() || "Unknown";
      const lastName = missionary.last_name || user?.last_name || "";

      const isManaged = missionary.is_managed_by_harvest21 ?? missionary.user_id == null;
      return {
        id: missionary.id?.toString() || missionary.user_id || "",
        name: fullName,
        lastName: lastName,
        location: location,
        missionStatus: missionStatus,
        accountStatus: accountStatus,
        lastActivity: lastActivity,
        payoutStatus: (missionary.payout_status as Missionary["payoutStatus"]) || "not_started",
        stripeAccountId: missionary.stripe_account_id || undefined,
        isManagedByHarvest21: isManaged,
      } as Missionary;
    });

    return missionaries;
  } catch (error) {
    console.error("Error fetching missionaries:", error);
    return [];
  }
}
