"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MissionaryAccountBasicsTab } from "@/components/admin/MissionaryAccountBasicsTab";
import { PageDetailsTab } from "@/components/admin/shared/PageDetailsTab";
import { MissionaryDonationsTab } from "@/components/admin/MissionaryDonationsTab";
import { MissionaryFollowersTab } from "@/components/admin/MissionaryFollowersTab";
import { MissionaryFollowingTab } from "@/components/missionary/MissionaryFollowingTab";
import { MissionaryInlinePreview } from "@/components/admin/MissionaryInlinePreview";
import {
  MissionarySocialAdminPanel,
  type MissionarySocialAdminDiagnostics,
} from "@/components/admin/MissionarySocialAdminPanel";
import { PreviewViewOnlyWrapper } from "@/components/PreviewViewOnlyWrapper";
import { getMissionaryPreviewData, updateMissionaryDetails, getMissionaryDonations, sendInviteToManagedMissionary, updateMissionaryPagePublishStatus } from "@/app/admin/missionaries/[id]/actions";
import type { PageDataWithRelations } from "@/lib/pageDataLoader";
import toast from "react-hot-toast";

type MissionaryDetailData = {
  id: number;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  country_of_residence: string | null;
  destination_country: string;
  mission_status: string;
  open_to_visits: boolean;
  visits_start_date: string | null;
  visits_end_date: string | null;
  biography: string | null;
  agency_id: number | null;
  sending_church_id: number | null;
  mission_field_church_id: number | null;
  college_id: number | null;
  created_at: string;
  agency?: {
    id: number;
    name: string;
  } | null;
  sendingChurch?: {
    id: number;
    name: string;
  } | null;
  missionFieldChurch?: {
    id: number;
    name: string;
  } | null;
  college?: {
    id: number;
    name: string;
  } | null;
  page?: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
  } | null;
};

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
};

type MissionaryManagePageClientProps = {
  missionary: MissionaryDetailData;
  initialPageData: PageDataWithRelations;
  initialUserProfile?: UserProfile | null;
  isAdmin?: boolean;
  socialDiagnostics?: MissionarySocialAdminDiagnostics;
};

type PreviewData = {
  missionary: {
    id: number;
    first_name: string;
    last_name: string;
    destination_country: string | null;
    user_id?: string | null;
    agency?: {
      id: number;
      name: string;
    } | null;
    church?: {
      id: number;
      name: string;
    } | null;
  };
  page: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    page_template: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    published_at: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    description?: string | null;
    thumbnail_url?: string | null;
    created_at: string;
  }>;
  widgets: Array<{
    id: number;
    widget_type: string;
    widget_title: string;
    widget_data: Record<string, unknown>;
    created_at: string;
  }>;
  donations?: {
    totalPledged: number;
    totalReceived: number;
  };
  isApproved: boolean;
};

type TabType = "account-basics" | "page-details" | "donations" | "followers" | "following";

export function MissionaryManagePageClient({ 
  missionary,
  initialPageData,
  initialUserProfile = null,
  isAdmin = true,
  socialDiagnostics,
}: MissionaryManagePageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("account-basics");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [pendingAction, setPendingAction] = useState<"preview" | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Extract pageId from missionary data (already fetched on server)
  const pageId = useMemo(() => missionary.page?.id ?? null, [missionary.page?.id]);

  const tabs = [
    { id: "account-basics" as TabType, label: "Account Basics" },
    { id: "page-details" as TabType, label: "Page Details" },
    { id: "donations" as TabType, label: "Donations" },
    { id: "followers" as TabType, label: "Followers" },
    { id: "following" as TabType, label: "Following" },
  ];

  const missionaryName = `${missionary.first_name} ${missionary.last_name}`;

  // Memoize page data to prevent unnecessary re-renders
  const memoizedPageData = useMemo(() => ({
    page: initialPageData.page,
    media: initialPageData.media,
    widgets: initialPageData.widgets,
  }), [initialPageData.page, initialPageData.media, initialPageData.widgets]);

  // Memoize entity object to prevent unnecessary re-renders
  const memoizedEntity = useMemo(() => ({
    id: missionary.id,
    name: missionaryName
  }), [missionary.id, missionaryName]);

  const handleTabClick = (tabId: TabType) => {
    if (hasUnsavedChanges && activeTab === "page-details") {
      setPendingTab(tabId);
      setShowUnsavedWarning(true);
      return;
    }
    setActiveTab(tabId);
  };

  const handlePreviewClick = async () => {
    if (hasUnsavedChanges && activeTab === "page-details") {
      setPendingAction("preview");
      setShowUnsavedWarning(true);
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);
    
    try {
      const result = await getMissionaryPreviewData(missionary.id);
      
      if (result.success && result.data) {
        // Always show preview in admin context, regardless of approval status
        setPreviewData(result.data);
        setIsPreviewMode(true);
      } else {
        setPreviewError(result.error || "Failed to load preview data.");
      }
    } catch (error) {
      console.error("Error loading preview:", error);
      setPreviewError("An unexpected error occurred while loading the preview.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDiscardAndProceed = async () => {
    setShowUnsavedWarning(false);
    setHasUnsavedChanges(false);
    
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    } else if (pendingAction === "preview") {
      setPendingAction(null);
      setIsLoadingPreview(true);
      setPreviewError(null);
      
      try {
        const result = await getMissionaryPreviewData(missionary.id);
        
        if (result.success && result.data) {
          setPreviewData(result.data);
          setIsPreviewMode(true);
        } else {
          setPreviewError(result.error || "Failed to load preview data.");
        }
      } catch (error) {
        console.error("Error loading preview:", error);
        setPreviewError("An unexpected error occurred while loading the preview.");
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  const handleBackToSettings = () => {
    setIsPreviewMode(false);
    setPreviewData(null);
    setPreviewError(null);
    router.refresh();
  };

  const handlePublishPage = async () => {
    if (!pageId) return;
    setIsPublishing(true);
    try {
      const result = await updateMissionaryPagePublishStatus(pageId, true);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to publish page");
      }
    } catch (e) {
      toast.error("Failed to publish page");
    } finally {
      setIsPublishing(false);
    }
  };

  // If in preview mode, show the preview component
  if (isPreviewMode && previewData) {
    return (
      <PreviewViewOnlyWrapper onBack={handleBackToSettings} backLabel="← Back">
        <MissionaryInlinePreview
          missionary={previewData.missionary}
          page={previewData.page}
          media={previewData.media}
          widgets={previewData.widgets}
          donations={previewData.donations}
          onBack={handleBackToSettings}
          readOnly={true}
          initialUserProfile={initialUserProfile}
        />
      </PreviewViewOnlyWrapper>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Breadcrumbs */}
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-600">
        <Link href="/admin/missionaries" className="hover:text-zinc-900">
          Missionaries
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-zinc-900">{missionaryName}</span>
      </div>

      {/* Page Title and Actions */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{missionaryName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {initialPageData.page?.id && (
            <Button
              onClick={handlePublishPage}
              disabled={isPublishing || initialPageData.page?.is_published}
              className="bg-yellow-500 text-black hover:bg-yellow-600"
            >
              {initialPageData.page?.is_published
                ? "Published"
                : isPublishing
                  ? "Publishing..."
                  : "Publish Page"}
            </Button>
          )}
          {missionary.page?.page_url && (
            <Button
              variant="primary"
              onClick={handlePreviewClick}
              disabled={isLoadingPreview}
            >
              {isLoadingPreview ? "Loading Preview..." : "Preview Page"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <div 
          className="overflow-x-auto scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            overscrollBehaviorX: "contain",
          }}
        >
          <nav className="-mb-px flex space-x-4 md:space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-brand-yellow text-brand-yellow"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Preview Error Message (only show if there's a fetch error, not for unpublished pages) */}
      {previewError && !isPreviewMode && (
        <div className="mb-6 p-6 bg-zinc-50 border border-zinc-200 rounded-lg">
          <p className="text-center text-zinc-400">{previewError}</p>
        </div>
      )}

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "account-basics" && (
          <div className="space-y-6">
            <MissionaryAccountBasicsTab
              missionary={missionary}
              pageId={initialPageData.page?.id ?? missionary.page?.id ?? null}
              isAdmin={isAdmin}
              onChurchAffiliationChange={() => router.refresh()}
              onSendInvite={missionary.user_id == null ? async (data) => sendInviteToManagedMissionary(missionary.id, data) : undefined}
              onUpdateMissionary={async (missionaryId, data, originalFirstName, originalLastName) => {
                return await updateMissionaryDetails(missionaryId, data, originalFirstName, originalLastName);
              }}
            />
            {socialDiagnostics && <MissionarySocialAdminPanel data={socialDiagnostics} />}
          </div>
        )}
        {activeTab === "page-details" && (
          <PageDetailsTab
            entity={memoizedEntity}
            organizationType="missionary"
            organizationId={missionary.id}
            onUnsavedChanges={setHasUnsavedChanges}
            initialPageData={memoizedPageData}
            isPageOwner={false}
          />
        )}
        {activeTab === "donations" && (
          <MissionaryDonationsTab
            missionaryId={missionary.id}
            pageId={pageId}
            onGetDonations={async (pageId) => {
              return await getMissionaryDonations(pageId);
            }}
          />
        )}
        {activeTab === "followers" && (
          <MissionaryFollowersTab
            missionaryId={missionary.id}
          />
        )}
        {activeTab === "following" && (
          <MissionaryFollowingTab />
        )}
      </div>

      <Modal
        isOpen={showUnsavedWarning}
        onClose={() => {
          setShowUnsavedWarning(false);
          setPendingTab(null);
          setPendingAction(null);
        }}
        title="Unsaved Changes"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Your unsaved changes will be lost. Do you want to continue?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowUnsavedWarning(false);
                setPendingTab(null);
                setPendingAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDiscardAndProceed}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

