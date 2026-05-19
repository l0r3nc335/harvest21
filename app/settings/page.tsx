import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, getCurrentMissionaryData, getCurrentEntityData } from "./actions";
import { getSupporterProfile } from "./supporter-actions";
import { getPageDataWithRelations } from "@/lib/pageDataLoader";
import { getUnreadNotificationCount } from "@/lib/notificationHelpers";
import { MissionarySettingsClient } from "@/components/settings/MissionarySettingsClient";
import { EntitySettingsClient } from "@/components/settings/EntitySettingsClient";
import { SupporterSettingsClient } from "@/components/supporter/SupporterSettingsClient";

function LoadingFallback() {
  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen bg-black">
      <div className="mb-3 sm:mb-4">
        <div className="h-6 sm:h-8 w-48 sm:w-64 bg-zinc-800 rounded animate-pulse mb-2"></div>
        <div className="h-3 sm:h-4 w-72 sm:w-96 bg-zinc-800 rounded animate-pulse"></div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
        <div className="w-full md:w-64 bg-zinc-900 h-48 sm:h-64 md:h-96 rounded animate-pulse"></div>
        <div className="flex-1 space-y-3 sm:space-y-4">
          <div className="h-48 sm:h-64 bg-zinc-900 rounded animate-pulse"></div>
          <div className="h-48 sm:h-64 bg-zinc-900 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

async function SettingsData({ searchParams }: { searchParams: Promise<{ tab?: string }> | { tab?: string } }) {
  const profile = await getCurrentUserProfile();
  
  // Await searchParams if it's a Promise (Next.js 15+)
  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const initialTab = params.tab || "account";

  if (!profile.success) {
    console.error("Settings profile error:", profile.error);
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
        </div>
      </div>
    );
  }

  if (!profile.data) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
        </div>
      </div>
    );
  }

  const { role, organizationType, organizationId } = profile.data;

  if (role === 1 || role === 2) {
    redirect("/admin");
  }

  const unreadCount = await getUnreadNotificationCount();

  if (role === 4) {
    const supporterResult = await getSupporterProfile();
    
    if (!supporterResult.success || !supporterResult.data) {
      return (
        <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
          <div className="text-center px-4">
            <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
            <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
          </div>
        </div>
      );
    }

    return <SupporterSettingsClient profile={supporterResult.data} initialTab={initialTab} initialUnreadCount={unreadCount} />;
  }

  if (!organizationType || !organizationId) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
        </div>
      </div>
    );
  }

  if (organizationType === "missionary") {
    const missionaryResult = await getCurrentMissionaryData(organizationId);
    
    if (!missionaryResult.success) {
      console.error("Missionary data error:", missionaryResult.error);
      return (
        <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
          <div className="text-center px-4">
            <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
            <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
          </div>
        </div>
      );
    }

    if (!missionaryResult.data) {
      return (
        <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
          <div className="text-center px-4">
            <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
            <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
          </div>
        </div>
      );
    }

    const pageData = await getPageDataWithRelations("missionary", organizationId);

    return (
      <MissionarySettingsClient
        missionary={missionaryResult.data}
        initialPageData={pageData}
        initialTab={initialTab}
        initialUnreadCount={unreadCount}
      />
    );
  }

  const entityResult = await getCurrentEntityData(organizationType, organizationId);
  
  if (!entityResult.success) {
    console.error("Entity data error:", entityResult.error);
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
        </div>
      </div>
    );
  }

  if (!entityResult.data) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <Image src="/logo.svg" alt="Harvest21" width={200} height={80} className="mx-auto mb-6" />
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm sm:text-base text-zinc-400">We couldn&apos;t load this page. Please try again or contact support.</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-brand-light-yellow text-black font-medium rounded hover:brightness-90 transition-colors">Go to Home</Link>
        </div>
      </div>
    );
  }

  const pageData = await getPageDataWithRelations(organizationType, organizationId);

  return (
    <EntitySettingsClient
      entity={entityResult.data}
      entityType={organizationType}
      initialPageData={pageData}
      initialTab={initialTab}
      initialUnreadCount={unreadCount}
    />
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }> | { tab?: string };
}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SettingsData searchParams={searchParams} />
    </Suspense>
  );
}

