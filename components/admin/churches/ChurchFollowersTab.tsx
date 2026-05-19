"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { getChurchFollowers, updateFollowerStatus } from "@/app/admin/churches/actions";

interface ChurchFollowersTabProps {
  churchId: number;
}

type FollowerStatus = "pending" | "accepted" | "rejected" | "blocked" | "unfollowed";

interface Follower {
  id: number;
  created_at: string;
  status: FollowerStatus;
  note?: string | null;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function ChurchFollowersTab({ churchId }: ChurchFollowersTabProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [filteredFollowers, setFilteredFollowers] = useState<Follower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FollowerStatus | "all">("all");
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadFollowers();
  }, [churchId]);

  useEffect(() => {
    filterFollowers();
  }, [followers, searchQuery, statusFilter]);

  const loadFollowers = async () => {
    setIsLoading(true);
    try {
      const result = await getChurchFollowers(churchId);
      if (result.success && result.data) {
        setFollowers(result.data as Follower[]);
      } else {
        toast.error(result.error || "Failed to load followers");
      }
    } catch (error) {
      console.error("Error loading followers:", error);
      toast.error("An error occurred while loading followers");
    } finally {
      setIsLoading(false);
    }
  };

  const filterFollowers = () => {
    let filtered = [...followers];

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.user.first_name.toLowerCase().includes(query) ||
          f.user.last_name.toLowerCase().includes(query) ||
          f.user.email.toLowerCase().includes(query)
      );
    }

    setFilteredFollowers(filtered);
  };

  const handleUpdateStatus = async (followerId: number, newStatus: "accepted" | "rejected" | "blocked" | "unfollowed") => {
    setProcessingIds((prev) => new Set(prev).add(followerId));
    try {
      const result = await updateFollowerStatus(followerId, newStatus);
      if (result.success) {
        toast.success(newStatus === "unfollowed" ? "Follower removed" : `Follower ${newStatus}`);
        setFollowers((prev) =>
          newStatus === "unfollowed"
            ? prev.filter((f) => f.id !== followerId)
            : prev.map((f) =>
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
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            <CheckCircle className="h-3 w-3" />
            Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            <XCircle className="h-3 w-3" />
            Blocked
          </span>
        );
    }
  };

  const pendingCount = followers.filter((f) => f.status === "pending").length;
  const acceptedCount = followers.filter((f) => f.status === "accepted").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          Followers
        </h2>
        <div className="flex gap-4 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            {acceptedCount} Accepted
          </span>
          {pendingCount > 0 && (
            <span className="text-yellow-600 dark:text-yellow-500 font-medium">
              {pendingCount} Pending
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
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
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All ({followers.length})
          </Button>
          <Button
            variant={statusFilter === "pending" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={statusFilter === "accepted" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter("accepted")}
          >
            Accepted ({acceptedCount})
          </Button>
        </div>
      </div>

      {/* Followers List */}
      {filteredFollowers.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">
            {searchQuery || statusFilter !== "all"
              ? "No followers found matching your filters"
              : "No followers yet"}
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
                        {follower.user.first_name} {follower.user.last_name}
                      </div>
                      {follower.note && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-0.5 max-w-[200px] truncate">
                          &ldquo;{follower.note}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {follower.user.email}
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
                          onClick={() => handleUpdateStatus(follower.id, "unfollowed")}
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

