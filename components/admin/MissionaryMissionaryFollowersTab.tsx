"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { 
  getMissionaryFollowersByMissionary,
  updateMissionaryFollowerStatusByMissionary 
} from "@/app/missionaries/missionary-following-actions";
import type { MissionaryFollowerWithMissionary } from "@/types/missionary-following";

type MissionaryMissionaryFollowersTabProps = {
  missionaryId: number;
};

type FollowerStatus = "pending" | "accepted" | "rejected";

export function MissionaryMissionaryFollowersTab({ missionaryId }: MissionaryMissionaryFollowersTabProps) {
  const [followers, setFollowers] = useState<MissionaryFollowerWithMissionary[]>([]);
  const [filteredFollowers, setFilteredFollowers] = useState<MissionaryFollowerWithMissionary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FollowerStatus | "all">("all");
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadFollowers();
  }, [missionaryId]);

  useEffect(() => {
    filterFollowers();
  }, [followers, searchQuery, statusFilter]);

  const loadFollowers = async () => {
    setIsLoading(true);
    try {
      const result = await getMissionaryFollowersByMissionary(missionaryId);
      if (result.success && result.data) {
        setFollowers(result.data as MissionaryFollowerWithMissionary[]);
      } else {
        toast.error(result.error || "Failed to load missionary followers");
      }
    } catch (error) {
      console.error("Error loading missionary followers:", error);
      toast.error("An error occurred while loading followers");
    } finally {
      setIsLoading(false);
    }
  };

  const filterFollowers = () => {
    let filtered = [...followers];

    if (statusFilter !== "all") {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.missionary.first_name.toLowerCase().includes(query) ||
          f.missionary.last_name.toLowerCase().includes(query) ||
          f.missionary.email.toLowerCase().includes(query)
      );
    }

    setFilteredFollowers(filtered);
  };

  const handleUpdateStatus = async (followerId: number, newStatus: "accepted" | "rejected") => {
    setProcessingIds((prev) => new Set(prev).add(followerId));
    try {
      const result = await updateMissionaryFollowerStatusByMissionary(followerId, newStatus);
      if (result.success) {
        toast.success(`Follower ${newStatus}`);
        setFollowers((prev) =>
          prev.map((f) =>
            f.id === followerId ? { ...f, status: newStatus } : f
          )
        );
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

  const getStatusBadge = (status: FollowerStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
    }
  };

  const pendingCount = followers.filter((f) => f.status === "pending").length;
  const acceptedCount = followers.filter((f) => f.status === "accepted").length;

  const LoadingTableRows = () => (
    <>
      {[...Array(3)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-32 dark:bg-zinc-800"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-40 dark:bg-zinc-800"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-6 bg-zinc-200 rounded-full w-20 dark:bg-zinc-800"></div>
          </td>
          <td className="px-6 py-4">
            <div className="h-4 bg-zinc-200 rounded w-24 dark:bg-zinc-800"></div>
          </td>
          <td className="px-6 py-4 text-right">
            <div className="h-8 bg-zinc-200 rounded w-20 ml-auto dark:bg-zinc-800"></div>
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          Missionary Followers
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          Other missionaries following this missionary
        </p>
        <div className="flex gap-4 text-sm">
          {isLoading ? (
            <>
              <div className="h-4 bg-zinc-200 rounded w-24 animate-pulse dark:bg-zinc-800"></div>
              <div className="h-4 bg-zinc-200 rounded w-24 animate-pulse dark:bg-zinc-800"></div>
            </>
          ) : (
            <>
              <span className="text-zinc-600 dark:text-zinc-400">
                {acceptedCount} Accepted
              </span>
              {pendingCount > 0 && (
                <span className="text-yellow-600 dark:text-yellow-500 font-medium">
                  {pendingCount} Pending
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter("all")}
            disabled={isLoading}
          >
            All ({followers.length})
          </Button>
          <Button
            variant={statusFilter === "pending" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
            disabled={isLoading}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={statusFilter === "accepted" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter("accepted")}
            disabled={isLoading}
          >
            Accepted ({acceptedCount})
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                <LoadingTableRows />
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredFollowers.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">
            {searchQuery || statusFilter !== "all"
              ? "No missionary followers found matching your filters"
              : "No missionary followers yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredFollowers.map((follower) => (
                  <tr key={follower.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {follower.missionary.first_name} {follower.missionary.last_name}
                      </div>
                      {follower.note && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-0.5 max-w-[200px] truncate">
                          &ldquo;{follower.note}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {follower.missionary.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(follower.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {new Date(follower.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {follower.status === "pending" && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleUpdateStatus(follower.id, "accepted")}
                            disabled={processingIds.has(follower.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {processingIds.has(follower.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUpdateStatus(follower.id, "rejected")}
                            disabled={processingIds.has(follower.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {follower.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateStatus(follower.id, "rejected")}
                          disabled={processingIds.has(follower.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      )}
                      {follower.status === "rejected" && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleUpdateStatus(follower.id, "accepted")}
                          disabled={processingIds.has(follower.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processingIds.has(follower.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Accept"
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
