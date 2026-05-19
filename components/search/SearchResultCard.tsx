"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import type {
  MissionarySearchResult,
  ChurchSearchResult,
  AgencySearchResult,
} from "@/types/search";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function MissionaryResultCard({
  missionary,
  showAgency = true,
  onClose,
}: {
  missionary: MissionarySearchResult;
  showAgency?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  
  const handleClick = () => {
    console.log("Missionary clicked, page_url:", missionary.page_url);
    console.log("Full missionary data:", missionary);
    const url = `/${missionary.page_url}`;
    console.log("Navigating to:", url);
    if (onClose) onClose();
    router.push(url);
  };
  
  return (
    <div
      data-search-result
      onClick={(e) => {
        e.stopPropagation();
        console.log("DIV CLICKED!");
        handleClick();
      }}
      className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-zinc-800/50 cursor-pointer"
    >
      <MissionaryProfileImage
        src={missionary.profile_photo_url}
        alt={missionary.name}
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover"
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{missionary.name}</div>
        <div className="text-xs text-zinc-400 truncate">
          {missionary.country_of_residence || missionary.destination_country}
          {showAgency && missionary.agency_name && (
            <span className="ml-1">• {missionary.agency_name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChurchResultCard({ 
  church,
  onClose,
}: { 
  church: ChurchSearchResult;
  onClose?: () => void;
}) {
  const router = useRouter();
  const displayLocation = [church.city, church.country].filter(Boolean).join(", ");

  const handleClick = () => {
    console.log("Church clicked, page_url:", church.page_url);
    console.log("Full church data:", church);
    const url = `/${church.page_url}`;
    console.log("Navigating to:", url);
    if (onClose) onClose();
    router.push(url);
  };

  const hasPhoto = church.profile_photo_url && church.profile_photo_url.trim() !== "";

  return (
    <div
      data-search-result
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-zinc-800/50 cursor-pointer"
    >
      {hasPhoto ? (
        <MissionaryProfileImage
          src={church.profile_photo_url}
          alt={church.name}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
          {getInitials(church.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">{church.name}</span>
          <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
            Church
          </span>
        </div>
        {displayLocation && (
          <div className="text-sm text-zinc-300 truncate">{displayLocation}</div>
        )}
      </div>
    </div>
  );
}

export function AgencyResultCard({ 
  agency,
  onClose,
}: { 
  agency: AgencySearchResult;
  onClose?: () => void;
}) {
  const router = useRouter();
  const displayLocation = [agency.city, agency.country].filter(Boolean).join(", ");

  const handleClick = () => {
    console.log("Agency clicked, page_url:", agency.page_url);
    console.log("Full agency data:", agency);
    const url = `/${agency.page_url}`;
    console.log("Navigating to:", url);
    if (onClose) onClose();
    router.push(url);
  };

  const hasPhoto = agency.profile_photo_url && agency.profile_photo_url.trim() !== "";

  return (
    <div
      data-search-result
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-zinc-800/50 cursor-pointer"
    >
      {hasPhoto ? (
        <MissionaryProfileImage
          src={agency.profile_photo_url}
          alt={agency.name}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-700 text-sm font-bold text-white">
          {getInitials(agency.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">{agency.name}</span>
          <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
            Mission Agency
          </span>
        </div>
        {displayLocation && (
          <div className="text-sm text-zinc-400 truncate">{displayLocation}</div>
        )}
      </div>
    </div>
  );
}

