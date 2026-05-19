import { Suspense } from "react";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { notFound } from "next/navigation";
import { MissionaryManagePageClient } from "@/components/admin/MissionaryManagePage";
import { getPageDataWithRelations } from "@/lib/pageDataLoader";
import { getUserProfile } from "@/lib/navbarHelpers";
import { getMissionarySocialAdminDiagnostics } from "@/app/admin/missionaries/[id]/actions";

// Force dynamic rendering so missionary data (including phone_number) is always fetched fresh from DB on reload
export const dynamic = "force-dynamic";

type MissionaryDetailData = {
  id: number;
  user_id: string | null;
  is_managed_by_harvest21?: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  country_of_residence: string | null;
  destination_country: string;
  mission_status: string;
  open_to_visits: boolean;
  visits_start_date: string | null;
  visits_end_date: string | null;
  biography: string | null;
  agency_id: number | null;
  sending_church_id: number | null;
  mission_field_church_id: number | null;
  college_id: number | null;
  created_at: string;
  agency?: {
    id: number;
    name: string;
  } | null;
  sendingChurch?: {
    id: number;
    name: string;
  } | null;
  missionFieldChurch?: {
    id: number;
    name: string;
  } | null;
  college?: {
    id: number;
    name: string;
  } | null;
  page?: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
  } | null;
};

// Fetch missionary data by ID - always from DB on page load (no cache) to ensure phone_number and profile info are fresh
async function getMissionaryDetail(id: string): Promise<MissionaryDetailData | null> {
  const supabase = await getSupabaseServer();

  try {
    // Fetch missionary by ID (includes phone_number from missionaries table)
    const { data: missionaryData, error: missionaryError } = await supabase
      .from("missionaries")
      .select("*")
      .eq("id", parseInt(id))
      .single();

      if (missionaryError || !missionaryData) {
        return null;
      }

      // Fetch user data from users table to get email
      let userData = null;
      if (missionaryData.user_id) {
        const { data: user } = await supabase
          .from("users")
          .select("email, first_name, last_name")
          .eq("user_id", missionaryData.user_id)
          .single();
        
        if (user) {
          userData = user;
        }
      }

      // Fetch related agency if agency_id exists
      let agency = null;
      if (missionaryData.agency_id) {
        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id, name")
          .eq("id", missionaryData.agency_id)
          .single();
        if (agencyData) {
          agency = agencyData;
        }
      }

      // Fetch sending church if sending_church_id exists
      let sendingChurch = null;
      if (missionaryData.sending_church_id) {
        const { data: churchData } = await supabase
          .from("churches")
          .select("id, name")
          .eq("id", missionaryData.sending_church_id)
          .single();
        if (churchData) {
          sendingChurch = churchData;
        }
      }

      // Fetch mission field church if mission_field_church_id exists
      let missionFieldChurch = null;
      if (missionaryData.mission_field_church_id) {
        const { data: churchData } = await supabase
          .from("churches")
          .select("id, name")
          .eq("id", missionaryData.mission_field_church_id)
          .single();
        if (churchData) {
          missionFieldChurch = churchData;
        }
      }

      // Fetch college if college_id exists
      let college = null;
      if (missionaryData.college_id) {
        const { data: collegeData } = await supabase
          .from("colleges")
          .select("id, name")
          .eq("id", missionaryData.college_id)
          .single();
        if (collegeData) {
          college = collegeData;
        }
      }

      // Fetch related page record
      let page = null;
      const { data: pageData } = await supabase
        .from("pages")
        .select("id, page_url, name, profile_photo_url, banner_photo_url, short_quote, about_text, intro_text, donation_percentage, is_published, donation_mode, external_donation_url")
        .eq("organization_type", "missionary")
        .eq("organization_id", missionaryData.id)
        .maybeSingle();
      
      if (pageData) {
        const p = pageData as Record<string, unknown>;
        page = {
          ...pageData,
          donation_mode: (p.donation_mode as "harvest21" | "external" | "off") ?? null,
          external_donation_url: (p.external_donation_url as string | null) ?? null,
        };
      }

      const raw = missionaryData as { visits_start_date?: string | null; visits_end_date?: string | null };
      return {
        id: missionaryData.id,
        user_id: missionaryData.user_id,
        is_managed_by_harvest21: missionaryData.is_managed_by_harvest21 ?? missionaryData.user_id == null,
        first_name: userData?.first_name || missionaryData.first_name || "",
        last_name: userData?.last_name || missionaryData.last_name || "",
        email: userData?.email || missionaryData.email || "",
        phone_number: missionaryData.phone_number ?? null,
        country_of_residence: missionaryData.country_of_residence,
        destination_country: missionaryData.destination_country || "",
        mission_status: missionaryData.mission_status || "",
        open_to_visits: missionaryData.open_to_visits || false,
        visits_start_date: raw.visits_start_date ?? null,
        visits_end_date: raw.visits_end_date ?? null,
        biography: missionaryData.biography,
        agency_id: missionaryData.agency_id,
        sending_church_id: missionaryData.sending_church_id,
        mission_field_church_id: missionaryData.mission_field_church_id,
        college_id: missionaryData.college_id,
        created_at: missionaryData.created_at,
        agency,
        sendingChurch,
        missionFieldChurch,
        college,
        page,
      };
    } catch (error) {
      console.error("Error fetching missionary detail:", error);
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
async function MissionaryDetailData({ id }: { id: string }) {
  await assertAdminOrStaff();
  const missionary = await getMissionaryDetail(id);
  
  if (!missionary) {
    notFound();
  }

  const pageData = await getPageDataWithRelations("missionary", missionary.id);
  const userProfile = await getUserProfile();
  const socialDiagnostics = await getMissionarySocialAdminDiagnostics(missionary.id);

  return (
    <MissionaryManagePageClient
      missionary={missionary}
      initialPageData={pageData}
      initialUserProfile={userProfile}
      isAdmin={true}
      socialDiagnostics={socialDiagnostics}
    />
  );
}

// Page component - Server Component
export default async function MissionaryManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MissionaryDetailData id={id} />
    </Suspense>
  );
}

