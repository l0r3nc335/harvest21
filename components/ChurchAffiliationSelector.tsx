"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import {
  getAffiliatedChurches,
  searchAvailableChurches,
  addChurchAffiliation,
  removeChurchAffiliation,
  type AffiliatedChurch,
} from "@/app/church-affiliation-actions";

type ChurchAffiliationSelectorProps = {
  missionaryId: number;
  readOnly?: boolean;
  excludeChurchIds?: number[];
  onSuccess?: () => void;
};

type ChurchOption = {
  id: number;
  name: string;
};

export function ChurchAffiliationSelector({ missionaryId, readOnly = false, excludeChurchIds = [], onSuccess }: ChurchAffiliationSelectorProps) {
  const [affiliatedChurches, setAffiliatedChurches] = useState<AffiliatedChurch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChurchOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAffiliatedChurches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionaryId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0 || showDropdown) {
        performSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadAffiliatedChurches = async () => {
    try {
      const result = await getAffiliatedChurches(missionaryId);
      if (result.success && result.data) {
        setAffiliatedChurches(result.data);
      } else {
        toast.error(result.error || "Failed to load affiliated churches");
      }
    } catch (error) {
      console.error("Error loading affiliated churches:", error);
      toast.error("An error occurred while loading churches");
    }
  };

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const excludeIds = [
        ...affiliatedChurches.map((c) => c.church_id),
        ...excludeChurchIds,
      ];
      const results = await searchAvailableChurches(missionaryId, query, excludeIds);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching churches:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddChurch = async (church: ChurchOption) => {
    const optimisticChurch: AffiliatedChurch = {
      id: -Date.now(),
      church_id: church.id,
      church_name: church.name,
      created_at: new Date().toISOString(),
    };

    setAffiliatedChurches(prev => [...prev, optimisticChurch]);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);

    try {
      const result = await addChurchAffiliation(missionaryId, church.id);
      if (result.success) {
        await loadAffiliatedChurches();
        onSuccess?.();
      } else {
        setAffiliatedChurches(prev => prev.filter(c => c.id !== optimisticChurch.id));
        toast.error(result.message || "Failed to add church");
      }
    } catch (error) {
      setAffiliatedChurches(prev => prev.filter(c => c.id !== optimisticChurch.id));
      console.error("Error adding church:", error);
      toast.error("An error occurred while adding church");
    }
  };

  const handleRemoveChurch = async (affiliationId: number) => {
    const removedChurch = affiliatedChurches.find(c => c.id === affiliationId);
    if (!removedChurch) return;

    setAffiliatedChurches(prev => prev.filter(c => c.id !== affiliationId));

    try {
      const result = await removeChurchAffiliation(affiliationId, missionaryId);
      if (result.success) {
        onSuccess?.();
      } else {
        setAffiliatedChurches(prev => [...prev, removedChurch]);
        toast.error(result.message || "Failed to remove church");
      }
    } catch (error) {
      setAffiliatedChurches(prev => [...prev, removedChurch]);
      console.error("Error removing church:", error);
      toast.error("An error occurred while removing church");
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Search and Add Churches
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                setShowDropdown(true);
                if (searchQuery.trim().length === 0) {
                  performSearch("");
                }
              }}
              placeholder="Search for churches to add..."
              className="pl-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((church) => (
                <button
                  key={church.id}
                  type="button"
                  onClick={() => handleAddChurch(church)}
                  className="w-full text-left px-4 py-2 hover:bg-zinc-50 transition-colors"
                >
                  <span className="text-sm text-zinc-900">{church.name}</span>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchResults.length === 0 && searchQuery.trim().length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg p-4">
              <p className="text-sm text-zinc-500 text-center">No churches found</p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          Supporting Churches
          {!readOnly && (
            <span className="text-zinc-500 text-xs ml-2">
              (Sort Alphabetically)
            </span>
          )}
        </label>

        {affiliatedChurches.length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-lg p-6 text-center">
            <p className="text-sm text-zinc-500">No affiliated churches yet</p>
            {!readOnly && (
              <p className="text-xs text-zinc-400 mt-1">
                Search and add churches using the field above
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {affiliatedChurches
              .sort((a, b) => a.church_name.localeCompare(b.church_name))
              .map((affiliation) => (
                <div
                  key={affiliation.id}
                  className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium"
                >
                  <span>{affiliation.church_name}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChurch(affiliation.id)}
                      className="text-blue-600 hover:text-blue-900 transition-colors hover:bg-blue-200 rounded-full p-0.5"
                      title="Remove church"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

