import { useRef, useCallback } from "react";

/**
 * Hook to handle scroll wheel behavior on horizontal scroll containers.
 * Allows vertical scrolling to pass through while enabling horizontal scrolling
 * when appropriate (shift+wheel or horizontal wheel).
 */
export function useHorizontalScroll() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    // Get scroll deltas
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;

    // Check if this is primarily a horizontal scroll (shift+wheel or horizontal wheel)
    const isHorizontalScroll = Math.abs(deltaX) > Math.abs(deltaY) || e.shiftKey;

    if (isHorizontalScroll) {
      // Horizontal scroll: scroll the container
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
  }, []);

  return {
    containerRef,
    handleWheel,
  };
}
