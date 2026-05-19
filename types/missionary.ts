export type Missionary = {
  id: string;
  name: string;
  lastName?: string;
  location: string;
  missionStatus: "On-field" | "Off-field" | "Pending";
  accountStatus: "Pending Invite" | "Active" | "Review" | "New" | "Inactive";
  lastActivity: string;
  hasReview?: boolean;
  payoutStatus?: "not_started" | "pending" | "enabled" | "restricted" | "incomplete";
  stripeAccountId?: string;
  isManagedByHarvest21?: boolean;
};

