"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, AlertTriangle, Home, User, Users, DollarSign, MessageSquare, Shield, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SettingsSidebar } from "./SettingsSidebar";
import { MissionaryAccountBasicsTab } from "@/components/admin/MissionaryAccountBasicsTab";
import { PageDetailsTab } from "@/components/admin/shared/PageDetailsTab";
import { MissionaryDonationsTab } from "@/components/admin/MissionaryDonationsTab";
import { MissionaryFollowersTab } from "@/components/admin/MissionaryFollowersTab";
import { MissionarySecurityTab } from "./MissionarySecurityTab";
import { SocialMediaConnectionTab } from "./social-media-connection-tab";
import { MessagesSettingsTab } from "./tabs/MessagesSettingsTab";
import { MissionaryFollowingTab } from "@/components/missionary/MissionaryFollowingTab";
import { MissionaryPublicView } from "@/components/missionary/MissionaryPublicView";
import { PreviewViewOnlyWrapper } from "@/components/PreviewViewOnlyWrapper";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";
import { 
  updateCurrentMissionaryDetails,
  getDonationsForCurrentUser,
  getPreviewDataForCurrentUser,
  publishPage,
} from "@/app/settings/actions";
import { deserializeTemplateContent } from "@/lib/templates/contentHelpers";
import type { UpdateMissionaryDetailsData } from "@/app/admin/missionaries/[id]/actions";
import { supabase } from "@/lib/supabaseClient";
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
  allow_direct_messages?: boolean;
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
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    is_published: boolean;
    is_review: boolean | null;
    donation_percentage: number | null;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
  } | null;
};

type InitialPageData = {
  page: {
    id: number;
    page_url: string;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    is_review: boolean | null;
    name: string | null;
  } | null;
  media: Array<{
    id: number;
    media_type: string;
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
    profile_photo_url: string | null;
    name: string | null;
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

type MissionarySettingsClientProps = {
  missionary: MissionaryDetailData;
  initialPageData: InitialPageData;
  initialTab?: string;
  initialUnreadCount?: number;
};

type TabType =
  | "account"
  | "page-details"
  | "followers"
  | "following"
  | "donations"
  | "messages"
  | "security"
  | "social-media-connection";

export function MissionarySettingsClient({
  missionary,
  initialPageData,
  initialTab = "account",
  initialUnreadCount = 0,
}: MissionarySettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || "account");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      [
        "account",
        "page-details",
        "followers",
        "following",
        "donations",
        "messages",
        "security",
        "social-media-connection",
      ].includes(tabParam)
    ) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUserProfile, setPreviewUserProfile] = useState<{ id: string; first_name: string; last_name: string; email: string; role: number; profile_photo_url: string | null; page_url: string | null } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [pendingAction, setPendingAction] = useState<"preview" | null>(null);

  const pageId = useMemo(() => missionary.page?.id ?? null, [missionary.page?.id]);
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
      const [result, profileResponse] = await Promise.all([
        getPreviewDataForCurrentUser(),
        fetch('/api/user-profile').then(res => {
          if (res.ok) {
            return res.json();
          }
          console.error('Failed to fetch user profile:', res.status);
          return null;
        }).catch((err) => {
          console.error('Error fetching user profile:', err);
          return null;
        })
      ]);
      
      console.log('Preview user profile fetched:', profileResponse);
      
      if (result.success && result.data) {
        const data = result.data as { missionary?: any; [key: string]: any; page: any; media: any; donations: any; isApproved: boolean };
        if (data.missionary) {
          setPreviewData(data as PreviewData);
          setPreviewUserProfile(profileResponse);
          setIsPreviewMode(true);
        } else {
          setPreviewError("Missionary data not found in preview");
        }
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
      await handlePreviewClick();
    }
  };

  const handleBackToSettings = () => {
    setIsPreviewMode(false);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewUserProfile(null);
    router.refresh();
  };

  // Helper function to check if HTML content is actually empty
  const isHtmlContentEmpty = (html: string | null | undefined): boolean => {
    if (!html) return true;
    
    // Remove HTML tags and decode HTML entities
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || tempDiv.innerText || "";
    
    // Check if there's any meaningful content after trimming
    return textContent.trim() === "";
  };

  const handlePublishPage = async () => {
    const page = initialPageData.page;
    const missingFieldNames: string[] = [];
    const missingFieldIds = new Set<string>();

    if (!page?.profile_photo_url || page.profile_photo_url.trim() === "") {
      missingFieldNames.push("Profile Photo");
      missingFieldIds.add("profile_photo");
    }

    if (!page?.banner_photo_url || page.banner_photo_url.trim() === "") {
      missingFieldNames.push("Banner Photo");
      missingFieldIds.add("banner_photo");
    }

    if (!page?.name || page.name.trim() === "") {
      missingFieldNames.push("Page name");
      missingFieldIds.add("page_name");
    }

    if (!page?.short_quote || page.short_quote.trim() === "") {
      missingFieldNames.push("Short Quote");
      missingFieldIds.add("short_quote");
    }

    if (page?.template_content) {
      const templateState = deserializeTemplateContent(page.template_content);
      if (templateState) {
        const headerTitle = templateState.fields["headerTitle"] as string;
        const headerSubtitle = templateState.fields["headerSubtitle"] as string;
        const missionContent = templateState.fields["missionContent"] as string;

        if (!headerTitle || headerTitle.trim() === "") {
          missingFieldNames.push("Title");
          missingFieldIds.add("headerTitle");
        }

        if (!headerSubtitle || headerSubtitle.trim() === "") {
          missingFieldNames.push("Subtitle / Description");
          missingFieldIds.add("headerSubtitle");
        }

        if (!missionContent || missionContent.trim() === "") {
          missingFieldNames.push("Mission Description");
          missingFieldIds.add("missionContent");
        }

        const goalsList = templateState.fields["goalsList"] as string[];
        const challengesList = templateState.fields["challengesList"] as string[];

        if (!goalsList || goalsList.length === 0 || goalsList.every(item => !item || item.trim() === "")) {
          missingFieldNames.push("Key Goals");
          missingFieldIds.add("goalsList");
        }

        if (!challengesList || challengesList.length === 0 || challengesList.every(item => !item || item.trim() === "")) {
          missingFieldNames.push("Challenges");
          missingFieldIds.add("challengesList");
        }
      } else {
        missingFieldNames.push("About You (template content)");
      }
    } else {
      missingFieldNames.push("About You (template content)");
    }

    if (missingFieldNames.length > 0) {
      setMissingFields(missingFieldIds);
      toast.error(
        `Please complete the following required fields before publishing: ${missingFieldNames.join(", ")}`,
        { duration: 5000 }
      );
      setTimeout(() => setMissingFields(new Set()), 5000);
      return;
    }

    setMissingFields(new Set());
    setIsPublishing(true);
    try {
      const result = await publishPage();
      if (result.success) {
        toast.success(result.message || "Your page is live!");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to publish page");
      }
    } catch (error) {
      console.error("Error publishing page:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLogout = async () => {
    const toastId = toast.loading("Signing out...");
    
    try {
      await supabase.auth.signOut();
      
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (!response.ok) {
        console.warn("Server signout returned error");
      }

      toast.success("Successfully signed out!", { id: toastId });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to sign out. Please try again.", { id: toastId });
    }
  };

  // Show loading skeleton while preview is loading
  if (isLoadingPreview) {
    return (
      <MissionaryPublicView
        missionary={{
          id: missionary.id,
          first_name: missionary.first_name,
          last_name: missionary.last_name,
          destination_country: missionary.destination_country,
          user_id: missionary.user_id,
          agency: missionary.agency,
          church: missionary.sendingChurch,
        }}
        page={{
          id: initialPageData.page?.id || 0,
          page_url: initialPageData.page?.page_url || '',
          name: initialPageData.page?.name || null,
          profile_photo_url: initialPageData.page?.profile_photo_url || null,
          banner_photo_url: initialPageData.page?.banner_photo_url || null,
          short_quote: initialPageData.page?.short_quote || null,
          about_text: initialPageData.page?.about_text || null,
          intro_text: initialPageData.page?.intro_text || null,
          template_content: null,
          video_hashed_id: null,
          donation_percentage: initialPageData.page?.donation_percentage || null,
          is_published: initialPageData.page?.is_published || false,
          published_at: null,
        }}
        media={[]}
        widgets={[]}
        donations={{ totalPledged: 0, totalReceived: 0 }}
        isAdminPreview={true}
        onBack={handleBackToSettings}
        initialUserProfile={previewUserProfile}
        isLoading={true}
        readOnly={true}
      />
    );
  }

  if (isPreviewMode && previewData) {
    return (
      <PreviewViewOnlyWrapper onBack={handleBackToSettings}>
        <MissionaryPublicView
          missionary={previewData.missionary}
          page={previewData.page}
          media={previewData.media}
          widgets={previewData.widgets}
          donations={previewData.donations}
          isAdminPreview={true}
          initialUserProfile={previewUserProfile}
          isLoading={false}
          readOnly={true}
        />
      </PreviewViewOnlyWrapper>
    );
  }

  if (previewError) {
    return (
      <div className="p-3 sm:p-4 md:p-6 min-h-screen bg-black">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <p className="text-sm sm:text-base text-red-500">{previewError}</p>
        </div>
        <Button onClick={handleBackToSettings} variant="secondary" className="text-xs sm:text-sm">
          Back to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black overflow-hidden">
      <SettingsSidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => handleTabClick(tab as TabType)} 
        onLogout={handleLogout}
        mobileRightSlot={<NotificationDropdown unreadCount={initialUnreadCount} variant="mobile" />}
        items={[
          { id: "account", label: "Account", icon: <Home className="w-5 h-5" /> },
          { id: "page-details", label: "Page Details", icon: <User className="w-5 h-5" /> },
          { id: "followers", label: "Followers", icon: <Users className="w-5 h-5" /> },
          { id: "following", label: "Following", icon: <Users className="w-5 h-5" /> },
          { id: "donations", label: "Donations", icon: <DollarSign className="w-5 h-5" /> },
          { id: "messages", label: "Messages", icon: <MessageSquare className="w-5 h-5" /> },
          { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
          {
            id: "social-media-connection",
            label: "Social Media Connection",
            icon: <Share2 className="w-5 h-5" />,
          },
        ]} 
      />

      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 mt-12 lg:mt-0 lg:ml-64 lg:pt-6 overflow-y-auto h-screen">
        <div className="hidden lg:flex flex-row items-center justify-end w-full">
          <NotificationDropdown unreadCount={initialUnreadCount} variant="desktop" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{missionaryName}</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">Manage your account and page settings</p>
          </div> 
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {activeTab === "page-details" && !initialPageData.page?.is_published && (
              <Button
                onClick={handlePublishPage}
                disabled={isPublishing}
                variant="secondary"
                className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 text-xs sm:text-sm whitespace-nowrap"
                data-cy="button-publish-page"
              >
                {isPublishing ? "Publishing..." : "Publish Page"}
              </Button>
            )}
            {activeTab == "page-details" && (
              <Button
                onClick={handlePreviewClick}
                disabled={isLoadingPreview}
                className="bg-yellow-500 text-black hover:bg-yellow-600 text-xs sm:text-sm whitespace-nowrap"
                data-cy="button-preview-page"
              >
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                {isLoadingPreview ? "Loading..." : "Preview Page"}
              </Button>
            )}
            {activeTab === "page-details" && initialPageData.page?.page_url && initialPageData.page?.is_published && (
              <Button
                onClick={() => {
                  const pageUrl = `/${initialPageData.page?.page_url}`;
                  window.open(pageUrl, "_blank");
                }}
                className="bg-yellow-500 text-black hover:bg-yellow-600 text-xs sm:text-sm whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                To: Home Page
              </Button>
            )}
          </div>
        </div>


        <div className="mt-4 sm:mt-6">
          {activeTab === "account" && (
            <MissionaryAccountBasicsTab
              missionary={missionary}
              pageId={initialPageData.page?.id ?? missionary.page?.id ?? null}
              onUpdateMissionary={async (missionaryId, data: UpdateMissionaryDetailsData, originalFirstName, originalLastName) => {
                return await updateCurrentMissionaryDetails(data, originalFirstName, originalLastName);
              }}
            />
          )}
          {activeTab === "page-details" && (
            <PageDetailsTab
              entity={memoizedEntity}
              organizationType="missionary"
              organizationId={missionary.id}
              missingFields={missingFields}
              onUnsavedChanges={setHasUnsavedChanges}
              initialPageData={memoizedPageData}
            />
          )}
          {activeTab === "donations" && (
            <MissionaryDonationsTab
              missionaryId={missionary.id}
              pageId={pageId}
              onGetDonations={async (pageId) => {
                return await getDonationsForCurrentUser(pageId);
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
          {activeTab === "messages" && (
            <MessagesSettingsTab
              missionaryId={missionary.id}
              currentUserId={missionary.user_id || ""}
              allowDirectMessages={missionary.allow_direct_messages ?? true}
            />
          )}
          {activeTab === "security" && (
            <MissionarySecurityTab />
          )}
          {activeTab === "social-media-connection" && (
            <SocialMediaConnectionTab
              missionaryPageId={initialPageData.page?.id ?? missionary.page?.id ?? null}
            />
          )}
        </div>
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

