import { DonorsPageClient } from "@/components/admin/DonorsPage";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Donor } from "@/types/donor";

// Fetch donors from the database
async function getDonors(): Promise<Donor[]> {
  const supabase = await getSupabaseServer();

  try {
    // Fetch donors from the database
    // Note: Adjust the table name and columns based on your actual database schema
    const { data: donorsData, error: donorsError } = await supabase
      .from("donors")
      .select("*")
      .order("created_at", { ascending: false });

    if (donorsError) {
      console.error("Error fetching donors:", donorsError);
      // Return mock data if table doesn't exist yet
      return getMockDonors();
    }

    // Map database data to Donor type
    const donors: Donor[] = (donorsData || []).map((donor: any) => ({
      id: donor.id || donor.donor_id,
      donor_id: donor.donor_id || donor.id,
      first_name: donor.first_name || donor.firstName || "",
      last_name: donor.last_name || donor.lastName || "",
      email: donor.email || undefined,
      phone: donor.phone || undefined,
      location: donor.location || undefined,
      total_donations: donor.total_donations || donor.totalDonations || 0,
      last_donation_date: donor.last_donation_date || donor.lastDonationDate || null,
      status: donor.status || "Active",
      transaction_count: donor.transaction_count || donor.transactionCount || 0,
      average_donation: donor.average_donation || donor.averageDonation || 0,
      created_at: donor.created_at || donor.createdAt || new Date().toISOString(),
      last_activity: donor.last_activity || donor.lastActivity || null,
    }));

    return donors.length > 0 ? donors : getMockDonors();
  } catch (error) {
    console.error("Error fetching donors:", error);
    return getMockDonors();
  }
}

// Mock data for development/demo purposes
function getMockDonors(): Donor[] {
  const now = new Date();
  const dates = [
    new Date(now.getTime() - 0 * 24 * 60 * 60 * 1000).toISOString(), // Today
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
    new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
    new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days ago
    new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000).toISOString(), // 150 days ago
  ];

  return [
    {
      id: "1",
      donor_id: "23456777",
      first_name: "John",
      last_name: "Smith",
      email: "john.smith@email.com",
      phone: "(555) 123-4567",
      location: "New York, NY",
      total_donations: 1250.50,
      last_donation_date: dates[0],
      status: "Active",
      transaction_count: 12,
      average_donation: 104.21,
      created_at: dates[11],
      last_activity: dates[0],
    },
    {
      id: "2",
      donor_id: "34567888",
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah.j@email.com",
      phone: "(555) 234-5678",
      location: "Los Angeles, CA",
      total_donations: 3450.00,
      last_donation_date: dates[1],
      status: "Active",
      transaction_count: 8,
      average_donation: 431.25,
      created_at: dates[10],
      last_activity: dates[1],
    },
    {
      id: "3",
      donor_id: "45678999",
      first_name: "Michael",
      last_name: "Brown",
      email: "michael.brown@email.com",
      phone: "(555) 345-6789",
      location: "Chicago, IL",
      total_donations: 875.75,
      last_donation_date: dates[2],
      status: "Active",
      transaction_count: 15,
      average_donation: 58.38,
      created_at: dates[9],
      last_activity: dates[2],
    },
    {
      id: "4",
      donor_id: "56789000",
      first_name: "Emily",
      last_name: "Davis",
      email: "emily.davis@email.com",
      phone: "(555) 456-7890",
      location: "Houston, TX",
      total_donations: 2100.00,
      last_donation_date: dates[3],
      status: "Active",
      transaction_count: 5,
      average_donation: 420.00,
      created_at: dates[8],
      last_activity: dates[3],
    },
    {
      id: "5",
      donor_id: "67890111",
      first_name: "David",
      last_name: "Wilson",
      email: "david.w@email.com",
      location: "Phoenix, AZ",
      total_donations: 650.00,
      last_donation_date: dates[4],
      status: "Pending",
      transaction_count: 3,
      average_donation: 216.67,
      created_at: dates[7],
      last_activity: dates[4],
    },
    {
      id: "6",
      donor_id: "78901222",
      first_name: "Jessica",
      last_name: "Martinez",
      email: "jessica.m@email.com",
      phone: "(555) 567-8901",
      location: "Philadelphia, PA",
      total_donations: 1890.25,
      last_donation_date: dates[5],
      status: "Active",
      transaction_count: 10,
      average_donation: 189.03,
      created_at: dates[6],
      last_activity: dates[5],
    },
    {
      id: "7",
      donor_id: "89012333",
      first_name: "Robert",
      last_name: "Anderson",
      email: "robert.a@email.com",
      phone: "(555) 678-9012",
      location: "San Antonio, TX",
      total_donations: 4250.50,
      last_donation_date: dates[0],
      status: "Active",
      transaction_count: 20,
      average_donation: 212.53,
      created_at: dates[11],
      last_activity: dates[0],
    },
    {
      id: "8",
      donor_id: "90123444",
      first_name: "Amanda",
      last_name: "Taylor",
      email: "amanda.t@email.com",
      location: "San Diego, CA",
      total_donations: 750.00,
      last_donation_date: dates[6],
      status: "Inactive",
      transaction_count: 4,
      average_donation: 187.50,
      created_at: dates[5],
      last_activity: dates[6],
    },
    {
      id: "9",
      donor_id: "01234555",
      first_name: "Christopher",
      last_name: "Thomas",
      email: "chris.t@email.com",
      phone: "(555) 789-0123",
      location: "Dallas, TX",
      total_donations: 1525.75,
      last_donation_date: dates[2],
      status: "Active",
      transaction_count: 7,
      average_donation: 217.96,
      created_at: dates[9],
      last_activity: dates[2],
    },
    {
      id: "10",
      donor_id: "12345666",
      first_name: "Michelle",
      last_name: "Jackson",
      email: "michelle.j@email.com",
      phone: "(555) 890-1234",
      location: "San Jose, CA",
      total_donations: 980.00,
      last_donation_date: dates[4],
      status: "Active",
      transaction_count: 6,
      average_donation: 163.33,
      created_at: dates[8],
      last_activity: dates[4],
    },
    {
      id: "11",
      donor_id: "23456777",
      first_name: "Daniel",
      last_name: "White",
      email: "daniel.w@email.com",
      location: "Austin, TX",
      total_donations: 3200.00,
      last_donation_date: dates[1],
      status: "Active",
      transaction_count: 9,
      average_donation: 355.56,
      created_at: dates[10],
      last_activity: dates[1],
    },
    {
      id: "12",
      donor_id: "34567888",
      first_name: "Lisa",
      last_name: "Harris",
      email: "lisa.h@email.com",
      phone: "(555) 901-2345",
      location: "Jacksonville, FL",
      total_donations: 1450.25,
      last_donation_date: dates[3],
      status: "Active",
      transaction_count: 11,
      average_donation: 131.84,
      created_at: dates[9],
      last_activity: dates[3],
    },
    {
      id: "13",
      donor_id: "45678999",
      first_name: "Matthew",
      last_name: "Martin",
      email: "matthew.m@email.com",
      location: "Fort Worth, TX",
      total_donations: 675.50,
      last_donation_date: dates[7],
      status: "Pending",
      transaction_count: 2,
      average_donation: 337.75,
      created_at: dates[7],
      last_activity: dates[7],
    },
    {
      id: "14",
      donor_id: "56789000",
      first_name: "Jennifer",
      last_name: "Thompson",
      email: "jennifer.t@email.com",
      phone: "(555) 012-3456",
      location: "Columbus, OH",
      total_donations: 2890.00,
      last_donation_date: dates[0],
      status: "Active",
      transaction_count: 14,
      average_donation: 206.43,
      created_at: dates[11],
      last_activity: dates[0],
    },
    {
      id: "15",
      donor_id: "67890111",
      first_name: "Andrew",
      last_name: "Garcia",
      email: "andrew.g@email.com",
      location: "Charlotte, NC",
      total_donations: 550.00,
      last_donation_date: dates[8],
      status: "Inactive",
      transaction_count: 3,
      average_donation: 183.33,
      created_at: dates[8],
      last_activity: dates[8],
    },
  ];
}

// Loading component with skeleton UI
function LoadingFallback() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-8 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="h-10 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
          <div className="h-10 w-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
          <div className="h-10 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-zinc-200 animate-pulse dark:bg-zinc-800"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                  <div className="h-3 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
                </div>
                <div className="h-6 w-20 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Async component that fetches data
async function DonorsData() {
  const donors = await getDonors();
  return <DonorsPageClient initialDonors={donors} />;
}

// Page component - renders immediately, data loads in Suspense
export default function DonorsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DonorsData />
    </Suspense>
  );
}

