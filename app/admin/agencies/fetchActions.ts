"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { AgencyListItem } from "@/types/agency";

export async function fetchAgencies(): Promise<AgencyListItem[]> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  try {
    const { data: agenciesData, error: agenciesError } = await supabase
      .from("agencies")
      .select("*")
      .order("created_at", { ascending: false });

    if (agenciesError) {
      console.error("Error fetching agencies:", agenciesError);
      return [];
    }

    type AgencyRow = {
      contact_user_id?: string | null;
      [key: string]: unknown;
    };

    const contactUserIds = (agenciesData || [] as AgencyRow[])
      .map((c: AgencyRow) => c.contact_user_id)
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

    const agencyIds = (agenciesData || []).map((a: { id?: number }) => a.id).filter((id: number | undefined): id is number => id != null);
    let missionaryCountMap = new Map<number, number>();
    if (agencyIds.length > 0) {
      const { data: countRows } = await supabase
        .from("missionaries")
        .select("agency_id")
        .in("agency_id", agencyIds);
      const countByAgency = new Map<number, number>();
      (countRows || []).forEach((row: { agency_id: number | null }) => {
        if (row.agency_id != null) {
          countByAgency.set(row.agency_id, (countByAgency.get(row.agency_id) ?? 0) + 1);
        }
      });
      missionaryCountMap = countByAgency;
    }

    const agencies: AgencyListItem[] = (agenciesData || []).map((agency: {
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
      const user = agency.contact_user_id ? usersMap.get(agency.contact_user_id) : undefined;
      const location = [agency.city, agency.country].filter(Boolean).join(", ") || "N/A";

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

      let accountStatus: AgencyListItem["accountStatus"] = "Active";
      if (user?.status === "Inactive") {
        accountStatus = "Inactive";
      } else if (user?.status === "Pending" || user?.status === "Pending Invite") {
        accountStatus = "Pending";
      }

      const isManaged = agency.is_managed_by_harvest21 ?? agency.contact_user_id == null;
      return {
        id: agency.id?.toString() || "",
        name: agency.name || "",
        location: location,
        accountStatus: accountStatus,
        lastActivity: lastActivity,
        missionaryCount: agency.id != null ? missionaryCountMap.get(agency.id) ?? 0 : 0,
        isManagedByHarvest21: isManaged,
      } as AgencyListItem;
    });

    return agencies;
  } catch (error) {
    console.error("Error fetching agencies:", error);
    return [];
  }
}
