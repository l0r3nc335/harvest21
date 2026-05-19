"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MissionaryCard } from "@/components/MissionaryCard";
import { ProfileCard } from "@/components/ProfileCard";
import type { FeaturedProfileCard } from "@/types/homepage";
import type { FollowerStatus } from "@/types/follow";
import type { ContentUpdateBadgePayload } from "@/types/missionaryContent";

interface FeaturedSectionCarouselProps {
  title: string;
  profiles: FeaturedProfileCard[];
  userRole?: number | null;
  isLoggedIn?: boolean;
  contentBadgesByMissionaryId?: Record<number, ContentUpdateBadgePayload>;
}

export function FeaturedSectionCarousel({
  title,
  profiles,
  userRole = null,
  isLoggedIn = false,
  contentBadgesByMissionaryId = {},
}: FeaturedSectionCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = scrollContainerRef.current.clientWidth;
    const newScrollLeft =
      direction === "left"
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;
    scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const checkScrollState = () => {
      if (!scrollContainerRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    };

    checkScrollState();
    const timeoutId = setTimeout(checkScrollState, 100);
    window.addEventListener("resize", checkScrollState);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [profiles]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isScrolling.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current) return;
    const diffX = Math.abs(e.touches[0].clientX - touchStartX.current);
    const diffY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (diffX > diffY && diffX > 10) isScrolling.current = true;
  };

  const handleTouchEnd = () => {
    setTimeout(() => { isScrolling.current = false; }, 100);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    if (isHorizontalScroll) {
      const canScrollLeft = container.scrollLeft > 0;
      const canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth;
      if ((e.deltaX > 0 && canScrollRight) || (e.deltaX < 0 && canScrollLeft)) {
        e.preventDefault();
        container.scrollBy({ left: e.deltaX, behavior: "auto" });
      }
    }
  };

  if (profiles.length === 0) return null;

  return (
    <div className="relative mb-12 pl-4 md:pl-12 max-sm:px-0">
      <div className="mb-6 flex items-center justify-start gap-12 max-sm:px-4 max-sm:gap-4">
        <h2 className="text-2xl font-bold text-white max-sm:text-xl">{title}</h2>
        <div className="flex-1 h-0.5 bg-white/20" />
      </div>

      <div className="group relative max-sm:overflow-visible">
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/90 text-white shadow-lg transition-opacity hover:bg-black md:left-0 md:h-12 md:w-12 max-sm:hidden"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="missionary-carousel-scroll flex gap-4 overflow-x-auto overflow-y-hidden scrollbar-hide px-4 md:mx-0 md:px-0"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
            scrollBehavior: "smooth",
          }}
        >
          {profiles.map((profile) => {
            if (profile.profile_type === "missionary") {
              const nameParts = (profile.name ?? "").split(" ");
              const firstName = nameParts[0] ?? "";
              const lastName = nameParts.slice(1).join(" ");
              return (
                <MissionaryCard
                  key={profile.section_profile_id}
                  id={profile.missionary_id ?? profile.profile_id}
                  firstName={firstName}
                  lastName={lastName}
                  country={profile.country ?? ""}
                  pageUrl={profile.page_url}
                  profilePhotoUrl={profile.profile_photo_url}
                  pageName={profile.name}
                  userRole={userRole}
                  isLoggedIn={isLoggedIn}
                  followerStatus={(profile.follower_status ?? "none") as FollowerStatus}
                  isOwner={false}
                  isPublished={true}
                  churchName={profile.church_name ?? null}
                  isManagedByHarvest21={profile.is_managed_by_harvest21 ?? false}
                  contentUpdateBadge={
                    profile.follower_status === "accepted" && profile.missionary_id != null
                      ? contentBadgesByMissionaryId[profile.missionary_id] ?? null
                      : null
                  }
                />
              );
            }

            return (
              <ProfileCard
                key={profile.section_profile_id}
                pageUrl={profile.page_url}
                profilePhotoUrl={profile.profile_photo_url}
                name={profile.name}
                profileType={profile.profile_type as "church" | "agency"}
              />
            );
          })}
        </div>

        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/90 text-white shadow-lg transition-opacity hover:bg-black md:right-0 md:h-12 md:w-12 max-sm:hidden"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </button>
        )}
      </div>
    </div>
  );
}
