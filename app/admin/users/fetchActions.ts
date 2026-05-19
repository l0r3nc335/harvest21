"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { User, UserRole } from "@/types/user";

export async function fetchUsers(): Promise<{ users: User[]; roles: UserRole[] }> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  try {
    // Fetch user roles first
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");
    if (rolesError) throw rolesError;

    // Fetch users
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;

    // Map role IDs to role names
    const usersWithRoles: User[] = (usersData || []).map((user: {
      id?: number;
      user_id?: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      role: number;
      status?: string;
      last_activity?: string | null;
    }) => {
      const role = rolesData?.find((r: UserRole) => r.id === user.role);
      // Map status: "Pending" -> "Pending Invite"
      let status: User["status"] = "Active";
      if (user.status === "Pending" || user.status === "Pending Invite") {
        status = "Pending Invite";
      } else if (user.status === "Inactive") {
        status = "Inactive";
      } else if (user.status === "Active") {
        status = "Active";
      }
      
      return {
        id: user.id?.toString() || "",
        user_id: user.user_id || undefined,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || undefined,
        role: user.role || 0,
        role_name: role?.role,
        status: status,
        last_activity: user.last_activity || null,
      } as User;
    });

    return {
      users: usersWithRoles,
      roles: rolesData || [],
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      users: [],
      roles: [],
    };
  }
}

