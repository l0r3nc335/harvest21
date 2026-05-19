import { EntityManagePageClient } from "@/components/admin/shared/EntityManagePage";
import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { notFound } from "next/navigation";
import { updateCollegeInfo, updateContactPerson, getCollegeMissionaries } from "./actions";
import { getPageDataWithRelations } from "@/lib/pageDataLoader";

type CollegeDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  created_at: string;
  contactUser: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string;
  } | null;
};

async function getCollegeDetail(id: string): Promise<CollegeDetailData | null> {
    const supabase = await getSupabaseServer();

    try {
      // Try to find by college ID first
      const collegeQuery = supabase
        .from("colleges")
        .select("*")
        .eq("id", parseInt(id))
        .single();

      const { data: initialCollegeData, error: collegeError } = await collegeQuery;
      let collegeData = initialCollegeData;

      // If not found by ID, try to find by contact_user_id
      if (collegeError || !collegeData) {
        const { data: collegeByUserId, error: userIdError } = await supabase
          .from("colleges")
          .select("*")
          .eq("contact_user_id", id)
          .single();

        if (userIdError || !collegeByUserId) {
          return null;
        }
        collegeData = collegeByUserId;
      }

      // Fetch contact user data (only fields that exist in users table)
      let contactUser = null;
      if (collegeData.contact_user_id) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, email, status")
          .eq("user_id", collegeData.contact_user_id)
          .single();

        if (!userError && userData) {
          contactUser = userData;
        }
      }

      return {
        id: collegeData.id,
        name: collegeData.name || "",
        contact_user_id: collegeData.contact_user_id,
        email: collegeData.email ?? null,
        phone_number: collegeData.phone_number ?? null,
        address: collegeData.address ?? null,
        city: collegeData.city ?? null,
        country: collegeData.country ?? null,
        website: collegeData.website ?? null,
        created_at: collegeData.created_at,
        contactUser: contactUser,
      };
    } catch (error) {
      console.error("Error fetching college detail:", error);
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
async function CollegeDetailData({ id }: { id: string }) {
  await assertAdminOrStaff();
  const college = await getCollegeDetail(id);
  
  if (!college) {
    notFound();
  }

  const pageData = await getPageDataWithRelations("college", college.id);

  return (
    <EntityManagePageClient
      entity={college}
      type="college"
      onUpdateEntity={updateCollegeInfo}
      onUpdateContact={updateContactPerson}
      onFetchMissionaries={getCollegeMissionaries}
      initialPageData={pageData}
    />
  );
}

// Page component - Server Component
export default async function CollegeManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CollegeDetailData id={id} />
    </Suspense>
  );
}

