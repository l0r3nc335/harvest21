"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { DEFAULT_MISSIONARY_PROFILE_IMAGE } from "@/lib/imageConstants";

interface MissionaryProfileImageProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * MissionaryProfileImage component that automatically falls back to a gray placeholder
 * (like Facebook's blank profile) if the provided image fails to load or is invalid.
 * Handles errors like "url parameter is valid but upstream response is invalid"
 * 
 * This component wraps Next.js Image and provides error handling that catches
 * both browser-level errors and Next.js image optimization errors.
 */
export function MissionaryProfileImage({
  src,
  alt,
  fill = false,
  width,
  height,
  className,
  sizes,
  priority = false,
}: MissionaryProfileImageProps) {
  // Normalize empty string, null, or undefined to use default placeholder
  const normalizedSrc = src && src.trim() !== "" ? src : null;
  
  const [imageSrc, setImageSrc] = useState<string | null>(
    normalizedSrc || null
  );
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Update image source when src prop changes (reset error state if src changes)
  useEffect(() => {
    if (normalizedSrc && normalizedSrc !== imageSrc && !hasError) {
      setImageSrc(normalizedSrc);
      setHasError(false);
      setRetryCount(0);
    } else if (!normalizedSrc && imageSrc !== null) {
      setImageSrc(null);
      setHasError(false);
      setRetryCount(0);
    }
  }, [normalizedSrc, imageSrc, hasError]);

  // Handle image loading errors
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Prevent infinite loops - if we're already showing placeholder or already had an error, stop
    if (hasError || imageSrc === null) {
      return;
    }

    // If we haven't retried yet and the error is from the original src, show placeholder
    if (retryCount === 0 && normalizedSrc && normalizedSrc !== null) {
      console.warn("Missionary profile image failed to load, using placeholder:", {
        originalSrc: normalizedSrc,
        currentSrc: imageSrc,
        error: e
      });
      setHasError(true);
      setImageSrc(null);
      setRetryCount(1);
    }
  };

  // Render gray placeholder (like Facebook's blank profile) when no image
  const renderPlaceholder = () => {
    const baseClasses = fill 
      ? `absolute inset-0 bg-gray-300 flex items-center justify-center ${className || ''}`
      : `bg-gray-300 flex items-center justify-center ${className || ''}`;
    
    return (
      <div 
        className={baseClasses}
        style={fill ? undefined : { width, height }}
        aria-label={alt}
      >
        <svg
          className="w-1/2 h-1/2 text-gray-500"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </div>
    );
  };

  // If no image source or error occurred, render placeholder
  if (!imageSrc || hasError) {
    return renderPlaceholder();
  }

  // Render with fill or explicit dimensions
  if (fill) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onError={handleError}
        className={className}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
      onError={handleError}
    />
  );
}
