export type Donor = {
  id: string;
  donor_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  location?: string;
  total_donations: number;
  last_donation_date: string | null;
  status: "Active" | "Inactive" | "Pending";
  transaction_count: number;
  average_donation: number;
  created_at: string;
  last_activity: string | null;
};

