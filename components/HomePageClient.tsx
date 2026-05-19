"use client";

import { useState, useMemo } from "react";
import { FilterBar } from "@/components/FilterBar";
import { MissionaryCarousel } from "@/components/MissionaryCarousel";
import { FeaturedSectionCarousel } from "@/components/FeaturedSectionCarousel";
import { COUNTRIES_BY_REGION, REGION_LABELS } from "@/lib/countries";
import type { FeaturedSectionWithProfiles } from "@/types/homepage";
import type { ContentUpdateBadgePayload } from "@/types/missionaryContent";

interface Missionary {
  id: number;
  first_name: string;
  last_name: string;
  country: string; // This is now the destination country for display
  region: string;
  destination_country?: string | null; // Raw destination_country field
  country_of_residence?: string | null; // Kept for backward compatibility
  page_url: string;
  page_name?: string | null;
  profile_photo_url: string | null;
  mission_status?: string | null;
  donation_percentage?: number | null;
  open_to_visits?: boolean;
  visits_start_date?: string | null;
  visits_end_date?: string | null;
  follower_status?: string;
  is_owner?: boolean;
  is_managed_by_harvest21?: boolean;
  /** Name of the mission field church associated with this missionary, when available */
  mission_field_church_name?: string | null;
}

type MissionariesByRegion = Record<string, Missionary[]>;

interface HomePageClientProps {
  missionariesByRegion: MissionariesByRegion;
  userRole?: number | null;
  isLoggedIn?: boolean;
  featuredSections?: FeaturedSectionWithProfiles[];
  contentBadgesByMissionaryId?: Record<number, ContentUpdateBadgePayload>;
}

export function HomePageClient({
  missionariesByRegion,
  userRole = null,
  isLoggedIn = false,
  featuredSections = [],
  contentBadgesByMissionaryId = {},
}: HomePageClientProps) {
  const [selectedContinent, setSelectedContinent] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSupportLevel, setSelectedSupportLevel] = useState<string>("all");
  const [selectedOpenToVisits, setSelectedOpenToVisits] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");

  const allMissionaries = useMemo(() => {
    return Object.values(missionariesByRegion).flat();
  }, [missionariesByRegion]);

  const canFollow = isLoggedIn && (userRole === 3 || userRole === 4);

  const followingMissionaries = useMemo(() => {
    if (!canFollow) return [];
    return allMissionaries.filter(
      (m) => m.follower_status === "accepted"
    );
  }, [allMissionaries, canFollow]);

  const availableCountries = useMemo(() => {
    if (selectedContinent === "all") {
      const allCountries = new Set(allMissionaries.map(m => m.country));
      return Array.from(allCountries).sort();
    }
    return COUNTRIES_BY_REGION[selectedContinent] || [];
  }, [selectedContinent, allMissionaries]);

  const filteredMissionaries = useMemo(() => {
    let filtered = [...allMissionaries];

    if (selectedContinent !== "all") {
      filtered = filtered.filter(m => m.region === selectedContinent);
    }

    if (selectedCountry !== "all") {
      filtered = filtered.filter(m => m.country === selectedCountry);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter(m => m.mission_status === selectedStatus);
    }

    if (selectedSupportLevel !== "all") {
      const level = parseInt(selectedSupportLevel);
      filtered = filtered.filter(m => {
        const percentage = m.donation_percentage || 0;
        if (level === 25) return percentage < 25;
        if (level === 50) return percentage >= 25 && percentage < 50;
        if (level === 75) return percentage >= 50 && percentage < 75;
        if (level === 100) return percentage >= 75;
        return true;
      });
    }

    if (selectedOpenToVisits !== "all") {
      filtered = filtered.filter(m => {
        if (selectedOpenToVisits === "yes") {
          return m.open_to_visits === true;
        } else if (selectedOpenToVisits === "no") {
          return m.open_to_visits === false || m.open_to_visits == null;
        }
        return true;
      });
    }

    if (sortBy === "name-asc") {
      filtered.sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
    } else if (sortBy === "name-desc") {
      filtered.sort((a, b) => (b.last_name || "").localeCompare(a.last_name || ""));
    }

    return filtered;
  }, [allMissionaries, selectedContinent, selectedCountry, selectedStatus, selectedSupportLevel, selectedOpenToVisits, sortBy]);

  const groupedMissionaries = useMemo(() => {
    const grouped: MissionariesByRegion = {};
    filteredMissionaries.forEach(missionary => {
      if (!grouped[missionary.region]) {
        grouped[missionary.region] = [];
      }
      grouped[missionary.region].push(missionary);
    });
    return grouped;
  }, [filteredMissionaries]);

  const filters = useMemo(() => [
    {
      id: "sortBy",
      label: "Sort By",
      options: [
        { value: "default", label: "Default" },
        { value: "name-asc", label: "Name (A-Z)" },
        { value: "name-desc", label: "Name (Z-A)" },
      ],
      defaultValue: sortBy,
    },
    {
      id: "continents",
      label: "Continents",
      options: [
        { value: "all", label: "All Continents" },
        ...Object.keys(REGION_LABELS).map(key => ({
          value: key,
          label: REGION_LABELS[key],
        })),
      ],
      defaultValue: selectedContinent,
    },
    {
      id: "country",
      label: "Country",
      options: [
        { value: "all", label: "All Countries" },
        ...availableCountries.map(country => ({
          value: country,
          label: country,
        })),
      ],
      defaultValue: selectedCountry,
    },
    {
      id: "status",
      label: "Status",
      options: [
        { value: "all", label: "All" },
        { value: "On-Field", label: "On-Field" },
        { value: "Furlough", label: "Furlough" },
        { value: "Deputation", label: "Deputation" },
      ],
      defaultValue: selectedStatus,
    },
    {
      id: "supportLevel",
      label: "Support Level",
      options: [
        { value: "all", label: "All" },
        { value: "25", label: "0-25%" },
        { value: "50", label: "25-50%" },
        { value: "75", label: "50-75%" },
        { value: "100", label: "75-100%" },
      ],
      defaultValue: selectedSupportLevel,
    },
    {
      id: "openToVisits",
      label: "Open to Visits",
      options: [
        { value: "all", label: "All" },
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      defaultValue: selectedOpenToVisits,
    },
  ], [sortBy, selectedContinent, selectedCountry, selectedStatus, selectedSupportLevel, selectedOpenToVisits, availableCountries]);

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === "sortBy") {
      setSortBy(value);
    } else if (filterId === "continents") {
      setSelectedContinent(value);
      setSelectedCountry("all");
    } else if (filterId === "country") {
      setSelectedCountry(value);
    } else if (filterId === "status") {
      setSelectedStatus(value);
    } else if (filterId === "supportLevel") {
      setSelectedSupportLevel(value);
    } else if (filterId === "openToVisits") {
      setSelectedOpenToVisits(value);
    }
  };

  const KNOWN_REGIONS = new Set(
    Object.keys(REGION_LABELS).map((r) => r.toLowerCase())
  );
  const regions = Object.keys(groupedMissionaries).filter((region) => {
    if (groupedMissionaries[region].length === 0) return false;
    const normalized = region.toLowerCase().replace(/[-\s]/g, "_");
    if (normalized === "other") return false;
    return KNOWN_REGIONS.has(normalized) || KNOWN_REGIONS.has(region.toLowerCase());
  });
  const regionsOrder = [
    "north_america",
    "south_america",
    "europe",
    "africa",
    "asia",
    "australia",
  ];
  const sortedRegions = [...regions].sort((a, b) => {
    const na = a.toLowerCase().replace(/[-\s]/g, "_");
    const nb = b.toLowerCase().replace(/[-\s]/g, "_");
    const ia = regionsOrder.indexOf(na);
    const ib = regionsOrder.indexOf(nb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <>
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      <main className="w-full pb-12 pt-8">
        {followingMissionaries.length > 0 && (
          <MissionaryCarousel
            region="following"
            missionaries={followingMissionaries}
            userRole={userRole}
            isLoggedIn={isLoggedIn}
            title="Following"
            emptyMessage=""
            contentBadgesByMissionaryId={contentBadgesByMissionaryId}
          />
        )}

        {featuredSections
          .filter((fs) => fs.profiles.length > 0)
          .map((fs) => (
            <FeaturedSectionCarousel
              key={fs.section.id}
              title={fs.section.title}
              profiles={fs.profiles}
              userRole={userRole}
              isLoggedIn={isLoggedIn}
              contentBadgesByMissionaryId={contentBadgesByMissionaryId}
            />
          ))}

        {sortedRegions.length > 0 ? (
          sortedRegions.map((region) => (
            <MissionaryCarousel
              key={region}
              region={region}
              missionaries={groupedMissionaries[region]}
              userRole={userRole}
              isLoggedIn={isLoggedIn}
              hideFollowed={followingMissionaries.length > 0}
              contentBadgesByMissionaryId={contentBadgesByMissionaryId}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg text-zinc-400">
              No missionaries found matching your filters.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

