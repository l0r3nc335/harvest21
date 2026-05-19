"use client";
import { HTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
};

export function Avatar({
  className,
  src,
  alt = "Avatar",
  fallback,
  size = "md",
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  } as const;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  } as const;

  const showImage = src && !imageError;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden",
        sizes[size],
        className
      )}
      {...props}
    >
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
          unoptimized={src?.includes("ui-avatars.com")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {fallback ? (
            <span className={cn("font-medium", sizeClasses[size])}>{fallback}</span>
          ) : (
            <svg
              className={cn(size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

