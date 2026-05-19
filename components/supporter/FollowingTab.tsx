"use client";

import { useState, useEffect } from "react";
import { Users, UserCheck, Clock, UserX } from "lucide-react";
import toast from "react-hot-toast";
import { getSupporterFollows, unfollowEntity, cancelFollowRequest } from "@/app/settings/following-actions";
import { FollowItem } from "./FollowItem";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import type { SupporterFollows, FollowItem as FollowItemType } from "@/types/supporter";

type FollowingTabProps = {
  variant?: "dark" | "light";
};

export function FollowingTab({ variant = "dark" }: FollowingTabProps) {
  const isLight = variant === "light";
  const [follows, setFollows] = useState<SupporterFollows>({
    following: [],
    pending: [],
    rejected: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'following' | 'pending' | 'rejected'>('following');
  const [pendingUnfollow, setPendingUnfollow] = useState<FollowItemType | null>(null);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);

  useEffect(() => {
    loadFollows();
  }, []);

  const loadFollows = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const result = await getSupporterFollows();
      if (result.success && result.data) {
        setFollows(result.data);
      } else {
        toast.error(result.error || "Failed to load follows");
      }
    } catch (error) {
      console.error("Error loading follows:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRequestUnfollow = (item: FollowItemType) => {
    setPendingUnfollow(item);
    setShowUnfollowModal(true);
  };

  const handleConfirmUnfollow = async () => {
    if (!pendingUnfollow) return;
    try {
      const result = await unfollowEntity(pendingUnfollow.entity_type, pendingUnfollow.entity_id);
      if (result.success) {
        toast.success(result.message || "Unfollowed successfully");
        await loadFollows(true);
      } else {
        toast.error(result.error || "Failed to unfollow");
      }
    } catch (error) {
      console.error("Error unfollowing:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setPendingUnfollow(null);
      setShowUnfollowModal(false);
    }
  };

  const handleCancelRequest = async (entityType: 'missionary' | 'church', entityId: number) => {
    try {
      const result = await cancelFollowRequest(entityType, entityId);
      if (result.success) {
        toast.success(result.message || "Request cancelled");
        await loadFollows(true);
      } else {
        toast.error(result.error || "Failed to cancel request");
      }
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const LoadingItems = () => (
    <div className="space-y-2 sm:space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-zinc-200 animate-pulse">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-200"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 rounded w-1/3"></div>
            <div className="h-3 bg-zinc-200 rounded w-1/2"></div>
          </div>
          <div className="w-20 h-8 bg-zinc-200 rounded"></div>
        </div>
      ))}
    </div>
  );

  const headerClass = isLight ? "text-zinc-900" : "text-white";
  const iconClass = isLight ? "text-[#D3AF37]" : "text-yellow-500";
  const tabBorderClass = isLight ? "border-zinc-200" : "border-zinc-800";
  const activeTabClass = isLight ? "border-[#D3AF37] text-[#D3AF37]" : "border-yellow-500 text-yellow-500";
  const inactiveTabClass = isLight ? "border-transparent text-zinc-600 hover:text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-200";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Users className={`w-6 h-6 sm:w-8 sm:h-8 ${iconClass}`} />
        <h2 className={`text-xl sm:text-2xl font-bold ${headerClass}`}>Following</h2>
      </div>

      <div 
        className={`flex gap-1 sm:gap-2 border-b ${tabBorderClass} overflow-x-auto`}
        onWheel={(e) => {
          if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            return;
          }
        }}
      >
        <button
          onClick={() => setActiveSection('following')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'following' ? activeTabClass : inactiveTabClass
          }`}
        >
          Following ({follows.following.length})
        </button>
        <button
          onClick={() => setActiveSection('pending')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'pending' ? activeTabClass : inactiveTabClass
          }`}
        >
          Pending ({follows.pending.length})
        </button>
        <button
          onClick={() => setActiveSection('rejected')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeSection === 'rejected' ? activeTabClass : inactiveTabClass
          }`}
        >
          Rejected ({follows.rejected.length})
        </button>
      </div>

      {activeSection === 'following' && (
        <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900">
              Following
            </h3>
          </div>
          {isLoading ? (
            <LoadingItems />
          ) : follows.following.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm sm:text-base text-zinc-600">
                You're not following anyone yet
              </p>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Start following missionaries and churches to see their updates
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {follows.following.map((item) => (
                <FollowItem
                  key={`${item.entity_type}-${item.entity_id}`}
                  item={item}
                  onAction={() => handleRequestUnfollow(item)}
                  actionLabel="Unfollow"
                  actionVariant="danger"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'pending' && (
        <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900">
              Pending Requests
            </h3>
          </div>
          {isLoading ? (
            <LoadingItems />
          ) : follows.pending.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm sm:text-base text-zinc-600">
                No pending requests
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {follows.pending.map((item) => (
                <FollowItem
                  key={`${item.entity_type}-${item.entity_id}`}
                  item={item}
                  onAction={() => handleCancelRequest(item.entity_type, item.entity_id)}
                  actionLabel="Cancel Request"
                  actionVariant="outline"
                  showPendingBadge
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'rejected' && (
        <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900">
              Rejected Requests
            </h3>
          </div>
          {isLoading ? (
            <LoadingItems />
          ) : follows.rejected.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <UserX className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm sm:text-base text-zinc-600">
                No rejected requests
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {follows.rejected.map((item) => (
                <FollowItem
                  key={`${item.entity_type}-${item.entity_id}`}
                  item={item}
                  showRejectedBadge
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={showUnfollowModal}
        onClose={() => {
          setShowUnfollowModal(false);
          setPendingUnfollow(null);
        }}
        onConfirm={handleConfirmUnfollow}
        title={
          pendingUnfollow?.entity_type === "church"
            ? "Unfollow Church?"
            : `Unfollow ${pendingUnfollow?.entity_name ?? ""}?`
        }
        message={
          pendingUnfollow?.entity_type === "church"
            ? "You will lose access to this church's missionary directory."
            : "You will stop receiving updates from this missionary."
        }
        confirmText="Unfollow"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

