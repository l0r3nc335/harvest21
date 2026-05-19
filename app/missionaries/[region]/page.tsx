import { Suspense } from "react";
import { Metadata } from "next";

/** Every load runs server data fetch (SPA navigation or full refresh). */
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { MissionariesLoadingSkeleton } from "@/components/missionaries/MissionariesLoadingSkeleton";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MissionariesContent } from "./missionaries-content";

type PageProps = {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params;
  const decodedRegion = decodeURIComponent(region);
  const formattedRegion = decodedRegion
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  return {
    title: `Missionaries in ${formattedRegion} | Harvest21`,
    description: `Discover and support missionaries serving in ${formattedRegion}. Browse profiles, read updates, and connect with missionaries making a difference.`,
  };
}

export default async function MissionariesByRegionPage({ params, searchParams }: PageProps) {
  const { region } = await params;
  const decodedRegion = decodeURIComponent(region);
  
  const resolvedSearchParams = await searchParams;
  const page = typeof resolvedSearchParams.page === "string" 
    ? parseInt(resolvedSearchParams.page, 10) || 1 
    : 1;
  const limit = typeof resolvedSearchParams.limit === "string" 
    ? parseInt(resolvedSearchParams.limit, 10) || 12 
    : 12;

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <Navbar />
      <main className="flex-1 pt-16">
        <Suspense fallback={<MissionariesLoadingSkeleton />}>
          <MissionariesContent 
            region={decodedRegion}
            page={page}
            limit={limit}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

