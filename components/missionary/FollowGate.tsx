"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoginModal } from "@/components/auth/LoginModal";
import { followMissionary } from "@/app/missionaries/follow-actions";
import { FollowRequestModal } from "@/components/missionary/FollowRequestModal";
import toast from "react-hot-toast";
import type { FollowerStatus } from "@/types/follow";

interface FollowGateProps {
  missionaryId: number;
  missionaryName: string;
  isLoggedIn: boolean;
  followerStatus: FollowerStatus;
  contentType: "Photos" | "Videos" | "Prayer Wall" | "Update Letters";
  onFollowSuccess?: () => void;
  isManagedByHarvest21?: boolean;
}

export function FollowGate({
  missionaryId,
  missionaryName,
  isLoggedIn,
  followerStatus,
  contentType,
  onFollowSuccess,
  isManagedByHarvest21 = false,
}: FollowGateProps) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleFollowClick = () => {
    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    setIsFollowModalOpen(true);
  };

  const handleFollowConfirm = async (note: string) => {
    setIsRequesting(true);
    const result = await followMissionary(missionaryId, note);
    setIsRequesting(false);

    if (result.success) {
      toast.success(`Follow request sent to ${missionaryName}`);
      setIsFollowModalOpen(false);
      onFollowSuccess?.();
    } else {
      toast.error(result.error || "Failed to send follow request");
    }
  };

  const getGateMessage = () => {
    if (isManagedByHarvest21) {
      return {
        title: "Managed by Harvest21",
        message: `This ${contentType.toLowerCase()} section is managed by Harvest21. Content will be available once the missionary account is activated.`,
        action: null
      };
    }

    if (!isLoggedIn) {
      return {
        title: "Create an account to access this",
        message: `Followers can view ${contentType.toLowerCase()}. Sign in or create a free account to request to follow.`,
        action: "Sign In or Create Account"
      };
    }

    if (followerStatus === "pending") {
      return {
        title: "Follow request pending",
        message: `Your follow request to ${missionaryName} is awaiting approval. You'll be able to view ${contentType.toLowerCase()} once approved.`,
        action: null
      };
    }

    if (followerStatus === "rejected") {
      return {
        title: "Follow request declined",
        message: `Your previous follow request was declined. You can request again.`,
        action: "Request Again"
      };
    }

    return {
      title: "Followers only",
      message: `${contentType} are available to followers of this missionary. Send a follow request to gain access.`,
      action: "Send Follow Request"
    };
  };

  const gateContent = getGateMessage();

  return (
    <>
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <Lock className="w-8 h-8 text-zinc-500" />
        </div>
        
        <div className="space-y-2 max-w-md">
          <h3 className="text-xl font-semibold text-white">
            {gateContent.title}
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            {gateContent.message}
          </p>
        </div>

        {gateContent.action && (
          <Button
            onClick={handleFollowClick}
            disabled={isRequesting}
            className="bg-[#E1B94D] text-black hover:bg-[#d4a639] font-semibold px-8 py-3 rounded-lg"
          >
            {isRequesting ? "Sending..." : gateContent.action}
          </Button>
        )}
      </div>

      <FollowRequestModal
        isOpen={isFollowModalOpen}
        onClose={() => setIsFollowModalOpen(false)}
        onConfirm={handleFollowConfirm}
        missionaryName={missionaryName}
        isLoading={isRequesting}
      />

      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
