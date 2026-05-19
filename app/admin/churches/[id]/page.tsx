import { EntityManagePageClient } from "@/components/admin/shared/EntityManagePage";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { notFound } from "next/navigation";
import { updateChurchInfo, updateContactPerson, getChurchMissionaries } from "./actions";
import { getPageDataWithRelations } from "@/lib/pageDataLoader";
import { getCurrentUserProfile } from "@/lib/userActions";

type ChurchDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  contact_person_phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
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

async function getChurchDetail(id: string): Promise<ChurchDetailData | null> {
    const supabase = await getSupabaseServer();

    try {
      // Try to find by church ID first
      const churchQuery = supabase
        .from("churches")
        .select("*")
        .eq("id", parseInt(id))
        .single();

      const { data: initialChurchData, error: churchError } = await churchQuery;
      let churchData = initialChurchData;

      // If not found by ID, try to find by contact_user_id
      if (churchError || !churchData) {
        const { data: churchByUserId, error: userIdError } = await supabase
          .from("churches")
          .select("*")
          .eq("contact_user_id", id)
          .single();

        if (userIdError || !churchByUserId) {
          return null;
        }
        churchData = churchByUserId;
      }

      // Fetch contact user data
      let contactUser = null;
      if (churchData.contact_user_id) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, email, status")
          .eq("user_id", churchData.contact_user_id)
          .single();

        if (!userError && userData) {
          contactUser = userData;
        }
      }

      const result = {
        id: churchData.id,
        name: churchData.name || "",
        contact_user_id: churchData.contact_user_id,
        email: churchData.email ?? null,
        phone_number: churchData.phone_number ?? null,
        contact_person_phone_number: churchData.contact_person_phone_number ?? null,
        address: churchData.address ?? null,
        city: churchData.city ?? null,
        state: churchData.state ?? null,
        country: churchData.country ?? null,
        website: churchData.website ?? null,
        created_at: churchData.created_at,
        contactUser: contactUser,
      };
      
      console.log("Fetched church data - contact_person_phone_number:", result.contact_person_phone_number);
      return result;
    } catch (error) {
      console.error("Error fetching church detail:", error);
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
async function ChurchDetailData({ id }: { id: string }) {
  await assertAdminOrStaff();
  const church = await getChurchDetail(id);
  
  if (!church) {
    notFound();
  }

  const pageData = await getPageDataWithRelations("church", church.id);
  const userProfile = await getCurrentUserProfile();

  return (
    <EntityManagePageClient
      entity={church}
      type="church"
      onUpdateEntity={updateChurchInfo}
      onUpdateContact={updateContactPerson}
      onFetchMissionaries={getChurchMissionaries}
      initialPageData={pageData}
      currentUserProfile={userProfile}
    />
  );
}

// Page component - Server Component
export default async function ChurchManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChurchDetailData id={id} />
    </Suspense>
  );
}

