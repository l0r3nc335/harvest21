"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { searchProfiles, fetchSectionById } from "@/app/admin/featured-sections/fetchActions";
import type { ProfileSearchResult } from "@/app/admin/featured-sections/fetchActions";
import { addProfile } from "@/app/admin/featured-sections/actions";
import type { FeaturedProfileCard } from "@/types/homepage";
import toast from "react-hot-toast";

interface ProfileSearchProps {
  sectionId: number;
  existingProfileIds: number[];
  onAdded: (profile: FeaturedProfileCard) => void;
}

export function ProfileSearch({ sectionId, existingProfileIds, onAdded }: ProfileSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<number | null>(null); // stores page_id
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }
      setIsLoading(true);
      const result = await searchProfiles(q, existingProfileIds);
      setResults(result.data ?? []);
      setShowResults(true);
      setIsLoading(false);
    },
    [existingProfileIds]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = async (result: ProfileSearchResult) => {
    setIsAdding(result.page_id);
    const actionResult = await addProfile(sectionId, result.page_id, result.organization_type);

    if (actionResult.success) {
      const sectionResult = await fetchSectionById(sectionId);
      if (sectionResult.success && sectionResult.data) {
        const added = sectionResult.data.profiles.find((p) => p.profile_id === result.page_id);
        if (added) onAdded(added);
      }
      toast.success(`${result.name} added`);
      setQuery("");
      setResults([]);
      setShowResults(false);
    } else {
      toast.error(actionResult.error ?? "Failed to add profile");
    }
    setIsAdding(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search missionaries, churches, agencies..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-400">No published profiles found.</p>
          ) : (
            results.map((r) => {
              const typeBadgeClass =
                r.organization_type === "missionary"
                  ? "bg-yellow-500/20 text-yellow-700"
                  : r.organization_type === "church"
                  ? "bg-blue-500/20 text-blue-700"
                  : "bg-green-500/20 text-green-700";

              const typeLabel =
                r.organization_type === "missionary"
                  ? "Missionary"
                  : r.organization_type === "church"
                  ? "Church"
                  : "Agency";

              return (
                <button
                  key={r.page_id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAdd(r);
                  }}
                  disabled={isAdding === r.page_id}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 border-b border-zinc-100 last:border-0"
                >
                  <MissionaryProfileImage
                    src={r.profile_photo_url}
                    alt={r.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{r.name}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}>
                      {typeLabel}
                    </span>
                  </div>
                  {isAdding === r.page_id ? (
                    <Loader2 className="h-4 w-4 shrink-0 text-zinc-400 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-zinc-400" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
