"use client";

import { useState } from "react";
import Image from "next/image";
import { FileText, Heart, ImageIcon, Play } from "lucide-react";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { useRouter } from "next/navigation";
import { getCountryByName, getCountryByCode, getCountryFlag } from "@/lib/countries";
import { FollowButton } from "@/components/missionary/FollowButton";
import { LoginModal } from "@/components/auth/LoginModal";
import type { FollowerStatus } from "@/types/follow";
import type { ContentUpdateBadgePayload } from "@/types/missionaryContent";

interface MissionaryCardProps {
  id: number;
  firstName: string;
  lastName: string;
  country: string;
  pageUrl?: string | null;
  profilePhotoUrl: string | null;
  pageName?: string | null;
  isLoggedIn?: boolean;
  followerStatus?: FollowerStatus;
  isOwner?: boolean;
  userRole?: number | null;
  /** When false, card is not clickable, follow button is disabled, and "Unpublished" badge is shown */
  isPublished?: boolean;
  /** When "grid", card fills its grid cell for stacking/row layouts instead of fixed carousel width */
  layout?: "carousel" | "grid";
  /** Optional church name to display under the missionary name (e.g. mission field church) */
  churchName?: string | null;
  isManagedByHarvest21?: boolean;
  contentUpdateBadge?: ContentUpdateBadgePayload | null;
}

export function MissionaryCard({
  id,
  firstName,
  lastName,
  country,
  pageUrl,
  profilePhotoUrl,
  pageName,
  isLoggedIn = false,
  followerStatus = "none",
  isOwner = false,
  userRole = null,
  isPublished = true,
  layout = "carousel",
  churchName = null,
  isManagedByHarvest21 = false,
  contentUpdateBadge = null,
}: MissionaryCardProps) {
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const displayName = pageName  || `${firstName} ${lastName}`;
  const isClickable = Boolean(pageUrl?.trim()) && isPublished;
  const showNewContent =
    followerStatus === "accepted" && contentUpdateBadge != null;

  const handleCardClick = () => {
    if (isClickable) router.push(`/${pageUrl}`);
  };

  const BadgeIcon =
    contentUpdateBadge?.contentType === "update_letter"
      ? FileText
      : contentUpdateBadge?.contentType === "prayer"
        ? Heart
        : contentUpdateBadge?.contentType === "video"
          ? Play
          : ImageIcon;

  return (
    <>
      <div
        className={`group relative overflow-hidden rounded-lg transition-transform duration-300 ${
          layout === "grid"
            ? "w-full min-w-0 hover:scale-[1.02]"
            : "shrink-0 max-sm:w-[42vw] max-sm:min-w-[128px] max-sm:max-w-[160px] max-sm:snap-center max-sm:active:scale-[1.03] max-sm:touch-pan-x max-sm:touch-pan-y max-sm:shadow-none sm:w-[240px] sm:hover:scale-105 md:w-[280px]"
        }`}
      >
        <div
          className={`relative aspect-2/3 w-full overflow-hidden rounded-lg bg-gray-900 shadow-none max-sm:shadow-none max-sm:ring-0 sm:rounded-xl sm:border sm:border-gray-800 ${
            showNewContent ? "ring-2 ring-green-500 ring-offset-2 ring-offset-black sm:ring-offset-[#0a0a0a]" : ""
          }`}
        >
          {showNewContent && contentUpdateBadge && (
            <div className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded border border-sky-400/80 bg-sky-950/95 px-2 py-1 shadow-md max-sm:left-1 max-sm:top-1 max-sm:px-1.5 max-sm:py-0.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600/90 text-white max-sm:h-6 max-sm:w-6">
                <BadgeIcon className="h-3.5 w-3.5 max-sm:h-3 max-sm:w-3" aria-hidden />
              </span>
              <span className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-sky-100 max-sm:text-[8px] sm:text-[10px]">
                {contentUpdateBadge.label}
              </span>
            </div>
          )}
          {!isPublished && (
            <span className="absolute top-2 right-2 z-10 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-md">
              Unpublished
            </span>
          )}
          <div onClick={handleCardClick} className={`absolute inset-0 max-sm:touch-pan-x max-sm:touch-pan-y ${isClickable ? "cursor-pointer" : "cursor-default"}`}>
            <MissionaryProfileImage
              src={profilePhotoUrl}
              alt={displayName}
              fill
              className="object-cover object-top h-full transition-transform duration-300"
              sizes="(max-width: 640px) 160px, 280px"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 from-20% via-black/30 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 flex flex-col p-2  max-sm:px-1.5 max-sm:pb-1.5 max-sm:pt-2 sm:p-4">
              <div className="pointer-events-none">
                <h3 className="mb-0 text-sm font-semibold text-white max-sm:text-xs max-sm:leading-tight max-sm:line-clamp-2 max-sm:drop-shadow-none sm:mb-1 sm:text-lg sm:drop-shadow-sm">
                  {displayName}
                </h3>
                {churchName && (
                  <p className="mb-0 mt-0.5 line-clamp-2 text-xs text-gray-300 max-sm:leading-snug sm:mb-3 sm:mt-0 sm:block sm:text-sm sm:line-clamp-none">
                    {churchName}
                  </p>
                )}
                <div className="flex items-center gap-1 max-sm:mt-0.5 sm:gap-2 sm:mt-0">
                  {(() => {
                    const countryData = getCountryByCode(country) || getCountryByName(country);
                    const countryCode = countryData?.code?.toLowerCase();
                    return countryCode && countryData ? (
                      <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/20 max-sm:h-4 max-sm:w-4">
                        <Image
                          src={`https://flagcdn.com/w80/${countryCode}.png`}
                          alt={countryData.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <span className="text-base max-sm:text-sm">{getCountryFlag(country)}</span>
                    );
                  })()}
                  <span className="text-xs font-medium text-white truncate md:max-w-40 sm:max-w-none sm:text-sm">{country}</span>
                </div>
              </div>
              {!isManagedByHarvest21 && (
                <div className="pointer-events-auto max-sm:mt-2 max-sm:w-full sm:absolute sm:bottom-3 sm:right-3 sm:left-auto sm:mt-0 sm:w-auto">
                  <FollowButton
                    missionaryId={id}
                    missionaryName={displayName}
                    isLoggedIn={isLoggedIn}
                    initialStatus={followerStatus}
                    onAuthRequired={() => setIsLoginModalOpen(true)}
                    variant="card"
                    isOwner={isOwner}
                    userRole={userRole}
                    disabled={!isPublished}
                    className="max-sm:w-full! max-sm:min-h-[28px]! max-sm:px-3! max-sm:py-2! max-sm:text-xs!"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}

