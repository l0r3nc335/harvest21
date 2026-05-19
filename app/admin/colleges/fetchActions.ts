"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { College } from "@/types/college";

export async function fetchColleges(): Promise<College[]> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  try {
    const { data: collegesData, error: collegesError } = await supabase
      .from("colleges")
      .select("*")
      .order("created_at", { ascending: false });

    if (collegesError) {
      console.error("Error fetching colleges:", collegesError);
      return [];
    }

    type CollegeRow = {
      contact_user_id?: string | null;
      [key: string]: unknown;
    };

    const contactUserIds = (collegesData || [] as CollegeRow[])
      .map((c: CollegeRow) => c.contact_user_id)
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

    const colleges: College[] = (collegesData || []).map((college: {
      id?: number;
      name?: string;
      email?: string | null;
      phone_number?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
      contact_user_id?: string | null;
      created_at?: string;
    }) => {
      const user = college.contact_user_id ? usersMap.get(college.contact_user_id) : undefined;
      const location = [college.city, college.country].filter(Boolean).join(", ") || "N/A";

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

      let accountStatus: College["accountStatus"] = "Active";
      if (user?.status === "Inactive") {
        accountStatus = "Inactive";
      } else if (user?.status === "Pending" || user?.status === "Pending Invite") {
        accountStatus = "Pending";
      }

      return {
        id: college.id?.toString() || "",
        name: college.name || "",
        location: location,
        accountStatus: accountStatus,
        lastActivity: lastActivity,
      } as College;
    });

    return colleges;
  } catch (error) {
    console.error("Error fetching colleges:", error);
    return [];
  }
}
