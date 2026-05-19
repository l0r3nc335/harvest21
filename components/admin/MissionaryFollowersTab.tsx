"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Users as UsersIcon, User, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { SearchWithFilter } from "@/components/ui/SearchWithFilter";
import { updateMissionaryFollowerStatus } from "@/app/missionaries/follow-actions";
import { updateMissionaryFollowerStatusByMissionary } from "@/app/missionaries/missionary-following-actions";
import { FollowerCard } from "./FollowerCard";
import { useUserFollowersInfinite, useMissionaryFollowersInfinite } from "@/hooks/useFollowersPagination";
import { useQueryClient } from "@tanstack/react-query";

type MissionaryFollowersTabProps = {
  missionaryId: number;
};

type FollowerStatus = "pending" | "accepted" | "rejected";
type FollowerType = "users" | "missionaries";

export function MissionaryFollowersTab({ missionaryId }: MissionaryFollowersTabProps) {
  const [followerType, setFollowerType] = useState<FollowerType>("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FollowerStatus | "all">("all");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const observerTarget = useRef<HTMLDivElement>(null);

  const userFollowersQuery = useUserFollowersInfinite(missionaryId, 10);
  const missionaryFollowersQuery = useMissionaryFollowersInfinite(missionaryId, 10);

  const activeQuery = followerType === "users" ? userFollowersQuery : missionaryFollowersQuery;
  const { items, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = activeQuery;

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

  const filteredFollowers = useMemo(() => {
    let filtered = [...items];

    if (statusFilter !== "all") {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((f) => {
        if (followerType === "users") {
          return (
            f.first_name.toLowerCase().includes(query) ||
            f.last_name.toLowerCase().includes(query) ||
            f.email.toLowerCase().includes(query)
          );
        } else {
          return (
            f.first_name.toLowerCase().includes(query) ||
            f.last_name.toLowerCase().includes(query) ||
            f.email.toLowerCase().includes(query)
          );
        }
      });
    }

    return filtered;
  }, [items, statusFilter, searchQuery, followerType]);

  const pendingCount = items.filter((f) => f.status === "pending").length;
  const acceptedCount = items.filter((f) => f.status === "accepted").length;
  const totalUserCount = userFollowersQuery.items.length;
  const totalMissionaryCount = missionaryFollowersQuery.items.length;

  const handleUpdateStatus = async (followerId: string, newStatus: "accepted" | "rejected") => {
    setProcessingIds((prev) => new Set(prev).add(followerId));
    try {
      const result = followerType === "users"
        ? await updateMissionaryFollowerStatus(parseInt(followerId, 10), newStatus)
        : await updateMissionaryFollowerStatusByMissionary(parseInt(followerId, 10), newStatus);
        
      if (result.success) {
        toast.success(`Follower ${newStatus}`);
        await queryClient.invalidateQueries({
          queryKey: ["missionaries", missionaryId, "followers"],
        });
      } else {
        toast.error(result.error || "Failed to update follower status");
      }
    } catch (error) {
      console.error("Error updating follower status:", error);
      toast.error("An error occurred");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(followerId);
        return newSet;
      });
    }
  };

  const LoadingCards = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 animate-pulse">
          <div className="shrink-0 w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
            <User className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3"></div>
            <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2"></div>
          </div>
          <div className="w-20 h-8 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <UsersIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
        <h2 className="text-xl sm:text-2xl font-bold text-white">Followers</h2>
      </div>

      <div 
        className="flex gap-1 sm:gap-2 border-b border-zinc-800 overflow-x-auto"
        onWheel={(e) => {
          if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            return;
          }
        }}
      >
        <button
          onClick={() => setFollowerType("users")}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            followerType === "users"
              ? 'border-yellow-500 text-yellow-500'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5" />
          Users ({totalUserCount})
        </button>
        <button
          onClick={() => setFollowerType("missionaries")}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            followerType === "missionaries"
              ? 'border-yellow-500 text-yellow-500'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <UsersIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5" />
          Missionaries ({totalMissionaryCount})
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          {followerType === "users" ? (
            <>
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
                User Followers
              </h3>
            </>
          ) : (
            <>
              <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
                Missionary Followers
              </h3>
            </>
          )}
        </div>

        <div className="mb-6">
          <SearchWithFilter
            value={searchQuery}
            onValueChange={setSearchQuery}
            selectedFilter={statusFilter}
            onFilterChange={(v) => setStatusFilter(v as FollowerStatus | "all")}
            filters={[
              { value: "all", label: `All (${items.length})` },
              { value: "pending", label: `Pending (${pendingCount})` },
              { value: "accepted", label: `Accepted (${acceptedCount})` },
            ]}
            placeholder="Search by name or email..."
            disabled={isLoading}
            ariaLabelInput="Search followers"
            ariaLabelFilter="Status filter"
          />
        </div>

        {isLoading ? (
          <LoadingCards />
        ) : error ? (
          <div className="text-center py-8 sm:py-12">
            <UsersIcon className="w-10 h-10 sm:w-12 sm:h-12 text-red-400 mx-auto mb-3" />
            <p className="text-sm sm:text-base text-red-600 dark:text-red-400">
              Failed to load followers. Please try again.
            </p>
          </div>
        ) : filteredFollowers.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <UsersIcon className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400 mx-auto mb-3" />
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              {searchQuery || statusFilter !== "all"
                ? `No ${followerType === "users" ? "user" : "missionary"} followers found matching your filters`
                : `No ${followerType === "users" ? "user" : "missionary"} followers yet`}
            </p>
            {filteredFollowers.length === 0 && !searchQuery && statusFilter === "all" && (
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                {followerType === "users" 
                  ? "Users will appear here when they follow you"
                  : "Other missionaries will appear here when they follow you"
                }
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3" data-cy="list-follower-requests">
              {filteredFollowers.map((follower) => {
                const displayName = `${follower.first_name} ${follower.last_name}`;
                const displayEmail = follower.email;
                const profilePhotoUrl = follower.profile_photo_url;
                const pageUrl = 'page_url' in follower ? follower.page_url : null;
                
                return (
                  <FollowerCard
                    key={follower.id}
                    follower={{ 
                      id: parseInt(follower.id, 10), 
                      status: follower.status,
                      created_at: follower.requested_at
                    }}
                    displayName={displayName}
                    displayEmail={displayEmail}
                    profilePhotoUrl={profilePhotoUrl}
                    pageUrl={pageUrl}
                    note={follower.note}
                    isProcessing={processingIds.has(follower.id)}
                    onAccept={
                      follower.status === "pending" || follower.status === "rejected"
                        ? () => handleUpdateStatus(follower.id, "accepted")
                        : undefined
                    }
                    onReject={
                      follower.status === "pending" || follower.status === "accepted"
                        ? () => handleUpdateStatus(follower.id, "rejected")
                        : undefined
                    }
                  />
                );
              })}
            </div>
            
            <div ref={observerTarget} className="mt-6 flex justify-center py-4">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
              {!hasNextPage && filteredFollowers.length > 0 && (
                <p className="text-sm text-zinc-400 dark:text-zinc-500">No more items to load</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
