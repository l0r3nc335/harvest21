export type College = {
  id: string;
  name: string;
  location: string;
  accountStatus: "Active" | "Pending" | "Inactive";
  lastActivity: string;
};

