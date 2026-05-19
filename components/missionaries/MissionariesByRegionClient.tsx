"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MissionaryCard } from "@/components/MissionaryCard";
import { Button } from "@/components/ui/Button";
import type { PaginatedMissionariesResponse, MissionaryData } from "@/app/missionaries/[region]/actions";

type SortOption = "recent-activity" | "newly-added" | "name-asc" | "name-desc";
type FilterType = "all" | "agency" | "country";

interface MissionariesByRegionClientProps {
  paginatedResponse: PaginatedMissionariesResponse;
  region: string;
  userRole?: number | null;
  isLoggedIn?: boolean;
}

export function MissionariesByRegionClient({ paginatedResponse, region, userRole = null, isLoggedIn = false }: MissionariesByRegionClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionaries = paginatedResponse.data;
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent-activity");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const formatRegionName = (region: string) => {
    return region
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const uniqueCountries = useMemo(() => {
    const countries = new Set(missionaries.map((m) => m.country_of_residence).filter(Boolean));
    return Array.from(countries).sort();
  }, [missionaries]);

  const uniqueAgencies = useMemo(() => {
    const agencies = new Set(
      missionaries.map((m) => m.agency?.name).filter(Boolean)
    );
    return Array.from(agencies).sort();
  }, [missionaries]);

  const filteredAndSortedMissionaries = useMemo(() => {
    let filtered = [...missionaries];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.first_name?.toLowerCase().includes(query) ||
          m.last_name?.toLowerCase().includes(query) ||
          m.country_of_residence?.toLowerCase().includes(query) ||
          m.agency?.name?.toLowerCase().includes(query)
      );
    }

    if (filterType !== "all" && selectedFilter !== "all") {
      filtered = filtered.filter((m) => {
        switch (filterType) {
          case "country":
            return m.country_of_residence === selectedFilter;
          case "agency":
            return m.agency?.name === selectedFilter;
          default:
            return true;
        }
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "recent-activity":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "newly-added":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name-asc":
          return (a.last_name || "").localeCompare(b.last_name || "");
        case "name-desc":
          return (b.last_name || "").localeCompare(a.last_name || "");
        default:
          return 0;
      }
    });

    return filtered;
  }, [missionaries, searchQuery, sortBy, filterType, selectedFilter]);

  const resetFilters = () => {
    setFilterType("all");
    setSelectedFilter("all");
    setSearchQuery("");
    setSortBy("recent-activity");
  };

  const hasActiveFilters = filterType !== "all" || searchQuery !== "" || sortBy !== "recent-activity";

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    // Reset to page 1 if limit changes, or keep current page
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?${params.toString()}`);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black pb-16">
      {/* Header Section */}
      <div className="border-b border-white/10 bg-black/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-4xl font-bold text-white">
            Missionaries in {formatRegionName(region)}
          </h1>
          <p className="text-zinc-400">
            {paginatedResponse.total > 0 ? (
              <>
                Showing {((paginatedResponse.page - 1) * paginatedResponse.limit) + 1} - {Math.min(paginatedResponse.page * paginatedResponse.limit, paginatedResponse.total)} of {paginatedResponse.total} {paginatedResponse.total === 1 ? "missionary" : "missionaries"}
                {paginatedResponse.total_pages > 1 && ` • Page ${paginatedResponse.page} of ${paginatedResponse.total_pages}`}
              </>
            ) : (
              "No missionaries found"
            )}
          </p>
        </div>
      </div>

      {/* Controls Section */}
      <div className="sticky top-16 z-20 border-b border-white/10 bg-black/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name, mission field, agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20"
              />
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Items per page */}
              <select
                value={paginatedResponse.limit}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("limit", e.target.value);
                  params.set("page", "1"); // Reset to page 1 when limit changes
                  const currentPath = window.location.pathname;
                  router.push(`${currentPath}?${params.toString()}`);
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20 cursor-pointer"
              >
                <option value="12">12 per page</option>
                <option value="24">24 per page</option>
                <option value="48">48 per page</option>
                <option value="96">96 per page</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20 cursor-pointer"
              >
                <option value="recent-activity">Most Recent Activity</option>
                <option value="newly-added">Newly Added</option>
                <option value="name-asc">Alphabetical (A-Z)</option>
                <option value="name-desc">Alphabetical (Z-A)</option>
              </select>

              {/* Filter Button */}
              <Button
                variant="secondary"
                onClick={() => setShowFilters(!showFilters)}
                className={`rounded-lg border ${
                  showFilters || hasActiveFilters
                    ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow"
                    : "border-zinc-700 bg-zinc-900 text-white"
                } px-4 py-2.5 text-sm font-medium transition-all hover:border-brand-yellow hover:bg-brand-yellow/20`}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-black">
                    !
                  </span>
                )}
              </Button>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <Button
                  variant="secondary"
                  onClick={resetFilters}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:border-red-500 hover:bg-red-500/10 hover:text-red-500"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 animate-fade-in rounded-lg border border-white/10 bg-zinc-900/50 p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Filter Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">
                    Filter By
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value as FilterType);
                      setSelectedFilter("all");
                    }}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20 cursor-pointer"
                  >
                    <option value="all">All Missionaries</option>
                    <option value="country">Country</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>

                {/* Country Filter */}
                {filterType === "country" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-400">
                      Select Country
                    </label>
                    <select
                      value={selectedFilter}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20 cursor-pointer"
                    >
                      <option value="all">All Countries</option>
                      {uniqueCountries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Agency Filter */}
                {filterType === "agency" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-400">
                      Select Agency
                    </label>
                    <select
                      value={selectedFilter}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20"
                    >
                      <option value="all">All Agencies</option>
                      {uniqueAgencies.map((agency) => (
                        <option key={agency} value={agency}>
                          {agency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Missionaries Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {filteredAndSortedMissionaries.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAndSortedMissionaries.map((missionary) => (
              <MissionaryCard
                key={missionary.id}
                id={missionary.id}
                firstName={missionary.first_name}
                lastName={missionary.last_name}
                country={missionary.country_of_residence}
                pageUrl={missionary.pages?.page_url || ""}
                profilePhotoUrl={missionary.pages?.profile_photo_url || ""}
                pageName={missionary.pages?.name}
                userRole={userRole}
                isLoggedIn={isLoggedIn}
                layout="grid"
                churchName={missionary.church?.name ?? null}
                isManagedByHarvest21={missionary.is_managed_by_harvest21 === true}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900">
              <Search className="h-10 w-10 text-zinc-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">No missionaries found</h3>
            <p className="mb-6 max-w-md text-zinc-400">
              Try adjusting your search or filters to find what you're looking for.
            </p>
            {hasActiveFilters && (
              <Button
                onClick={resetFilters}
                className="rounded-lg bg-brand-yellow px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-brand-yellow/90"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {paginatedResponse.total > 0 && (
          <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-8">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <Button
                onClick={() => handlePageChange(paginatedResponse.page - 1)}
                disabled={paginatedResponse.page === 1}
                variant="secondary"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:border-brand-yellow hover:bg-brand-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>

            <div className="flex items-center gap-2">
              {Array.from({ length: paginatedResponse.total_pages }, (_, i) => i + 1)
                .filter((pageNum) => {
                  // Show first page, last page, current page, and pages around current
                  if (pageNum === 1 || pageNum === paginatedResponse.total_pages) return true;
                  if (Math.abs(pageNum - paginatedResponse.page) <= 1) return true;
                  return false;
                })
                .map((pageNum, index, array) => {
                  // Add ellipsis if there's a gap
                  const showEllipsisBefore = index > 0 && pageNum - array[index - 1] > 1;
                  
                  return (
                    <div key={pageNum} className="flex items-center gap-2">
                      {showEllipsisBefore && (
                        <span className="px-2 text-zinc-500">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-[40px] rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          pageNum === paginatedResponse.page
                            ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow"
                            : "border-zinc-700 bg-zinc-900 text-white hover:border-brand-yellow hover:bg-brand-yellow/10"
                        }`}
                      >
                        {pageNum}
                      </button>
                    </div>
                  );
                })}
            </div>

              <Button
                onClick={() => handlePageChange(paginatedResponse.page + 1)}
                disabled={paginatedResponse.page === paginatedResponse.total_pages}
                variant="secondary"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:border-brand-yellow hover:bg-brand-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            {paginatedResponse.total_pages > 1 && (
              <p className="text-sm text-zinc-500">
                Page {paginatedResponse.page} of {paginatedResponse.total_pages}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

