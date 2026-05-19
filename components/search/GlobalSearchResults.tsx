"use client";

import { useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import type { GlobalSearchResponse } from "@/types/search";
import {
  AgencyResultCard,
  ChurchResultCard,
  MissionaryResultCard,
} from "./SearchResultCard";

interface GlobalSearchResultsProps {
  results: GlobalSearchResponse;
  query: string;
  isLoading?: boolean;
  onClose: () => void;
}

export function GlobalSearchResults({
  results,
  query,
  isLoading = false,
  onClose,
}: GlobalSearchResultsProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on a result card
      if (target.closest('[data-search-result]')) {
        return;
      }
      
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  if (isLoading) {
    return (
      <div
        ref={dropdownRef}
        className="absolute top-full left-0 right-0 mt-2 max-h-[32rem] overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-xl z-50"
      >
        <div className="p-6 text-center text-zinc-400">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-brand-yellow border-t-transparent"></div>
          Searching...
        </div>
      </div>
    );
  }

  if (results.total === 0) {
    return (
      <div
        ref={dropdownRef}
        className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-white/10 bg-zinc-900 shadow-xl z-50"
      >
        <div className="p-6 text-center">
          <Search className="mx-auto mb-2 h-12 w-12 text-zinc-600" />
          <h3 className="mb-1 text-lg font-semibold text-white">No results found</h3>
          <p className="text-sm text-zinc-400">
            Try different keywords or check your spelling
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-2 max-h-[32rem] overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-xl z-50"
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-zinc-900 p-3">
        <span className="text-sm font-medium text-zinc-400">
          {results.total} {results.total === 1 ? "result" : "results"} for "{query}"
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          aria-label="Close search"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2">
        {results.agencies.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Mission Agencies
            </h3>
            {results.agencies.map((agency) => (
              <div key={`agency-${agency.id}`}>
                <AgencyResultCard agency={agency} onClose={onClose} />
                
                {agency.affiliated_missionaries && agency.affiliated_missionaries.length > 0 && (
                  <div className="ml-8 mt-1 mb-2 space-y-1">
                    <div className="px-2 text-xs font-medium text-zinc-600">
                      Missionaries ({agency.affiliated_missionaries.length})
                    </div>
                    {agency.affiliated_missionaries.map((missionary) => (
                      <MissionaryResultCard
                        key={`missionary-${missionary.id}`}
                        missionary={missionary}
                        showAgency={false}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {results.missionaries.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Missionaries
            </h3>
            {results.missionaries.map((missionary) => (
              <MissionaryResultCard
                key={`missionary-${missionary.id}`}
                missionary={missionary}
                showAgency={true}
                onClose={onClose}
              />
            ))}
          </div>
        )}

        {results.churches.length > 0 && (
          <div className="mb-2">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Churches
            </h3>
            {results.churches.map((church) => (
              <ChurchResultCard key={`church-${church.id}`} church={church} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

