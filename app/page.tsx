import { NavbarWrapper } from "@/components/NavbarWrapper";
import { BannerCarousel } from "@/components/BannerCarousel";
import { HomePageClient } from "@/components/HomePageClient";
import { Footer } from "@/components/Footer";
import { fetchActiveBanners, fetchActiveHomepageSettings } from "@/app/admin/homepage-settings/fetchActions";
import { fetchActiveFeaturedSections } from "@/app/admin/featured-sections/fetchActions";
import { getCurrentUserProfile, getAuthUserId } from "@/lib/userActions";
import { fetchMissionariesOverview } from "@/app/actions/missionaryActions";
import { getContentUpdateBadgesForMissionaries } from "@/lib/missionaryContentUpdates";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const [missionariesByRegion, bannersResult, settingsResult, userProfile, featuredSectionsResult, authUserId] =
    await Promise.all([
      fetchMissionariesOverview(),
      fetchActiveBanners(),
      fetchActiveHomepageSettings(),
      getCurrentUserProfile(),
      fetchActiveFeaturedSections(),
      getAuthUserId(),
    ]);

  const banners = bannersResult.success ? bannersResult.data || [] : [];
  const settings = settingsResult.success ? settingsResult.data : null;
  const featuredSections = featuredSectionsResult.success
    ? featuredSectionsResult.data || []
    : [];
  const userRole = userProfile?.role || null;
  const isLoggedIn = !!userProfile;

  const allMissionaryIds = [
    ...new Set([
      ...Object.values(missionariesByRegion).flatMap((list) => list.map((m) => m.id)),
      ...featuredSections.flatMap((fs) =>
        fs.profiles.map((p) => p.missionary_id).filter((id): id is number => id != null)
      ),
    ]),
  ];

  const contentBadgesByMissionaryId =
    authUserId && allMissionaryIds.length > 0
      ? await getContentUpdateBadgesForMissionaries(authUserId, allMissionaryIds)
      : {};

  return (
    <div className="flex min-h-screen flex-col bg-[#000000] font-sans">
      <NavbarWrapper />
      <BannerCarousel banners={banners} settings={settings} />
      <HomePageClient 
        missionariesByRegion={missionariesByRegion}
        userRole={userRole}
        isLoggedIn={isLoggedIn}
        featuredSections={featuredSections}
        contentBadgesByMissionaryId={contentBadgesByMissionaryId}
      />
      <Footer />
    </div>
  );
}
