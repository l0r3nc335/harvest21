"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { MissionaryCard } from "./MissionaryCard";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { FollowerStatus } from "@/types/follow";
import type { ContentUpdateBadgePayload } from "@/types/missionaryContent";
import { REGION_LABELS } from "@/lib/countries";

interface Missionary {
  id: number;
  first_name: string;
  last_name: string;
  country?: string;
  country_of_residence?: string | null;
  is_managed_by_harvest21?: boolean;
  region?: string;
  page_url: string | null;
  profile_photo_url: string | null;
  page_name?: string | null;
  follower_status?: string;
  is_owner?: boolean;
  is_published?: boolean;
  /** Name of the mission field church associated with this missionary, when available */
  mission_field_church_name?: string | null;
}

interface MissionaryCarouselProps {
  region: string;
  missionaries: Missionary[] | null | undefined;
  userRole?: number | null;
  isLoggedIn?: boolean;
  /** Custom section title (e.g. "Our Missionaries"). When set, used instead of region label and View All link is hidden. */
  title?: string;
  /** Custom empty state message when no missionaries. */
  emptyMessage?: string;
  /** When true, cards with follower_status "accepted" are hidden via CSS. */
  hideFollowed?: boolean;
  contentBadgesByMissionaryId?: Record<number, ContentUpdateBadgePayload>;
}

export function MissionaryCarousel({
  region,
  missionaries,
  userRole = null,
  isLoggedIn = false,
  title,
  emptyMessage,
  hideFollowed = false,
  contentBadgesByMissionaryId = {},
}: MissionaryCarouselProps) {
  const safeMissionaries = Array.isArray(missionaries) ? missionaries : [];
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

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    // Check initial scroll state on mount and when missionaries change
    const checkScrollState = () => {
      if (!scrollContainerRef.current) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    };

    checkScrollState();
    // Also check after a short delay to ensure layout is complete
    const timeoutId = setTimeout(checkScrollState, 100);
    
    // Check on window resize
    window.addEventListener("resize", checkScrollState);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [safeMissionaries]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isScrolling.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = Math.abs(touchX - touchStartX.current);
    const diffY = Math.abs(touchY - touchStartY.current);
    
    // If horizontal movement is greater than vertical, it's a scroll
    if (diffX > diffY && diffX > 10) {
      isScrolling.current = true;
    }
  };

  const handleTouchEnd = () => {
    // Reset after a short delay to allow click events to check isScrolling
    setTimeout(() => {
      isScrolling.current = false;
    }, 100);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Get scroll deltas
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;

    // Check if this is primarily a horizontal scroll (shift+wheel or horizontal wheel)
    const isHorizontalScroll = Math.abs(deltaX) > Math.abs(deltaY) || e.shiftKey;

    if (isHorizontalScroll) {
      // Horizontal scroll: scroll the carousel
      const canScrollLeft = container.scrollLeft > 0;
      const canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth;

      // Only prevent default if we can actually scroll in that direction
      if ((deltaX > 0 && canScrollRight) || (deltaX < 0 && canScrollLeft)) {
        e.preventDefault();
        container.scrollBy({
          left: deltaX,
          behavior: "auto",
        });
      }
    }
    // For vertical scrolls (deltaY), do nothing - let it bubble up to the page
  };

  const formatRegionName = (region: string) => {
    const normalizedRegion = region.toLowerCase().replace(/[-\s]/g, "_");
    return REGION_LABELS[normalizedRegion] || region.split(/[_\s-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  // Format region for URL: convert underscores to hyphens for better URL readability
  const formatRegionForUrl = (region: string) => {
    return region.toLowerCase().replace(/_/g, "-");
  };

  const sectionTitle = title ?? formatRegionName(region);
  const showViewAll = !title;

  return (
    <div className="relative mb-12 pl-4 md:pl-12 max-sm:px-0">
      <div className="mb-6 flex items-center justify-start gap-12 max-sm:px-4 max-sm:gap-4">
        <h2 className="text-2xl font-bold text-white max-sm:text-xl">{sectionTitle}</h2>
        {showViewAll && (
          <Link 
            href={`/missionaries/${formatRegionForUrl(region)}?page=1&limit=20`}
            className="flex items-center gap-2 text-md transition-colors text-brand-light-yellow hover:text-brand-light-yellow/80 cursor-pointer"
          >
            <Search className="h-4 w-4" />
            <span>View All</span>
          </Link>
        )}
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
          className="missionary-carousel-scroll flex gap-4 overflow-x-auto overflow-y-hidden  scrollbar-hide  px-4 md:mx-0 md:px-0"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
            scrollBehavior: "smooth",
          }}
        >
          {safeMissionaries.length > 0 ? (
            safeMissionaries.map((missionary) => (
              <div
                key={missionary.id}
                className={hideFollowed && missionary.follower_status === "accepted" ? "hidden" : ""}
              >
                <MissionaryCard
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
                  churchName={missionary.mission_field_church_name ?? null}
                  contentUpdateBadge={
                    missionary.follower_status === "accepted"
                      ? contentBadgesByMissionaryId[missionary.id] ?? null
                      : null
                  }
                />
              </div>
            ))
          ) : (
            <div className="text-white/60 text-center py-8 w-full">
              {emptyMessage ?? "No missionaries found in this region."}
            </div>
          )}
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

