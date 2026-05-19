"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import type { Donor } from "@/types/donor";

export async function fetchDonors(): Promise<Donor[]> {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();

  try {
    // Fetch donors from the database
    const { data: donorsData, error: donorsError } = await supabase
      .from("donors")
      .select("*")
      .order("created_at", { ascending: false });

    if (donorsError) {
      console.error("Error fetching donors:", donorsError);
      return [];
    }

    // Map database data to Donor type
    const donors: Donor[] = (donorsData || []).map((donor: {
      id?: number;
      donor_id?: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone?: string | null;
      phone_number?: string | null;
      country?: string | null;
      city?: string | null;
      location?: string | null;
      total_donated?: number | null;
      total_donations?: number | null;
      last_donation_date?: string | null;
      status?: string;
      transaction_count?: number;
      average_donation?: number;
      created_at?: string;
      last_activity?: string | null;
    }) => {
      const location = donor.location || (donor.city && donor.country ? `${donor.city}, ${donor.country}` : donor.city || donor.country || undefined);
      
      return {
        id: donor.id?.toString() || donor.donor_id || "",
        donor_id: donor.donor_id || donor.id?.toString() || "",
        first_name: donor.first_name || "",
        last_name: donor.last_name || "",
        email: donor.email || undefined,
        phone: donor.phone || donor.phone_number || undefined,
        location: location,
        total_donations: donor.total_donations || donor.total_donated || 0,
        last_donation_date: donor.last_donation_date || null,
        status: (donor.status === "Active" || donor.status === "Inactive" || donor.status === "Pending") 
          ? donor.status 
          : "Active",
        transaction_count: donor.transaction_count || 0,
        average_donation: donor.average_donation || 0,
        created_at: donor.created_at || new Date().toISOString(),
        last_activity: donor.last_activity || null,
      };
    });

    return donors;
  } catch (error) {
    console.error("Error fetching donors:", error);
    return [];
  }
}

