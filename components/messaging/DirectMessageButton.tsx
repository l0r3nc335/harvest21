"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { FollowerStatus } from "@/types/follow";

interface DirectMessageButtonProps {
  missionaryId: number;
  missionaryName: string;
  isLoggedIn: boolean;
  followerStatus?: FollowerStatus;
  allowDirectMessages?: boolean;
  onAuthRequired?: () => void;
  variant?: "card" | "page";
  className?: string;
  disabled?: boolean;
}

export function DirectMessageButton({
  missionaryId,
  missionaryName,
  isLoggedIn,
  followerStatus = "none",
  allowDirectMessages = true,
  onAuthRequired,
  variant = "page",
  className = "",
  disabled = false,
}: DirectMessageButtonProps) {
  const router = useRouter();
  const isAcceptedFollower = followerStatus === "accepted";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!isLoggedIn) {
      onAuthRequired?.();
      return;
    }
    if (!isAcceptedFollower) {
      toast.error("You must be an accepted follower to send messages");
      return;
    }
    if (!allowDirectMessages) {
      toast.error(`${missionaryName} has disabled direct messages`);
      return;
    }
    router.push(`/messages?open=${missionaryId}`);
  };

  const getButtonText = () => "Direct Message";

  const getButtonClassName = () => {
    const base = className || "";
    const isDisabled = disabled || !isLoggedIn || !isAcceptedFollower || !allowDirectMessages;

    if (variant === "card") {
      if (isDisabled) {
        return `rounded-md px-4 py-1 text-sm font-semibold transition-colors bg-gray-400 text-gray-600 cursor-not-allowed opacity-60 ${base}`;
      }
      const baseCard = "rounded-md px-4 py-1 text-sm font-semibold transition-colors cursor-pointer";
      return `${baseCard} bg-black border border-white/20 text-white hover:border-[#E1B94D]/50 hover:text-[#E1B94D] ${base}`;
    }
    
    if (variant === "page") {
      if (isDisabled) {
        return `w-full lg:w-auto rounded-full border-2 lg:border border-gray-400 bg-gray-400 text-gray-600 cursor-not-allowed opacity-60 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold shadow-lg lg:shadow-sm transition-all ${base}`;
      }
      const basePage = "rounded-full border-2 lg:border px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold shadow-lg lg:shadow-sm transition-all hover:scale-105 lg:hover:scale-100 cursor-pointer";
      return `${basePage} border-white/20 bg-black text-[#f5f5f5] hover:border-[#E1B94D]/50 hover:text-[#E1B94D] ${base}`;
    }
    
    return base;
  };

  const getTooltip = () => {
    if (!isLoggedIn) return "Please log in to send messages";
    if (!isAcceptedFollower) return "You must be an accepted follower to send messages";
    if (!allowDirectMessages) return "This missionary has disabled direct messages";
    return "";
  };

  const tooltip = getTooltip();
  const isDisabled = disabled || !isLoggedIn || !isAcceptedFollower || !allowDirectMessages;

  const button = (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={getButtonClassName()}
      title={tooltip}
      aria-label={tooltip || "Send direct message"}
    >
      {getButtonText()}
    </button>
  );

  if (isDisabled && variant === "page") {
    return (
      <span className="block w-full cursor-not-allowed lg:inline-block lg:w-auto [&_button]:pointer-events-none">
        {button}
      </span>
    );
  }
  if (isDisabled) {
    return <span className="inline-block cursor-not-allowed [&_button]:pointer-events-none">{button}</span>;
  }
  return button;
}

