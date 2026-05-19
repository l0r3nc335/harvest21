"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { resendActivationEmail as resendChurchInvite } from "@/app/admin/churches/actions";
import { resendActivationEmail as resendAgencyInvite, sendInviteToManagedAgency } from "@/app/admin/agencies/actions";
import { sendInviteToManagedChurch } from "@/app/admin/churches/actions";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { AccountBasicsTab } from "@/components/admin/shared/AccountBasicsTab";
import { PageDetailsTab } from "@/components/admin/shared/PageDetailsTab";
import { PageApprovalTab } from "@/components/admin/shared/PageApprovalTab";
import { EntityMissionariesTab } from "@/components/admin/shared/EntityMissionariesTab";
import { OrganizationInlinePreview } from "@/components/admin/shared/OrganizationInlinePreview";
import { ChurchPublicView } from "@/components/church/ChurchPublicView";
import { AgencyPublicView } from "@/components/agency/AgencyPublicView";
import { PreviewViewOnlyWrapper } from "@/components/PreviewViewOnlyWrapper";
import { ChurchFollowersTab } from "@/components/admin/churches/ChurchFollowersTab";
import { getOrganizationPreviewData, approveOrganizationPage } from "@/lib/organizationPreviewActions";
import { updateChurchStatus } from "@/app/admin/churches/[id]/actions";
import toast from "react-hot-toast";
import type { Missionary } from "@/types/missionary";
import type { PageDataWithRelations } from "@/lib/pageDataLoader";

type EntityType = "college" | "agency" | "church";

type EntityDetailData = {
  id: number;
  name: string;
  contact_user_id: string | null;
  email: string | null;
  phone_number: string | null;
  // Optional because not all entity types (e.g. colleges) currently have this field
  contact_person_phone_number?: string | null;
  address: string | null;
  city: string | null;
  state?: string | null;
  country: string | null;
  website: string | null;
  created_at: string;
  url?: string | null;
  contactUser: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string;
    phone_number?: string | null;
    url?: string | null;
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
  page_name?: string | null;
};

type EntityManagePageClientProps = {
  entity: EntityDetailData;
  type: EntityType;
  onUpdateEntity: (id: number, data: {
    name: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phoneNumber?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  onUpdateContact: (userId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    contactPersonPhoneNumber?: string;
    url?: string;
  }) => Promise<{ success: boolean; message?: string; data?: { first_name: string; last_name: string; email: string }; contactPersonPhoneNumber?: string | null }>;
  onFetchMissionaries: (entityId: number) => Promise<Missionary[]>;
  initialPageData: PageDataWithRelations;
  currentUserProfile?: UserProfile | null;
}

type TabType = "account-basics" | "page-details" | "missionaries" | "followers";

const getEntityPlural = (type: EntityType): string => {
  switch (type) {
    case "college":
      return "colleges";
    case "agency":
      return "agencies";
    case "church":
      return "churches";
    default:
      return "";
  }
};

type PreviewData = {
  organization: {
    id: number;
    name: string;
    is_managed_by_harvest21?: boolean;
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
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    destination_country?: string | null;
    country_of_residence: string | null;
    page_url: string;
    profile_photo_url: string | null;
    page_name?: string | null;
  }>;
  isApproved: boolean;
};

export function EntityManagePageClient({ 
  entity, 
  type,
  onUpdateEntity,
  onUpdateContact,
  onFetchMissionaries,
  initialPageData,
  currentUserProfile,
}: EntityManagePageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("account-basics");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Local state to track current status for immediate UI updates
  const getStatusFromEntity = (): "Pending Invite" | "Active" | "Inactive" => {
    const status = entity.contactUser?.status || "Pending";
    if (status === "Active") return "Active";
    if (status === "Pending" || status === "Pending Invite") return "Pending Invite";
    return "Inactive";
  };
  
  const [currentStatus, setCurrentStatus] = useState<"Pending Invite" | "Active" | "Inactive">(() => {
    const status = entity.contactUser?.status || "Pending";
    if (status === "Active") return "Active";
    if (status === "Pending" || status === "Pending Invite") return "Pending Invite";
    return "Inactive";
  });
  
  // Sync local status with entity prop when it changes
  useEffect(() => {
    const status = entity.contactUser?.status || "Pending";
    let newStatus: "Pending Invite" | "Active" | "Inactive";
    if (status === "Active") {
      newStatus = "Active";
    } else if (status === "Pending" || status === "Pending Invite") {
      newStatus = "Pending Invite";
    } else {
      newStatus = "Inactive";
    }
    setCurrentStatus(newStatus);
  }, [entity.contactUser?.status]);

  const tabs = type === "church" 
    ? [
        { id: "account-basics" as TabType, label: "Account Basics" },
        { id: "page-details" as TabType, label: "Page Details" },
        { id: "missionaries" as TabType, label: "Missionaries" },
        { id: "followers" as TabType, label: "Followers" },
      ]
    : [
        { id: "account-basics" as TabType, label: "Account Basics" },
        { id: "page-details" as TabType, label: "Page Details" },
        { id: "missionaries" as TabType, label: "Missionaries" },
      ];

  const entityPlural = getEntityPlural(type);
  const entityPath = `/admin/${entityPlural}`;

  const getStatusBadge = () => {
    // Use local state if available, otherwise fall back to entity prop
    return currentStatus;
  };

  const handlePreviewClick = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    
    try {
      const result = await getOrganizationPreviewData(type, entity.id);
      
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
  };

  const handleBackToSettings = () => {
    setIsPreviewMode(false);
    setPreviewData(null);
    setPreviewError(null);
  };

  const handlePublishPage = async () => {
    const pageId = initialPageData.page?.id;
    if (!pageId || (type !== "church" && type !== "agency" && type !== "college")) return;
    setIsPublishing(true);
    try {
      const result = await approveOrganizationPage(type, pageId);
      if (result.success) {
        toast.success(result.message || "Page published successfully");
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

  const handleResendInvite = async () => {
    if (!entity.contact_user_id) return;
    const toastId = toast.loading("Sending activation email...");
    try {
      const result = type === "church" 
        ? await resendChurchInvite(entity.id.toString())
        : await resendAgencyInvite(entity.id.toString());
      
      if (result.success) {
        toast.success(result.message || "Activation email sent", { id: toastId });
        router.refresh();
      } else {
        toast.error(result.message || "Failed to send activation email", { id: toastId });
      }
    } catch (error) {
      console.error("Error resending invite:", error);
      toast.error("An unexpected error occurred", { id: toastId });
    }
  };

  const handleStatusChange = async (newStatus: "Pending Invite" | "Active" | "Inactive") => {
    // Only allow status changes for churches
    if (type !== "church") {
      return;
    }

    // Don't update if it's the same status
    const currentStatus = getStatusBadge();
    if (currentStatus === newStatus) {
      return;
    }

    setIsUpdatingStatus(true);
    const toastId = toast.loading(`Updating status to ${newStatus}...`);

    try {
      const result = await updateChurchStatus(entity.id.toString(), newStatus);

      if (result.success) {
        // Update local state immediately for instant UI feedback
        setCurrentStatus(newStatus);
        toast.success(result.message || `Status updated to ${newStatus}`, { id: toastId });
        // Refresh the page to sync with server data
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update status", { id: toastId });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("An unexpected error occurred", { id: toastId });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // If in preview mode, show the preview component
  if (isPreviewMode && previewData) {
    if (type === "church") {
      return (
        <PreviewViewOnlyWrapper onBack={handleBackToSettings} backLabel="← Back">
          <ChurchPublicView
            church={{
              id: previewData.organization.id,
              name: previewData.organization.name,
              description: null,
              address: entity.address || null,
              city: entity.city || null,
              state: entity.state || null,
              country: entity.country || null,
              phone_number: entity.phone_number || null,
              website: entity.website || null,
              email: entity.email || null,
              contact_user_id: entity.contact_user_id,
              is_managed_by_harvest21: previewData.organization.is_managed_by_harvest21 ?? false,
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
            initialUserProfile={currentUserProfile}
            followerStatus="none"
            followerCount={0}
            isAdminPreview={true}
            viewOnlyWrapper={true}
          />
        </PreviewViewOnlyWrapper>
      );
    }

    if (type === "agency") {
      return (
        <PreviewViewOnlyWrapper onBack={handleBackToSettings} backLabel="← Back">
          <AgencyPublicView
            agency={{
              id: previewData.organization.id,
              name: previewData.organization.name,
              description: null,
              address: entity.address || null,
              city: entity.city || null,
              country: entity.country || null,
              phone_number: entity.phone_number || null,
              website: entity.website || null,
              email: entity.email || null,
              contact_user_id: entity.contact_user_id,
              is_managed_by_harvest21: previewData.organization.is_managed_by_harvest21 ?? false,
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
            initialUserProfile={currentUserProfile}
            isAdminPreview={true}
            viewOnlyWrapper={true}
          />
        </PreviewViewOnlyWrapper>
      );
    }

    return (
      <PreviewViewOnlyWrapper onBack={handleBackToSettings} backLabel="← Back">
        <OrganizationInlinePreview
          organization={previewData.organization}
          page={previewData.page}
          media={previewData.media}
          donations={previewData.donations}
          organizationType={type}
          onBack={handleBackToSettings}
          readOnly={true}
        />
      </PreviewViewOnlyWrapper>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Breadcrumbs */}
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-600">
        <Link href={entityPath} className="hover:text-zinc-900">
          {entityPlural.charAt(0).toUpperCase() + entityPlural.slice(1)}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-zinc-900">{entity.name}</span>
      </div>

      {/* Page Title and Actions */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{entity.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {type === "church" && (
            <Dropdown 
              label={getStatusBadge()} 
              selectedValue={getStatusBadge()}
            >
              <DropdownItem 
                onClick={() => !isUpdatingStatus && handleStatusChange("Pending Invite")}
              >
                Pending Invite
              </DropdownItem>
              <DropdownItem 
                onClick={() => !isUpdatingStatus && handleStatusChange("Active")}
              >
                Active
              </DropdownItem>
              <DropdownItem 
                onClick={() => !isUpdatingStatus && handleStatusChange("Inactive")}
              >
                Inactive
              </DropdownItem>
            </Dropdown>
          )}
          {(type === "church" || type === "agency") && entity.contact_user_id && (
            <Button 
              variant="secondary" 
              onClick={handleResendInvite}
              disabled={isUpdatingStatus}
            >
              Resend Invite
            </Button>
          )}
          {(type === "church" || type === "agency" || type === "college") && initialPageData.page?.id && (
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
          {initialPageData.page?.page_url && (
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
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-[#D3AF37] text-[#D3AF37]"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Preview Error Message */}
      {previewError && !isPreviewMode && (
        <div className="mb-6 p-6 bg-zinc-50 border border-zinc-200 rounded-lg">
          <p className="text-center text-zinc-400">{previewError}</p>
        </div>
      )}

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "account-basics" && (
          <AccountBasicsTab
            entity={entity}
            type={type}
            onUpdateEntity={onUpdateEntity}
            onUpdateContact={onUpdateContact}
            onSendInvite={entity.contact_user_id == null ? async (data) => {
              const result = type === "church" 
                ? await sendInviteToManagedChurch(entity.id, data)
                : await sendInviteToManagedAgency(entity.id, data);
              return result;
            } : undefined}
          />
        )}
        {activeTab === "page-details" && (
          <PageDetailsTab 
            entity={entity} 
            organizationType={type}
            organizationId={entity.id}
            initialPageData={{
              page: initialPageData.page,
              media: initialPageData.media,
              widgets: initialPageData.widgets,
            }}
            isPageOwner={false}
          />
        )}
        {activeTab === "missionaries" && (
          <EntityMissionariesTab
            entityId={entity.id}
            entityName={entity.name}
            entityType={type}
            onFetchMissionaries={onFetchMissionaries}
          />
        )}
        {activeTab === "followers" && type === "church" && (
          <ChurchFollowersTab churchId={entity.id} />
        )}
      </div>
    </div>
  );
}

