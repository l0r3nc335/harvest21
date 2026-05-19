"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SettingsSidebar } from "./SettingsSidebar";
import { AccountBasicsTab } from "@/components/admin/shared/AccountBasicsTab";
import { PageDetailsTab } from "@/components/admin/shared/PageDetailsTab";
import { MissionarySecurityTab } from "./MissionarySecurityTab";
import { ChurchFollowersTab } from "@/components/admin/churches/ChurchFollowersTab";
import { AgencyPublicView } from "@/components/agency/AgencyPublicView";
import { ChurchPublicView } from "@/components/church/ChurchPublicView";
import { OrganizationPublicView } from "@/components/organization/OrganizationPublicView";
import { PreviewViewOnlyWrapper } from "@/components/PreviewViewOnlyWrapper";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";
import {
  getPreviewDataForCurrentUser,
  publishPage,
  updateCurrentEntityInfo,
  updateCurrentContactInfo,
} from "@/app/settings/actions";
import { supabase } from "@/lib/supabaseClient";
import { deserializeTemplateContent } from "@/lib/templates/contentHelpers";
import toast from "react-hot-toast";

type OrganizationType = "agency" | "church" | "college" | "donor";

type EntityDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  contact_person_phone_number?: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state?: string | null;
  country: string | null;
  url?: string | null;
  created_at: string;
  contactUser: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string;
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
    is_published: boolean;
    is_review: boolean | null;
  } | null;
};

type InitialPageData = {
  page: {
    id: number;
    page_url: string;
    name: string | null;
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
  } | null;
  media: Array<{
    id: number;
    media_type: string;
    media_url: string;
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
  organization?: {
    id: number;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    phone_number?: string | null;
    website?: string | null;
  };
  missionary?: {
    id: number;
    first_name: string;
    last_name: string;
    biography?: string | null;
    country_of_residence?: string | null;
  };
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
    is_published: boolean;
    published_at: string | null;
    name?: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    created_at: string;
  }>;
  donations?: {
    totalPledged: number;
    totalReceived: number;
  };
  isApproved: boolean;
  /** Church/agency preview: all related missionaries (including unpublished) */
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    country_of_residence: string | null;
    page_url: string;
    profile_photo_url: string | null;
    page_name: string | null;
    is_published: boolean;
  }>;
};

type EntitySettingsClientProps = {
  entity: EntityDetailData;
  entityType: OrganizationType;
  initialPageData: InitialPageData;
  initialTab?: string;
  initialUnreadCount?: number;
};

type TabType = "account" | "page-details" | "followers" | "security";

export function EntitySettingsClient({
  entity,
  entityType,
  initialPageData,
  initialTab = "account",
  initialUnreadCount = 0,
}: EntitySettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || "account");
  
  // Sync activeTab with URL parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const validTabs = entityType === "church"
      ? ["account", "page-details", "followers", "security"]
      : ["account", "page-details", "security"];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams, entityType]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  const handlePreviewClick = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const result = await getPreviewDataForCurrentUser();

      if (result.success && result.data) {
        setPreviewData(result.data as PreviewData);
        setIsPreviewMode(true);
      } else {
        setPreviewError(result.error || "Failed to load preview data.");
      }
    } catch (error) {
      console.error("Error loading preview:", error);
      setPreviewError(
        "An unexpected error occurred while loading the preview."
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleBackToSettings = () => {
    setIsPreviewMode(false);
    setPreviewData(null);
    setPreviewError(null);
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

    // Profile Photo optional for agencies and churches (church has no profile photo)
    if (entityType !== "agency" && entityType !== "church") {
      if (!page?.profile_photo_url || page.profile_photo_url.trim() === "") {
        missingFieldNames.push("Profile Photo");
        missingFieldIds.add("profile_photo");
      }
    }

    // Banner Photo, Page name, Short Quote optional for agencies; Profile/Short Quote not required for church
    if (entityType !== "agency") {
      if (!page?.banner_photo_url || page.banner_photo_url.trim() === "") {
        missingFieldNames.push("Banner Photo");
        missingFieldIds.add("banner_photo");
      }

      if (!page?.name || page.name.trim() === "") {
        missingFieldNames.push("Page name");
        missingFieldIds.add("page_name");
      }

      if (entityType !== "church" && (!page?.short_quote || page.short_quote.trim() === "")) {
        missingFieldNames.push("Short Quote");
        missingFieldIds.add("short_quote");
      }
    }

    if (page?.template_content) {
      // Validate differently for churches/agencies vs missionaries
      if (entityType === "church" || entityType === "agency") {
        // About Us sections are optional for church/agency publish (not all visible on Page Details tab)
        // No validation of template_content sections; they can publish and complete later
      } else {
        // Missionaries use templates
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
      }
    } else {
      // About Us / template content optional for churches and agencies when not present
      if (entityType !== "church" && entityType !== "agency") {
        missingFieldNames.push("About You (template content)");
      }
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

  if (isPreviewMode && previewData) {
    const organization = previewData.organization || (previewData.missionary ? {
      id: previewData.missionary.id,
      name: `${previewData.missionary.first_name} ${previewData.missionary.last_name}`,
    } : { id: entity.id, name: entity.name });

    if (entityType === "agency") {
      return (
        <PreviewViewOnlyWrapper onBack={handleBackToSettings}>
          <AgencyPublicView
            agency={{
              id: organization.id,
              name: organization.name,
              description: null,
              address: entity.address ?? null,
              city: entity.city ?? null,
              country: entity.country ?? null,
              phone_number: entity.phone_number ?? null,
              website: entity.website ?? null,
              email: entity.email ?? null,
              is_managed_by_harvest21: (organization as { is_managed_by_harvest21?: boolean }).is_managed_by_harvest21 ?? false,
            }}
            page={{
              id: previewData.page.id,
              page_url: previewData.page.page_url,
              banner_photo_url: previewData.page.banner_photo_url,
              short_quote: previewData.page.short_quote,
              template_content: previewData.page.template_content,
              video_hashed_id: previewData.page.video_hashed_id,
              is_published: previewData.page.is_published,
            }}
            media={previewData.media}
            missionaries={previewData.missionaries ?? []}
            initialUserProfile={null}
            isAdminPreview={true}
            viewOnlyWrapper={true}
          />
        </PreviewViewOnlyWrapper>
      );
    }

    if (entityType === "church") {
      return (
        <PreviewViewOnlyWrapper onBack={handleBackToSettings}>
          <ChurchPublicView
            church={{
              id: organization.id,
              name: organization.name,
              description: null,
              address: organization.address ?? null,
              city: organization.city ?? null,
              state: organization.state ?? null,
              country: organization.country ?? null,
              phone_number: organization.phone_number ?? null,
              website: organization.website ?? null,
              email: null,
              is_managed_by_harvest21: (organization as { is_managed_by_harvest21?: boolean }).is_managed_by_harvest21 ?? false,
            }}
            page={{
              id: previewData.page.id,
              page_url: previewData.page.page_url,
              profile_photo_url: previewData.page.profile_photo_url,
              banner_photo_url: previewData.page.banner_photo_url,
              short_quote: previewData.page.short_quote,
              template_content: previewData.page.template_content,
              video_hashed_id: previewData.page.video_hashed_id,
              is_published: previewData.page.is_published,
            }}
            media={previewData.media}
            missionaries={previewData.missionaries ?? []}
            initialUserProfile={null}
            followerStatus="none"
            followerCount={0}
            isAdminPreview={true}
            isOwner={false}
            viewOnlyWrapper={true}
          />
        </PreviewViewOnlyWrapper>
      );
    }

    return (
      <PreviewViewOnlyWrapper onBack={handleBackToSettings}>
        <OrganizationPublicView
          organization={organization}
          organizationType={entityType}
          page={previewData.page}
          media={previewData.media}
          donations={previewData.donations}
          initialUserProfile={null}
          isAdminPreview={true}
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
        <Button
          onClick={handleBackToSettings}
          variant="secondary"
          className="text-xs sm:text-sm"
        >
          Back to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black overflow-hidden">
      <SettingsSidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
        onLogout={handleLogout}
        mobileRightSlot={<NotificationDropdown unreadCount={initialUnreadCount} variant="mobile" />}
        items={[
          { id: "account", label: "Account" },
          { id: "page-details", label: "Page Details" },
          ...(entityType === "church" ? [{ id: "followers" as const, label: "Followers" }] : []),
          { id: "security", label: "Security" },
        ]}
      />

      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 mt-12 lg:mt-0 lg:ml-64 lg:pt-6 overflow-y-auto h-screen">
        <div className="hidden lg:flex flex-row items-center justify-end w-full">
          <NotificationDropdown unreadCount={initialUnreadCount} variant="desktop" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
              {entity.name}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Manage your {entityType} settings
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {activeTab === "page-details" && !initialPageData.page?.is_published && (
              <Button
                onClick={handlePublishPage}
                disabled={isPublishing}
                variant="secondary"
                className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 text-xs sm:text-sm whitespace-nowrap"
              >
                {isPublishing ? "Publishing..." : "Publish Page"}
              </Button>
            )}
            {activeTab == "page-details" && (
            <Button
              onClick={handlePreviewClick}
              disabled={isLoadingPreview}
              className="bg-yellow-500 text-black hover:bg-yellow-600 text-xs sm:text-sm whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              {isLoadingPreview ? "Loading..." : "Preview Page"}
            </Button> )}
            {activeTab === "page-details" && (entityType === "church" || entityType === "agency" || entityType === "college") && initialPageData.page?.page_url && initialPageData.page?.is_published && (
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
            <AccountBasicsTab
              entity={entity}
              type={entityType}
              onUpdateEntity={async (id, data) => {
                return await updateCurrentEntityInfo(data);
              }}
              onUpdateContact={async (userId, data) => {
                return await updateCurrentContactInfo(data);
              }}
            />
          )}
          {activeTab === "page-details" && (
            <PageDetailsTab
              entity={{ id: entity.id, name: entity.name }}
              organizationType={entityType}
              organizationId={entity.id}
              missingFields={missingFields}
              initialPageData={{
                page: initialPageData.page,
                media: initialPageData.media,
                widgets: initialPageData.widgets,
              }}
            />
          )}
          {activeTab === "followers" && entityType === "church" && (
            <ChurchFollowersTab churchId={entity.id} />
          )}
          {activeTab === "security" && <MissionarySecurityTab />}
        </div>
      </div>
    </div>
  );
}
