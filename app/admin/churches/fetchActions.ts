"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { ChurchListItem } from "@/types/church";

export async function fetchChurches(): Promise<ChurchListItem[]> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  try {
    const { data: churchesData, error: churchesError } = await supabase
      .from("churches")
      .select("*")
      .order("created_at", { ascending: false });

    if (churchesError) {
      console.error("Error fetching churches:", churchesError);
      return [];
    }

    type ChurchRow = {
      contact_user_id?: string | null;
      [key: string]: unknown;
    };

    const contactUserIds = (churchesData || [] as ChurchRow[])
      .map((c: ChurchRow) => c.contact_user_id)
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
    if (contactUserIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, email, status, last_activity")
        .in("user_id", contactUserIds);

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else {
        usersData = (users || []) as UserRow[];
      }
    }

    const usersMap = new Map(usersData.map((u) => [u.user_id, u]));

    const churches: ChurchListItem[] = (churchesData || []).map((church: {
      id?: number;
      name?: string;
      email?: string | null;
      phone_number?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
      contact_user_id?: string | null;
      is_managed_by_harvest21?: boolean;
      created_at?: string;
    }) => {
      const user = church.contact_user_id ? usersMap.get(church.contact_user_id) : undefined;
      const location = [church.city, church.country].filter(Boolean).join(", ") || "N/A";

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

      let accountStatus: ChurchListItem["accountStatus"] = "Active";
      if (user?.status === "Inactive") {
        accountStatus = "Inactive";
      } else if (user?.status === "Pending" || user?.status === "Pending Invite") {
        accountStatus = "Pending";
      }

      const isManaged = church.is_managed_by_harvest21 ?? church.contact_user_id == null;
      return {
        id: church.id?.toString() || "",
        name: church.name?.trim() || "Unnamed Church",
        location: location,
        accountStatus: accountStatus,
        lastActivity: lastActivity,
        isManagedByHarvest21: isManaged,
      } as ChurchListItem;
    });

    return churches;
  } catch (error) {
    console.error("Error fetching churches:", error);
    return [];
  }
}
