"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import {
  updatePagePublishStatus,
  getPageByEntity,
  getOrganizationName,
  type OrganizationType,
} from "@/lib/pageActions";

type PageApprovalTabProps = {
  organizationType: OrganizationType;
  organizationId: number;
  initialData?: {
    pageId: number | null;
  };
};

export function PageApprovalTab({ organizationType, organizationId, initialData }: PageApprovalTabProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(!initialData);
  const [pageId, setPageId] = useState<number | null>(initialData?.pageId || null);
  const [pageData, setPageData] = useState<{ id: number; is_published: boolean; is_review: boolean | null; name: string | null; created_at: string; published_at: string | null } | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    async function loadPage() {
      setIsLoading(true);
      try {
        const [pageResult, orgNameResult] = await Promise.all([
          getPageByEntity(organizationType, organizationId),
          getOrganizationName(organizationType, organizationId),
        ]);

        if (pageResult.success && pageResult.data) {
          const page = pageResult.data as unknown as { 
            id: number; 
            is_published: boolean; 
            is_review: boolean | null; 
            name: string | null; 
            created_at: string;
            published_at: string | null;
          };
          setPageId(page.id);
          setPageData(page);
        } else {
          setPageData(null);
        }

        if (orgNameResult.success && orgNameResult.name) {
          setOrganizationName(orgNameResult.name);
        }
      } catch (error) {
        console.error("Error loading page:", error);
        toast.error("Failed to load page data");
        setPageData(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadPage();
  }, [organizationType, organizationId, initialData]);

  const handleApprove = async () => {
    if (!pageId) {
      toast.error("Page ID not found");
      return;
    }

    setIsApproving(true);
    const toastId = toast.loading("Approving page...");

    try {
      const result = await updatePagePublishStatus(organizationType, pageId, true);
      if (result.success) {
        toast.success(result.message || "Page approved and published successfully!", { id: toastId });
        router.refresh();
      } else {
        toast.error(result.message || "Failed to approve page", { id: toastId });
      }
    } catch (error) {
      console.error("Error approving page:", error);
      toast.error("An unexpected error occurred while approving the page", { id: toastId });
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D3AF37] mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">Loading page data...</p>
        </div>
      </div>
    );
  }

  if (!pageId || !pageData) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center py-6 sm:py-8">
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">Page not found. Please create a page first.</p>
        </div>
      </div>
    );
  }

  const displayName = pageData.name || organizationName || "Untitled Page";
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Page Approval</h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          {pageData.is_published ? "Approved page:" : "Review and approve the page:"} <span className="font-medium">{displayName}</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            {displayName}
          </p>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
            {pageData.is_published 
              ? "Page is published and live" 
              : pageData.is_review === true
              ? "Page is pending review" 
              : "No pending review - awaiting submission for review"}
          </p>
          {pageData.is_published && pageData.published_at && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Published: {formatDate(pageData.published_at)}
            </p>
          )}
          {!pageData.is_published && pageData.created_at && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Created: {formatDate(pageData.created_at)}
            </p>
          )}
        </div>
        {!pageData.is_published && pageData.is_review === true && (
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button 
              variant="primary" 
              onClick={handleApprove}
              disabled={isApproving}
              className="h-9 px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
            >
              {isApproving ? "Approving..." : "Approve & Publish"}
            </Button>
          </div>
        )}
        {pageData.is_published && (
          <div className="flex items-center gap-2 sm:shrink-0">
            <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Approved
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
