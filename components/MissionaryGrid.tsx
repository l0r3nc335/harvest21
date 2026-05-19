"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MissionaryCard } from "./MissionaryCard";
import { Button } from "./ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FollowerStatus } from "@/types/follow";

interface Missionary {
  id: number;
  first_name: string;
  last_name: string;
  country?: string;
  country_of_residence?: string | null;
  is_managed_by_harvest21?: boolean;
  page_url: string | null;
  profile_photo_url: string | null;
  page_name?: string | null;
  follower_status?: string;
  is_owner?: boolean;
  is_published?: boolean;
}

const LIMIT_OPTIONS = [12, 20, 24, 48, 96] as const;

interface MissionaryGridProps {
  missionaries: Missionary[] | null | undefined;
  userRole?: number | null;
  isLoggedIn?: boolean;
  title?: string;
  emptyMessage?: string;
}

export function MissionaryGrid({
  missionaries,
  userRole = null,
  isLoggedIn = false,
  title = "Our Missionaries",
  emptyMessage = "No missionaries to display yet.",
}: MissionaryGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safeMissionaries = Array.isArray(missionaries) ? missionaries : [];
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = (() => {
    const raw = parseInt(searchParams.get("limit") || "20", 10);
    return LIMIT_OPTIONS.includes(raw as (typeof LIMIT_OPTIONS)[number]) ? raw : 20;
  })();

  const totalPages = Math.max(1, Math.ceil(safeMissionaries.length / limit));
  const startIndex = (currentPage - 1) * limit;
  const paginatedMissionaries = safeMissionaries.slice(startIndex, startIndex + limit);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", Math.max(1, Math.min(newPage, totalPages)).toString());
      router.push(`${pathname}?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pathname, router, searchParams, totalPages]
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", newLimit.toString());
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Clamp current page if it exceeds total pages (e.g. after limit change)
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [currentPage, totalPages, pathname, router, searchParams]);

  return (
    <div className="mb-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white max-sm:text-xl">{title}</h2>
          {safeMissionaries.length > 0 && (
            <p className="mt-1 text-sm text-zinc-400">
              Showing {startIndex + 1}-{Math.min(startIndex + limit, safeMissionaries.length)} of {safeMissionaries.length} {safeMissionaries.length === 1 ? "missionary" : "missionaries"}
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </p>
          )}
        </div>
        {safeMissionaries.length > 0 && (
          <div className="flex items-center gap-3">
            <label htmlFor="missionary-grid-limit" className="text-sm text-zinc-400">
              Per page
            </label>
            <select
              id="missionary-grid-limit"
              value={limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 cursor-pointer"
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} per page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {safeMissionaries.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {paginatedMissionaries.map((missionary) => (
              <MissionaryCard
                key={missionary.id}
                id={missionary.id}
                firstName={missionary.first_name}
                lastName={missionary.last_name}
                country={missionary.country ?? missionary.country_of_residence ?? "Unknown"}
                pageUrl={missionary.page_url ?? undefined}
                profilePhotoUrl={missionary.profile_photo_url ?? "/placeholder.jpg"}
                pageName={missionary.page_name}
                userRole={userRole}
                isLoggedIn={isLoggedIn}
                followerStatus={(missionary.follower_status || "none") as FollowerStatus}
                isOwner={missionary.is_owner || false}
                isPublished={missionary.is_published !== false}
                isManagedByHarvest21={missionary.is_managed_by_harvest21 === true}
                layout="grid"
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-8">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="secondary"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:border-[#E1B94D] hover:bg-[#E1B94D]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((pageNum) => {
                      if (pageNum === 1 || pageNum === totalPages) return true;
                      if (Math.abs(pageNum - currentPage) <= 1) return true;
                      return false;
                    })
                    .map((pageNum, index, array) => {
                      const showEllipsisBefore = index > 0 && pageNum - array[index - 1] > 1;
                      return (
                        <div key={pageNum} className="flex items-center gap-2">
                          {showEllipsisBefore && (
                            <span className="px-2 text-zinc-500">...</span>
                          )}
                          <button
                            onClick={() => handlePageChange(pageNum)}
                            className={`min-w-[40px] rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                              pageNum === currentPage
                                ? "border-[#E1B94D] bg-[#E1B94D]/10 text-[#E1B94D]"
                                : "border-zinc-700 bg-zinc-900 text-white hover:border-[#E1B94D] hover:bg-[#E1B94D]/10"
                            }`}
                          >
                            {pageNum}
                          </button>
                        </div>
                      );
                    })}
                </div>
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="secondary"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:border-[#E1B94D] hover:bg-[#E1B94D]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-zinc-500">
                Page {currentPage} of {totalPages}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 py-12 text-center">
          <p className="text-zinc-400">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
