export type User = {
  id: string; // numeric id from users table (as string)
  user_id?: string; // UUID from auth.users (optional)
  first_name: string;
  last_name: string;
  email?: string;
  role: number;
  role_name?: string;
  status: "Active" | "Pending Invite" | "Inactive";
  last_activity: string | null;
};

export type UserRole = {
  id: number;
  role: string;
};

