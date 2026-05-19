"use client";

import { useRouter } from "next/navigation";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";

interface ProfileCardProps {
  pageUrl: string;
  profilePhotoUrl: string | null;
  name: string;
  profileType: "church" | "agency";
  layout?: "carousel" | "grid";
}

export function ProfileCard({
  pageUrl,
  profilePhotoUrl,
  name,
  profileType,
  layout = "carousel",
}: ProfileCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (pageUrl) router.push(`/${pageUrl}`);
  };

  const badgeClass =
    profileType === "church"
      ? "bg-blue-500/80 text-white"
      : "bg-green-500/80 text-white";

  const badgeLabel = profileType === "church" ? "Church" : "Agency";

  return (
    <div
      className={`group relative overflow-hidden rounded-lg transition-transform duration-300 ${
        layout === "grid"
          ? "w-full min-w-0 hover:scale-[1.02]"
          : "shrink-0 max-sm:w-[42vw] max-sm:min-w-[128px] max-sm:max-w-[160px] max-sm:snap-center max-sm:active:scale-[1.03] max-sm:touch-pan-x max-sm:touch-pan-y max-sm:shadow-none sm:w-[240px] sm:hover:scale-105 md:w-[280px]"
      }`}
    >
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-gray-900 shadow-none max-sm:shadow-none max-sm:ring-0 sm:rounded-xl sm:border sm:border-gray-800">
        <div
          onClick={handleCardClick}
          className="absolute inset-0 cursor-pointer max-sm:touch-pan-x max-sm:touch-pan-y"
        >
          <MissionaryProfileImage
            src={profilePhotoUrl}
            alt={name}
            fill
            className="object-cover object-top h-full transition-transform duration-300"
            sizes="(max-width: 640px) 160px, 280px"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 from-20% via-black/30 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 flex flex-col p-2 max-sm:px-1.5 max-sm:pb-1.5 max-sm:pt-2 sm:p-4">
            <div className="pointer-events-none">
              <h3 className="mb-0 text-sm font-semibold text-white max-sm:text-xs max-sm:leading-tight max-sm:line-clamp-2 max-sm:drop-shadow-none sm:mb-1 sm:text-lg sm:drop-shadow-sm">
                {name}
              </h3>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
              >
                {badgeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
