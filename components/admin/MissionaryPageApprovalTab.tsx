"use client";
import { useState, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";

type MissionaryPageApprovalTabProps = {
  missionaryId: number;
  pageId: number | null;
  onUpdatePublishStatus: (
    pageId: number,
    isPublished: boolean
  ) => Promise<{ success: boolean; message?: string }>;
  onGetApprovals: (
    pageId: number
  ) => Promise<{ success: boolean; data?: unknown[]; message?: string }>;
};

type ReviewRequest = {
  id: number;
  date: string;
  formattedDate: string;
  author: string;
  status: "pending" | "approved" | "published";
  isCurrentlyPublished?: boolean;
};

export function MissionaryPageApprovalTab({ 
  missionaryId,
  pageId,
  onUpdatePublishStatus,
  onGetApprovals,
}: MissionaryPageApprovalTabProps) {
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!pageId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch approvals from page_approvals table
        const result = await onGetApprovals(pageId);
        if (result.success && result.data) {
          setReviewRequests(result.data as ReviewRequest[]);
        }
      } catch (error) {
        console.error("Error fetching approvals:", error);
        setReviewRequests([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [pageId, onGetApprovals]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${month}-${day}, ${displayHours}:${minutes.toString().padStart(2, "0")}${ampm}`;
  };

  const handlePublish = async (id: number) => {
    if (!pageId) {
      toast.error("Page ID not found");
      return;
    }

    try {
      const result = await onUpdatePublishStatus(pageId, true);
      if (result.success) {
        toast.success(result.message || "Page published successfully!");
        // Update local state
        setReviewRequests((prev) =>
          prev.map((req) =>
            req.id === id
              ? { ...req, status: "published" as const, isCurrentlyPublished: true }
              : { ...req, isCurrentlyPublished: false }
          )
        );
      } else {
        toast.error(result.message || "Failed to publish page");
      }
    } catch (error) {
      console.error("Error publishing:", error);
      toast.error("An error occurred while publishing");
    }
  };

  const handleUnpublish = async (id: number) => {
    if (!pageId) {
      toast.error("Page ID not found");
      return;
    }

    try {
      const result = await onUpdatePublishStatus(pageId, false);
      if (result.success) {
        toast.success(result.message || "Page unpublished successfully!");
        // Update local state
        setReviewRequests((prev) =>
          prev.map((req) =>
            req.id === id ? { ...req, status: "approved" as const, isCurrentlyPublished: false } : req
          )
        );
      } else {
        toast.error(result.message || "Failed to unpublish page");
      }
    } catch (error) {
      console.error("Error unpublishing:", error);
      toast.error("An error occurred while unpublishing");
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-zinc-200 rounded animate-pulse dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Review Requests</h2>
        <Dropdown label="Sort By" selectedValue="Sort By">
          <DropdownItem onClick={() => {}}>Date (Newest)</DropdownItem>
          <DropdownItem onClick={() => {}}>Date (Oldest)</DropdownItem>
          <DropdownItem onClick={() => {}}>Author</DropdownItem>
        </Dropdown>
      </div>

      <div className="space-y-4">
        {reviewRequests.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">No review requests found</p>
        ) : (
          reviewRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-zinc-900">
                    {formatDate(request.date)}
                  </span>
                  {request.isCurrentlyPublished && (
                    <Badge variant="success">CURRENT PUBLISHED</Badge>
                  )}
                </div>
                <p className="text-sm text-zinc-600">{request.formattedDate}</p>
                <p className="text-sm text-zinc-600">By {request.author}</p>
              </div>
              <div className="flex items-center gap-2">
                {request.isCurrentlyPublished ? (
                  <Button variant="secondary" onClick={() => handleUnpublish(request.id)}>
                    Unpublish
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => handlePublish(request.id)}>
                    Publish
                  </Button>
                )}
                <button className="cursor-pointer p-2 text-zinc-600 hover:text-zinc-900">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

