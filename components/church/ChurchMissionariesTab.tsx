"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MissionaryCard } from "@/components/MissionaryCard";
import { Button } from "@/components/ui/Button";
import type { FollowerStatus } from "@/types/follow";

type SortOption = "recent-activity" | "newly-added" | "name-asc" | "name-desc";
type FilterType = "all" | "country";

type ChurchMissionary = {
  id: number;
  first_name: string;
  last_name: string;
  destination_country?: string | null;
  country_of_residence: string | null;
  is_managed_by_harvest21?: boolean;
  page_url: string | null;
  profile_photo_url: string | null;
  page_name?: string | null;
  created_at?: string;
  follower_status?: string;
};

interface ChurchMissionariesTabProps {
  missionaries: ChurchMissionary[];
  isLoggedIn?: boolean;
  userRole?: number | null;
  /** Name of the church whose missionaries are being displayed (same for all missionaries on this tab) */
  churchName?: string | null;
}

export function ChurchMissionariesTab({ missionaries, isLoggedIn = false, userRole = null, churchName = null }: ChurchMissionariesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent-activity");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const getMissionCountry = (missionary: ChurchMissionary) =>
    missionary.destination_country || missionary.country_of_residence || null;

  const uniqueCountries = useMemo(() => {
    const countries = new Set(
      missionaries.map((m) => getMissionCountry(m)).filter((c): c is string => c != null)
    );
    return Array.from(countries).sort();
  }, [missionaries]);

  const filteredAndSortedMissionaries = useMemo(() => {
    let filtered = [...missionaries];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.first_name?.toLowerCase().includes(query) ||
          m.last_name?.toLowerCase().includes(query) ||
          getMissionCountry(m)?.toLowerCase().includes(query) ||
          m.page_name?.toLowerCase().includes(query)
      );
    }

    // Country filter
    if (filterType === "country" && selectedFilter !== "all") {
      filtered = filtered.filter((m) => getMissionCountry(m) === selectedFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "recent-activity":
          // Use created_at if available, otherwise maintain order
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return 0;
        case "newly-added":
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return 0;
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, selectedFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedMissionaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMissionaries = filteredAndSortedMissionaries.slice(startIndex, endIndex);

  const resetFilters = () => {
    setFilterType("all");
    setSelectedFilter("all");
    setSearchQuery("");
    setSortBy("recent-activity");
    setCurrentPage(1);
  };

  const hasActiveFilters = filterType !== "all" || searchQuery !== "" || sortBy !== "recent-activity";

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  return (
    <div>
      {/* Controls Section */}
      <div className="sticky top-16 z-20 border-b border-white/10 bg-black/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-7xl py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name, mission field..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20"
              />
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Items per page */}
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
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
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setCurrentPage(1);
                }}
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
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/20 cursor-pointer"
                  >
                    <option value="all">All Missionaries</option>
                    <option value="country">Country</option>
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
                      onChange={(e) => {
                        setSelectedFilter(e.target.value);
                        setCurrentPage(1);
                      }}
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Missionaries Grid */}
      <div className="mt-8">
        {paginatedMissionaries.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedMissionaries.map((missionary) => (
                <MissionaryCard
                  key={missionary.id}
                  id={missionary.id}
                  firstName={missionary.first_name}
                  lastName={missionary.last_name}
                  country={getMissionCountry(missionary) || "Unknown"}
                  pageUrl={missionary.page_url}
                  profilePhotoUrl={missionary.profile_photo_url || "/placeholder.jpg"}
                  pageName={missionary.page_name}
                  layout="grid"
                  isLoggedIn={isLoggedIn}
                  userRole={userRole}
                  churchName={churchName ?? null}
                  isManagedByHarvest21={missionary.is_managed_by_harvest21 === true}
                  followerStatus={(missionary.follower_status || "none") as FollowerStatus}
                />
              ))}
            </div>

            {/* Pagination Controls. */}
            {filteredAndSortedMissionaries.length > 0 && (
              <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-8">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="secondary"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:border-brand-yellow hover:bg-brand-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((pageNum) => {
                        // Show first page, last page, current page, and pages around current
                        if (pageNum === 1 || pageNum === totalPages) return true;
                        if (Math.abs(pageNum - currentPage) <= 1) return true;
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
                                pageNum === currentPage
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
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="secondary"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:border-brand-yellow hover:bg-brand-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                {totalPages > 1 && (
                  <p className="text-sm text-zinc-500">
                    Showing {startIndex + 1} - {Math.min(endIndex, filteredAndSortedMissionaries.length)} of {filteredAndSortedMissionaries.length} missionaries • Page {currentPage} of {totalPages}
                  </p>
                )}
              </div>
            )}
          </>
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
      </div>
    </div>
  );
}
