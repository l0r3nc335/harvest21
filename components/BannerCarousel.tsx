"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HomepageBanner, HomepageSettings } from "@/types/homepage";

type BannerCarouselProps = {
  banners: HomepageBanner[];
  settings?: HomepageSettings | null;
};

export function BannerCarousel({ banners, settings }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeBanners = banners.filter((b) => b.is_active);
  const scrollTiming = settings?.scroll_timing || 5000;
  const showArrows = settings?.show_navigation_arrows ?? true;
  const showDots = settings?.show_pagination_dots ?? true;

  // Auto-advance with timer that resets whenever the slide changes
  // or settings change. This ensures that clicking "Next" gives the
  // new banner a full visible duration before it auto-fades.
  useEffect(() => {
    if (!settings?.auto_scroll || activeBanners.length === 0) return;

    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, scrollTiming);

    // Cleanup ensures the timer is reset on:
    // - manual navigation (currentIndex changes)
    // - settings changes (auto_scroll / scroll_timing)
    // - banner list changes
    return () => clearTimeout(timeout);
  }, [settings?.auto_scroll, activeBanners.length, scrollTiming, currentIndex]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + activeBanners.length) % activeBanners.length
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  };

  if (activeBanners.length === 0) {
    return (
      <div className="relative w-full h-[600px] bg-zinc-900 flex items-center justify-center">
        <p className="text-white text-xl">No active banners</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] overflow-hidden">
      {activeBanners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${index === currentIndex ? "opacity-100" : "opacity-0"
            }`}
        >
          <Image
            src={banner.image_url}
            alt={banner.location}
            fill
            className="object-cover"
            priority={index === 0}
          />
        </div>
      ))}

      <div
        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_top,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.5)_25%,rgba(0,0,0,0.2)_50%,transparent_70%)]"
      />

      {showArrows && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-2xs transition-all hover:bg-white/30"
            aria-label="Previous slide"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-2xs transition-all hover:bg-white/30"
            aria-label="Next slide"
          >
            <ArrowRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      <div className="absolute inset-x-0 bottom-24 md:bottom-16 left-4 md:left-8 z-10 min-h-[140px] pt-6 pb-20 sm:min-h-[160px] sm:pt-8 sm:pb-24 md:min-h-[180px] md:pt-10 md:pb-28 lg:min-h-[200px] lg:pt-12 lg:pb-32">
        {activeBanners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 flex flex-col justify-start transition-opacity duration-1000 ${index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
          >
            <div className="w-full max-w-7xl pl-0 pr-4 sm:pr-6 md:pr-8 lg:pr-12">
              <h2 className="mb-1 text-2xl font-bold leading-tight text-white drop-shadow-sm sm:mb-2 sm:text-3xl md:mb-3 md:text-4xl lg:mb-4 lg:text-5xl xl:text-6xl xl:mb-5">
                {banner.location}
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-white/95 drop-shadow-sm sm:text-base md:text-lg lg:text-xl">
                {banner.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showDots && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-0.5">
          {activeBanners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all ${index === currentIndex
                ? "w-8 h-1 bg-white"
                : "w-8 h-0.5 bg-white/50 hover:bg-white/75"
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

