import { EntityManagePageClient } from "@/components/admin/shared/EntityManagePage";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { notFound } from "next/navigation";
import { updateAgencyInfo, updateContactPerson, getAgencyMissionaries } from "./actions";
import { getPageDataWithRelations } from "@/lib/pageDataLoader";
import { getCurrentUserProfile } from "@/lib/userActions";

type AgencyDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  contact_person_phone_number: string | null;
  address: string | null;
  city: string | null;
  state?: string | null;
  country: string | null;
  website: string | null;
  created_at: string;
  contactUser: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string;
    phone_number?: string | null;
  } | null;
};

async function getAgencyDetail(id: string): Promise<AgencyDetailData | null> {
    const supabase = await getSupabaseServer();

    try {
      // Try to find by agency ID first
      const agencyQuery = supabase
        .from("agencies")
        .select("*")
        .eq("id", parseInt(id))
        .single();

      const { data: agencyData, error: agencyError } = await agencyQuery;
      let finalAgencyData = agencyData;

      // If not found by ID, try to find by contact_user_id
      if (agencyError || !finalAgencyData) {
        const { data: agencyByUserId, error: userIdError } = await supabase
          .from("agencies")
          .select("*")
          .eq("contact_user_id", id)
          .single();

        if (userIdError || !agencyByUserId) {
          return null;
        }
        finalAgencyData = agencyByUserId;
      }

      // Fetch contact user data
      let contactUser = null;
      if (finalAgencyData.contact_user_id) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, email, status")
          .eq("user_id", finalAgencyData.contact_user_id)
          .single();

        if (!userError && userData) {
          contactUser = userData;
        }
      }

      const result = {
        id: finalAgencyData.id,
        name: finalAgencyData.name || "",
        contact_user_id: finalAgencyData.contact_user_id,
        email: finalAgencyData.email ?? null,
        phone_number: finalAgencyData.phone_number ?? null,
        contact_person_phone_number: finalAgencyData.contact_person_phone_number ?? null,
        address: finalAgencyData.address ?? null,
        city: finalAgencyData.city ?? null,
        state: finalAgencyData.state ?? null,
        country: finalAgencyData.country ?? null,
        website: finalAgencyData.website ?? null,
        created_at: finalAgencyData.created_at,
        contactUser: contactUser,
      };
      
      console.log("Fetched agency data - contact_person_phone_number:", result.contact_person_phone_number);
      return result;
    } catch (error) {
      console.error("Error fetching agency detail:", error);
      return null;
    }
}

// Loading component
function LoadingFallback() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <div className="h-6 w-48 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800 mb-2"></div>
        <div className="h-8 w-64 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
      </div>
      <div className="flex gap-2 mb-6">
        <div className="h-10 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        <div className="h-10 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        <div className="h-10 w-32 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
      </div>
      <div className="space-y-4">
        <div className="h-64 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
        <div className="h-64 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800"></div>
      </div>
    </div>
  );
}

// Async server component that fetches data
async function AgencyDetailData({ id }: { id: string }) {
  await assertAdminOrStaff();
  const agency = await getAgencyDetail(id);
  
  if (!agency) {
    notFound();
  }

  const pageData = await getPageDataWithRelations("agency", agency.id);
  const userProfile = await getCurrentUserProfile();

  return (
    <EntityManagePageClient
      entity={agency}
      type="agency"
      onUpdateEntity={updateAgencyInfo}
      onUpdateContact={updateContactPerson}
      onFetchMissionaries={getAgencyMissionaries}
      initialPageData={pageData}
      currentUserProfile={userProfile}
    />
  );
}

// Page component - Server Component
export default async function AgencyManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AgencyDetailData id={id} />
    </Suspense>
  );
}

