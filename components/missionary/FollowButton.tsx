"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { followMissionary, unfollowMissionary, cancelFollowRequest } from "@/app/missionaries/follow-actions";
import {
  followMissionaryAsMissionary,
  unfollowMissionaryAsMissionary,
  cancelMissionaryFollowRequest,
} from "@/app/missionaries/missionary-following-actions";
import toast from "react-hot-toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { FollowRequestModal } from "@/components/missionary/FollowRequestModal";
import type { FollowerStatus } from "@/types/follow";

interface FollowButtonProps {
  missionaryId: number;
  missionaryName: string;
  isLoggedIn: boolean;
  initialStatus?: FollowerStatus;
  onAuthRequired?: () => void;
  onStatusChange?: (status: FollowerStatus) => void;
  variant?: "card" | "page";
  className?: string;
  isOwner?: boolean;
  userRole?: number | null;
  disabled?: boolean;
}

export function FollowButton({
  missionaryId,
  missionaryName,
  isLoggedIn,
  initialStatus = "none",
  onAuthRequired,
  onStatusChange,
  variant = "card",
  className = "",
  isOwner = false,
  userRole = null,
  disabled = false,
}: FollowButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<FollowerStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  if (isOwner) {
    return null;
  }

  // Only show Follow button to Supporters (role 4) and Missionaries (role 3), or non-logged-in users
  // Don't show to: Agencies (5), Churches (6), Colleges (7), Admins (1, 2)
  if (isLoggedIn && userRole !== 4 && userRole !== 3) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    if (!isLoggedIn) {
      onAuthRequired?.();
      return;
    }

    if (status === "accepted") {
      setShowUnfollowConfirm(true);
      return;
    }

    if (status === "none" || status === "rejected") {
      setShowFollowModal(true);
      return;
    }

    // status === "pending" → cancel
    setIsLoading(true);
    try {
      const isMissionary = userRole === 3;
      const result = isMissionary
        ? await cancelMissionaryFollowRequest(missionaryId)
        : await cancelFollowRequest(missionaryId);

      if (result.success) {
        setStatus("none");
        onStatusChange?.("none");
        toast.success("Follow request cancelled");
      } else {
        toast.error(result.error || "Failed to cancel request");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowConfirm = async (note: string) => {
    setIsLoading(true);
    try {
      const isMissionary = userRole === 3;
      const result = isMissionary
        ? await followMissionaryAsMissionary(missionaryId, note)
        : await followMissionary(missionaryId, note);

      if (result.success) {
        setStatus("pending");
        onStatusChange?.("pending");
        toast.success(`Follow request sent to ${missionaryName}`);
        setShowFollowModal(false);
      } else {
        toast.error(result.error || "Failed to send follow request");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmUnfollow = async () => {
    const isMissionary = userRole === 3;
    const result = isMissionary
      ? await unfollowMissionaryAsMissionary(missionaryId)
      : await unfollowMissionary(missionaryId);

    if (result.success) {
      setStatus("none");
      onStatusChange?.("none");
      toast.success(`Unfollowed ${missionaryName}`);
      router.refresh();
    } else {
      toast.error(result.error || "Failed to unfollow");
    }
  };

  const getButtonText = () => {
    switch (status) {
      case "pending":
        return "Pending";
      case "accepted":
        return "Following";
      case "rejected":
        return "Follow";
      default:
        return "Follow";
    }
  };

  const getButtonClassName = () => {
    const base = className || "";
    const disabledPageClass = "rounded-full border-2 lg:border border-gray-400 bg-gray-400 text-gray-600 cursor-not-allowed opacity-60 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold shadow-lg lg:shadow-sm transition-all";

    if (variant === "card") {
      const baseCard = "rounded-md px-4 py-1 text-sm font-semibold transition-colors cursor-pointer";
      if (disabled) return `${baseCard} bg-gray-400 text-gray-600 cursor-not-allowed opacity-60 ${base}`;
      if (status === "accepted") return `${baseCard} bg-green-600 text-white hover:bg-green-700 ${base}`;
      if (status === "pending") return `${baseCard} bg-yellow-600 text-white hover:bg-yellow-700 ${base}`;
      return `${baseCard} bg-brand-light-yellow text-black hover:bg-brand-light-yellow/80 ${base}`;
    }

    if (variant === "page") {
      if (disabled) return `${disabledPageClass} ${base}`;
      const basePage = "rounded-full border-2 lg:border px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold shadow-lg lg:shadow-sm transition-all hover:scale-105 lg:hover:scale-100 cursor-pointer";
      if (status === "accepted") return `${basePage} border-green-600 bg-green-600 text-white hover:bg-green-700 ${base}`;
      if (status === "pending") return `${basePage} border-yellow-600 bg-yellow-600 text-white hover:bg-yellow-700 ${base}`;
      return `${basePage} border-[#E1B94D] lg:border-[#E1B94D]/60 bg-[#E1B94D] text-black hover:bg-[#d4a639] ${base}`;
    }

    return base;
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading || disabled}
        className={getButtonClassName()}
        data-cy={`button-follow-${status}`}
      >
        {isLoading ? "..." : getButtonText()}
      </button>

      <FollowRequestModal
        isOpen={showFollowModal}
        onClose={() => setShowFollowModal(false)}
        onConfirm={handleFollowConfirm}
        missionaryName={missionaryName}
        isLoading={isLoading}
      />

      <ConfirmationModal
        isOpen={showUnfollowConfirm}
        onClose={() => setShowUnfollowConfirm(false)}
        onConfirm={handleConfirmUnfollow}
        title={`Unfollow ${missionaryName}?`}
        message="You will stop receiving updates from this missionary."
        confirmText="Unfollow"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
