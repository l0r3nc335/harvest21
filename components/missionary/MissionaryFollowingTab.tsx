"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Users, User, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { SearchWithFilter } from "@/components/ui/SearchWithFilter";
import {
  unfollowMissionaryAsMissionary,
  cancelMissionaryFollowRequest,
} from "@/app/missionaries/missionary-following-actions";
import { unfollowEntity, cancelFollowRequest } from "@/app/settings/following-actions";
import { MissionaryFollowItem } from "@/components/missionary/MissionaryFollowItem";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useMissionaryFollowingInfinite } from "@/hooks/useFollowingPagination";
import { useQueryClient } from "@tanstack/react-query";
import type { MissionaryFollowingItem } from "@/types/pagination";

export function MissionaryFollowingTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<'all' | 'following' | 'pending' | 'rejected'>('all');
  const [pendingUnfollowItem, setPendingUnfollowItem] = useState<MissionaryFollowingItem | null>(null);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);
  const queryClient = useQueryClient();
  const observerTarget = useRef<HTMLDivElement>(null);

  const { items, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useMissionaryFollowingInfinite(10);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { following, pending, rejected, filteredFollowing, filteredPending, filteredRejected } = useMemo(() => {
    const sortByDate = (a: typeof items[0], b: typeof items[0]) => {
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
    };

    const following = items.filter((item) => item.status === "accepted").sort(sortByDate);
    const pending = items.filter((item) => item.status === "pending").sort(sortByDate);
    const rejected = items.filter((item) => item.status === "rejected").sort(sortByDate);

    const query = searchQuery.toLowerCase().trim();
    const filterItems = (list: typeof following) => {
      if (!query) return list;
      return list.filter((item) =>
        item.missionary_name.toLowerCase().includes(query)
      );
    };

    const filteredFollowing = sectionFilter === 'all' || sectionFilter === 'following' ? filterItems(following) : [];
    const filteredPending = sectionFilter === 'all' || sectionFilter === 'pending' ? filterItems(pending) : [];
    const filteredRejected = sectionFilter === 'all' || sectionFilter === 'rejected' ? filterItems(rejected) : [];

    return { following, pending, rejected, filteredFollowing, filteredPending, filteredRejected };
  }, [items, searchQuery, sectionFilter]);

  const handleRequestUnfollow = (item: MissionaryFollowingItem) => {
    setPendingUnfollowItem(item);
    setShowUnfollowModal(true);
  };

  const handleConfirmUnfollow = async () => {
    if (!pendingUnfollowItem) return;
    try {
      const result =
        pendingUnfollowItem.entity_type === "church" && pendingUnfollowItem.entity_id != null
          ? await unfollowEntity("church", pendingUnfollowItem.entity_id)
          : await unfollowMissionaryAsMissionary(pendingUnfollowItem.missionary_id);
      if (result.success) {
        toast.success(result.message || "Unfollowed successfully");
        await queryClient.invalidateQueries({
          queryKey: ["missionaries", "following"],
        });
      } else {
        toast.error(result.error || "Failed to unfollow");
      }
    } catch (error) {
      console.error("Error unfollowing:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setPendingUnfollowItem(null);
      setShowUnfollowModal(false);
    }
  };

  const handleCancelRequest = async (item: typeof items[0]) => {
    try {
      const result = item.entity_type === "church" && item.entity_id != null
        ? await cancelFollowRequest("church", item.entity_id)
        : await cancelMissionaryFollowRequest(item.missionary_id);
      if (result.success) {
        toast.success(result.message || "Request cancelled");
        await queryClient.invalidateQueries({
          queryKey: ["missionaries", "following"],
        });
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
        <div key={i} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-zinc-200 bg-white animate-pulse">
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-200 flex items-center justify-center">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 rounded w-1/3"></div>
            <div className="h-3 bg-zinc-200 rounded w-1/2"></div>
          </div>
          <div className="w-20 h-8 bg-zinc-200 rounded"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
        <h2 className="text-xl sm:text-2xl font-bold text-white">Following</h2>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900">
            Your Following
          </h3>
        </div>

        <div className="mb-6">
          <SearchWithFilter
            value={searchQuery}
            onValueChange={setSearchQuery}
            selectedFilter={sectionFilter}
            onFilterChange={(v) => setSectionFilter(v as 'all' | 'following' | 'pending' | 'rejected')}
            filters={[
              { value: "all", label: `All (${following.length + pending.length + rejected.length})` },
              { value: "following", label: `Following (${following.length})` },
              { value: "pending", label: `Pending (${pending.length})` },
              { value: "rejected", label: `Rejected (${rejected.length})` },
            ]}
            placeholder="Search by name..."
            disabled={isLoading}
            ariaLabelInput="Search missionaries"
            ariaLabelFilter="Section filter"
          />
        </div>

        {isLoading ? (
          <LoadingItems />
        ) : error ? (
          <div className="text-center py-8 sm:py-12">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-red-400 mx-auto mb-3" />
            <p className="text-sm sm:text-base text-red-600">
              Failed to load following. Please try again.
            </p>
          </div>
        ) : (() => {
          const listItems = [
            ...filteredPending.map((item) => ({ item, type: 'pending' as const })),
            ...filteredFollowing.map((item) => ({ item, type: 'following' as const })),
            ...filteredRejected.map((item) => ({ item, type: 'rejected' as const })),
          ];
          if (listItems.length === 0) {
            return (
              <div className="text-center py-8 sm:py-12">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-zinc-600">
                  {searchQuery || sectionFilter !== 'all'
                    ? "No one found matching your filters"
                    : "You're not following any missionaries or churches yet"
                  }
                </p>
                {!searchQuery && sectionFilter === 'all' && (
                  <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                    Start following missionaries and churches to see their updates
                  </p>
                )}
              </div>
            );
          }
          return (
            <>
              <div className="space-y-2 sm:space-y-3">
                {listItems.map(({ item, type }) => (
                  <MissionaryFollowItem
                    key={item.id}
                    item={{
                      id: item.entity_type === "church" && item.entity_id != null ? item.entity_id : item.missionary_id,
                      followed_missionary_id: item.missionary_id,
                      missionary_name: item.missionary_name,
                      status: item.status,
                      requested_at: item.requested_at,
                      page_url: item.page_url,
                      profile_photo_url: item.profile_photo_url,
                      entity_type: item.entity_type,
                    }}
                    onAction={type === 'following'
                      ? () => handleRequestUnfollow(item)
                      : type === 'pending'
                        ? () => handleCancelRequest(item)
                        : undefined}
                    actionLabel={type === 'following' ? 'Unfollow' : type === 'pending' ? 'Cancel Request' : undefined}
                    actionVariant={type === 'following' ? 'danger' : type === 'pending' ? 'outline' : undefined}
                    showPendingBadge={type === 'pending'}
                    showRejectedBadge={type === 'rejected'}
                  />
                ))}
              </div>
              
              <div ref={observerTarget} className="mt-6 flex justify-center py-4">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                )}
                {!hasNextPage && listItems.length > 0 && (
                  <p className="text-sm text-zinc-400">No more items to load</p>
                )}
              </div>
            </>
          );
        })()}
      </div>

      <ConfirmationModal
        isOpen={showUnfollowModal}
        onClose={() => {
          setShowUnfollowModal(false);
          setPendingUnfollowItem(null);
        }}
        onConfirm={handleConfirmUnfollow}
        title={
          pendingUnfollowItem?.entity_type === "church"
            ? "Unfollow Church?"
            : `Unfollow ${pendingUnfollowItem?.missionary_name ?? ""}?`
        }
        message={
          pendingUnfollowItem?.entity_type === "church"
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
