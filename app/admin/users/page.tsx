import { UsersPageClient } from "@/components/admin/UsersPage";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { User, UserRole } from "@/types/user";

async function fetchUsersFresh(): Promise<{ users: User[]; roles: UserRole[] }> {
    const supabase = await getSupabaseServer();

  try {
    // Fetch user roles first
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("*")
    if (rolesError) throw rolesError;

    // Fetch users from public.users table
    // Explicitly select fields from public.users to ensure last_activity comes from public.users.last_activity
    // NOT from auth.users.last_sign_in_at
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, user_id, first_name, last_name, email, role, status, last_activity, created_at")
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;

    // Map role IDs to role names and transform data
    // Note: last_activity comes from public.users.last_activity
    // All other fields also come from public.users table
    const usersWithRoles: User[] = (usersData || []).map((user: {
      id?: number;
      user_id?: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      role: number;
      status?: string;
      last_activity?: string | null; // From public.users.last_activity
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
        id: user.id?.toString() || "", // From public.users.id
        user_id: user.user_id || undefined, // From public.users.user_id (UUID from auth.users.id)
        first_name: user.first_name || "", // From public.users.first_name
        last_name: user.last_name || "", // From public.users.last_name
        email: user.email || undefined, // From public.users.email
        role: user.role || 0, // From public.users.role
        role_name: role?.role, // From user_roles.role (joined)
        status: status, // From public.users.status (mapped)
        last_activity: user.last_activity || null, // From public.users.last_activity
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

async function getUsers(): Promise<{ users: User[]; roles: UserRole[] }> {
  await assertAdminOrStaff();
  return await fetchUsersFresh();
}

function TableLoadingFallback() {
  return <UsersPageClient initialUsers={[]} userRoles={[]} isInitialLoading={true} />;
}

// Async server component that fetches data (always fetches fresh data)
async function UsersData() {
  const { users, roles } = await getUsers();
  return <UsersPageClient initialUsers={users} userRoles={roles} isInitialLoading={false} />;
}

export default function UsersPage() {
  return (
    <Suspense fallback={<TableLoadingFallback />}>
      <UsersData />
    </Suspense>
  );
}
