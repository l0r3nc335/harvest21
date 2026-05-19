import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMissionaryPreviewBySlug, getOrganizationPreviewBySlug, getPageOGData } from "./actions";
import { getBaseUrl } from "@/lib/envHelpers";
import { MissionaryPublicView } from "@/components/missionary/MissionaryPublicView";
import { OrganizationPublicView } from "@/components/organization/OrganizationPublicView";
import { ChurchPublicView } from "@/components/church/ChurchPublicView";
import { AgencyPublicView } from "@/components/agency/AgencyPublicView";
import { PreviewBanner } from "@/components/PreviewBanner";
import { getUserProfile } from "@/lib/navbarHelpers";
import { getMissionaryFollowerStatus, getMissionaryFollowerStatusAsAgency, getMissionaryFollowerStatusAsChurch } from "@/app/missionaries/follow-actions";
import { getMissionaryFollowerStatusAsMissionary } from "@/app/missionaries/missionary-following-actions";
import type { FollowerStatus } from "@/types/follow";

// Force dynamic rendering to always fetch fresh follower status
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ page_url: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { page_url } = await params;
  const sp = await searchParams;
  const focus = typeof sp.focus === "string" ? sp.focus : undefined;

  const og = await getPageOGData(page_url, focus);
  if (!og) {
    return { title: "Harvest21" };
  }

  const baseUrl = getBaseUrl();
  const focusQuery = focus ? `?tab=${sp.tab || ""}&focus=${focus}` : "";
  const fullUrl = `${baseUrl}/${og.pageUrl}${focusQuery}`;

  const fallbackImage = process.env.HARVEST_21_LOGO || `${baseUrl}/icon.svg`;
  const ogImage = og.imageUrl
    ? (og.imageUrl.startsWith("http") ? og.imageUrl : `${baseUrl}${og.imageUrl}`)
    : fallbackImage;

  return {
    title: `${og.title} | Harvest21`,
    description: og.description || "Harvest21 - Supporting missionaries worldwide",
    openGraph: {
      title: og.title,
      description: og.description || "Harvest21 - Supporting missionaries worldwide",
      url: fullUrl,
      siteName: "Harvest21",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: og.title,
      description: og.description || "Harvest21 - Supporting missionaries worldwide",
      images: [ogImage],
    },
  };
}

// Async server component that fetches data
async function PagePreviewData({ slug }: { slug: string }) {
  // Fetch user profile and page data in parallel for better performance
  const [userProfile, missionaryResult, organizationResult] = await Promise.all([
    getUserProfile(),
    getMissionaryPreviewBySlug(slug),
    getOrganizationPreviewBySlug(slug),
  ]);
  
  if (missionaryResult.success && missionaryResult.data) {
    let followerStatus: FollowerStatus = "none";
    
    if (userProfile?.role === 3) {
      followerStatus = await getMissionaryFollowerStatusAsMissionary(missionaryResult.data.missionary.id);
    } else if (userProfile?.role === 5) {
      followerStatus = await getMissionaryFollowerStatusAsAgency(missionaryResult.data.missionary.id);
    } else if (userProfile?.role === 6) {
      followerStatus = await getMissionaryFollowerStatusAsChurch(missionaryResult.data.missionary.id);
    } else {
      followerStatus = await getMissionaryFollowerStatus(missionaryResult.data.missionary.id);
    }

    return (
      <>
        {missionaryResult.data.isPreviewMode && <PreviewBanner />}
        <MissionaryPublicView
          missionary={missionaryResult.data.missionary}
          page={missionaryResult.data.page}
          media={missionaryResult.data.media}
          widgets={missionaryResult.data.widgets}
          donations={missionaryResult.data.donations}
          isAdminPreview={false}
          initialUserProfile={userProfile}
          isLoading={false}
          isOwner={missionaryResult.data.isOwner || false}
          followerStatus={followerStatus}
        />
      </>
    );
  }
  
  if (organizationResult.success && organizationResult.data && organizationResult.organizationType) {
    // Use ChurchPublicView for churches
    if (organizationResult.organizationType === "church") {
      return (
        <>
          {organizationResult.data.isPreviewMode && <PreviewBanner />}
          <ChurchPublicView
            church={{
              id: organizationResult.data.organization.id,
              name: organizationResult.data.organization.name,
              description: null,
              address: organizationResult.data.organization.address || null,
              city: organizationResult.data.organization.city || null,
              state: organizationResult.data.organization.state || null,
              country: organizationResult.data.organization.country || null,
              phone_number: organizationResult.data.organization.phone_number || null,
              website: organizationResult.data.organization.website || null,
              email: null,
              contact_user_id: organizationResult.data.organization.contact_user_id,
              is_managed_by_harvest21: organizationResult.data.organization.is_managed_by_harvest21 ?? false,
            }}
            page={{
              id: organizationResult.data.page.id,
              page_url: organizationResult.data.page.page_url,
              profile_photo_url: organizationResult.data.page.profile_photo_url,
              banner_photo_url: organizationResult.data.page.banner_photo_url,
              short_quote: organizationResult.data.page.short_quote,
              template_content: organizationResult.data.page.template_content,
              video_hashed_id: organizationResult.data.page.video_hashed_id,
              is_published: organizationResult.data.page.is_published,
            }}
            media={organizationResult.data.media}
            missionaries={organizationResult.data?.missionaries || []}
            initialUserProfile={userProfile}
            followerStatus={(organizationResult.data?.followerStatus || "none") as "none" | "pending" | "accepted" | "rejected" | "blocked"}
            followerCount={organizationResult.data?.followerCount || 0}
            isAdminPreview={false}
            isOwner={organizationResult.data.isOwner || false}
          />
        </>
      );
    }

    // Use AgencyPublicView for agencies (MA-LP-001)
    if (organizationResult.organizationType === "agency") {
      return (
        <>
          {organizationResult.data.isPreviewMode && <PreviewBanner />}
          <AgencyPublicView
            agency={{
              id: organizationResult.data.organization.id,
              name: organizationResult.data.organization.name,
              description: null,
              address: organizationResult.data.organization.address || null,
              city: organizationResult.data.organization.city || null,
              country: organizationResult.data.organization.country || null,
              phone_number: organizationResult.data.organization.phone_number || null,
              website: organizationResult.data.organization.website || null,
              email: organizationResult.data.organization.email || null,
              contact_user_id: organizationResult.data.organization.contact_user_id,
              is_managed_by_harvest21: organizationResult.data.organization.is_managed_by_harvest21 ?? false,
            }}
            page={{
              id: organizationResult.data.page.id,
              page_url: organizationResult.data.page.page_url,
              banner_photo_url: organizationResult.data.page.banner_photo_url,
              short_quote: organizationResult.data.page.short_quote,
              template_content: organizationResult.data.page.template_content,
              video_hashed_id: organizationResult.data.page.video_hashed_id,
              is_published: organizationResult.data.page.is_published,
              page_template: (organizationResult.data.page as any).page_template ?? null,
            }}
            media={organizationResult.data.media}
            missionaries={organizationResult.data?.missionaries || []}
            initialUserProfile={userProfile}
            isAdminPreview={false}
          />
        </>
      );
    }
    
    // Use OrganizationPublicView for colleges
    return (
      <>
        {organizationResult.data.isPreviewMode && <PreviewBanner />}
        <OrganizationPublicView
          organization={organizationResult.data.organization}
          page={{
            ...organizationResult.data.page,
            page_template: (organizationResult.data.page as any).page_template ?? null,
          }}
          media={organizationResult.data.media}
          donations={organizationResult.data.donations}
          organizationType={organizationResult.organizationType as "college" | "agency"}
          initialUserProfile={userProfile}
        />
      </>
    );
  }

  // If neither worked, show 404
  console.error("Preview fetch failed - missionary:", missionaryResult.error, "organization:", organizationResult.error);
  notFound();
}

// Simple loading fallback that uses the component's own skeleton
async function LoadingFallback() {
  const userProfile = await getUserProfile();
  return <MissionaryPublicView isLoading={true} initialUserProfile={userProfile} missionary={{ id: 0, first_name: "", last_name: "", destination_country: null }} page={{ id: 0, page_url: "", name: null, profile_photo_url: null, banner_photo_url: null, short_quote: null, about_text: null, intro_text: null, template_content: null, video_hashed_id: null, donation_percentage: null, is_published: false, published_at: null }} media={[]} />;
}

// Page component - Server Component
export default async function PublicPagePreview({ params }: PageProps) {
  const { page_url } = await params;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PagePreviewData slug={page_url} />
    </Suspense>
  );
}

