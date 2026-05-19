"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { ArrowLeft, CheckCircle, ExternalLink, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import { ImageCropper } from "@/components/admin/ImageCropper";
import toast from "react-hot-toast";
import { approveMissionaryPage } from "@/app/[page_url]/actions";
import { PrayerWall } from "@/components/prayer/PrayerWall";
import { VideosWall } from "@/components/video/VideosWall";
import { PhotosWall } from "@/components/photo/PhotosWall";
import { UpdateLettersWall } from "@/components/update-letter/UpdateLettersWall";
import { getCountryByName, getCountryByCode, getCountryFlag } from "@/lib/countries";
import { updateMissionaryPhoto, uploadFileToStorage } from "@/app/admin/missionaries/[id]/actions";
import { TemplateRenderer } from "@/components/templates";
import { deserializeTemplateContent } from "@/lib/templates/contentHelpers";
import { getTemplate, getDefaultTemplate } from "@/lib/templates";
import { Footer } from "@/components/Footer";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";
import { Modal } from "@/components/ui/Modal";
import { FollowButton } from "@/components/missionary/FollowButton";
import { FollowGate } from "@/components/missionary/FollowGate";
import { MissionaryContentEngagementOnVisit } from "@/components/missionary/MissionaryContentEngagementOnVisit";
import { LoginModal } from "@/components/auth/LoginModal";
import { DirectMessageButton } from "@/components/messaging/DirectMessageButton";
import type { FollowerStatus } from "@/types/follow";
import { RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";

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

type MissionaryPublicViewProps = {
  missionary: {
    id: number;
    first_name: string;
    last_name: string;
    destination_country: string | null;
    user_id?: string | null;
    is_managed_by_harvest21?: boolean;
    allow_direct_messages?: boolean;
    open_to_visits?: boolean;
    visits_start_date?: string | null;
    visits_end_date?: string | null;
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
    template_content: string | null;
    video_hashed_id: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    published_at: string | null;
    donation_mode?: "harvest21" | "external" | "off" | null;
    external_donation_url?: string | null;
    page_template?: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    description?: string | null;
    thumbnail_url?: string | null;
    created_at: string;
  }>;
  widgets?: Array<{
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
  isAdminPreview?: boolean;
  onBack?: () => void;
  initialUserProfile?: UserProfile | null;
  isLoading?: boolean;
  isOwner?: boolean;
  readOnly?: boolean;
  followerStatus?: FollowerStatus;
};

type TabType = "about" | "update-letters" | "photos" | "videos" | "prayer-wall";

export function MissionaryPublicView({
  missionary,
  page,
  media,
  widgets = [],
  donations,
  isAdminPreview = false,
  onBack,
  initialUserProfile = null,
  isLoading = false,
  isOwner: isOwnerProp = false,
  readOnly = false,
  followerStatus = "none",
}: MissionaryPublicViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  
  // Read tab from URL query params on mount and when it changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["about", "update-letters", "photos", "videos", "prayer-wall"].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
      // Scroll to tabs section after a brief delay to ensure DOM is ready
      setTimeout(() => {
        const tabsElement = document.querySelector('[data-tabs-section]');
        if (tabsElement) {
          tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [searchParams]);

  const focusParam = searchParams.get("focus") || "";
  const focusMediaId = focusParam.match(/^page_media-(\d+)$/)?.[1];
  const focusPrayerId = focusParam.match(/^prayers-(\d+)$/)?.[1];
  const focusWidgetId = focusParam.match(/^page_widgets-(\d+)$/)?.[1];

  const updateFocusUrl = useCallback((tab: string, focus: string | null) => {
    const url = new URL(window.location.href);
    if (focus) {
      url.searchParams.set("tab", tab);
      url.searchParams.set("focus", focus);
    } else {
      url.searchParams.delete("tab");
      url.searchParams.delete("focus");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  const [isApproving, setIsApproving] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isExternalDonateModalOpen, setIsExternalDonateModalOpen] = useState(false);
  const [isOpenToVisitsModalOpen, setIsOpenToVisitsModalOpen] = useState(false);

  const donationMode = page.donation_mode ?? "off";
  const externalDonationUrl = page.external_donation_url ?? "";
  const isManagedByHarvest21 = missionary.is_managed_by_harvest21 === true;
  const showDonateButton = !isLoading && (isManagedByHarvest21 || donationMode === "harvest21" || donationMode === "external");
  const donateButtonDisabled = readOnly || isManagedByHarvest21;
  const donateButtonClassName = donateButtonDisabled
    ? "rounded-full border-2 lg:border border-gray-400 bg-gray-400 text-gray-600 cursor-not-allowed opacity-60 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold shadow-lg lg:shadow-sm transition-all"
    : "rounded-full border-2 lg:border border-[#E1B94D] lg:border-white/20 bg-black px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white lg:text-[#f5f5f5] shadow-lg lg:shadow-sm hover:bg-[#E1B94D] hover:text-black lg:hover:bg-black lg:hover:border-[#E1B94D]/50 lg:hover:text-[#E1B94D] transition-all hover:scale-105 lg:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white disabled:hover:scale-100";
  const [currentFollowerStatus, setCurrentFollowerStatus] = useState<FollowerStatus>(followerStatus);
  const isOwner = readOnly ? false : isOwnerProp;
  const isActualAdmin = initialUserProfile?.role === 1 || initialUserProfile?.role === 2;
  const showAdminControls = isAdminPreview && isActualAdmin;
  const canAdminManageLetters = isManagedByHarvest21 && isActualAdmin;
  const isLoggedIn = !!initialUserProfile;
  const isCurrentlyFollowing = currentFollowerStatus === "accepted";
  const canViewRestrictedContent = isOwner || isCurrentlyFollowing || isAdminPreview;
  
  console.log("MissionaryPublicView DEBUG:", {
    readOnly,
    isAdminPreview,
    isOwner,
    hasOnBack: !!onBack,
    isPublished: page.is_published,
    userRole: initialUserProfile?.role,
    isActualAdmin,
    showAdminControls
  });
  
  console.log("MissionaryPublicView CHURCH DEBUG:", {
    hasChurch: !!missionary.church,
    churchData: missionary.church,
    missionaryId: missionary.id
  });
  
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperType, setCropperType] = useState<"profile" | "banner" | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(page.profile_photo_url || "");
  const [bannerPhotoUrl, setBannerPhotoUrl] = useState(page.banner_photo_url || "");
  
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const bannerPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleContentUpdate = () => {
      router.refresh();
    };

    window.addEventListener("content-updated", handleContentUpdate);

    return () => {
      window.removeEventListener("content-updated", handleContentUpdate);
    };
  }, [router]);

  useEffect(() => {
    setProfilePhotoUrl(page.profile_photo_url || "");
    setBannerPhotoUrl(page.banner_photo_url || "");
  }, [page.profile_photo_url, page.banner_photo_url]);

  const handleFileSelect = (file: File, type: "profile" | "banner") => {
    setCropperFile(file);
    setCropperType(type);
    setShowImageCropper(true);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!cropperFile || !cropperType) {
      return;
    }

    const fileExtension = cropperFile.name.split(".").pop() || "jpg";
    const fileName = `cropped-${cropperType}-${Date.now()}.${fileExtension}`;
    const croppedFile = new File([croppedBlob], fileName, {
      type: croppedBlob.type || "image/jpeg",
    });

    setShowImageCropper(false);
    setCropperFile(null);
    setCropperType(null);

    await handleFileUpload(croppedFile, cropperType);
  };

  const handleFileUpload = async (file: File, type: "profile" | "banner") => {
    if (!missionary.id) {
      toast.error("Missionary ID not found");
      return;
    }

    try {
      if (type === "profile") {
        setUploadingProfile(true);
      } else if (type === "banner") {
        setUploadingBanner(true);
      }

      let existingUrl: string | null = null;
      if (type === "profile") {
        existingUrl = profilePhotoUrl || null;
      } else if (type === "banner") {
        existingUrl = bannerPhotoUrl || null;
      }

      const result = await uploadFileToStorage(
        "missionaries",
        missionary.id,
        type,
        file,
        existingUrl
      );

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || "Failed to upload file");
      }

      const publicUrl = result.publicUrl;

      if (type === "profile") {
        const dbResult = await updateMissionaryPhoto(missionary.id, "profile", publicUrl);
        if (dbResult.success) {
          setProfilePhotoUrl(publicUrl);
          toast.success("Profile photo uploaded successfully!");
          router.refresh();
        } else {
          throw new Error(dbResult.message || "Failed to update profile photo");
        }
      } else if (type === "banner") {
        const dbResult = await updateMissionaryPhoto(missionary.id, "banner", publicUrl);
        if (dbResult.success) {
          setBannerPhotoUrl(publicUrl);
          toast.success("Banner photo uploaded successfully!");
          router.refresh();
        } else {
          throw new Error(dbResult.message || "Failed to update banner photo");
        }
      }
    } catch (error: unknown) {
      console.error("Error uploading file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploadingProfile(false);
      setUploadingBanner(false);
    }
  };
  
  // Support Percentage: always use the manual value from page details
  const supportPercentageRaw = Math.min(
    100,
    Math.max(
      0,
      page.donation_percentage !== null && page.donation_percentage !== undefined
        ? page.donation_percentage
        : 0
    )
  );
  const supportPercentage = Math.round(supportPercentageRaw);
  
  const totalReceived = donations?.totalReceived || 0;
  const missionaryName = isLoading ? "" : (page.name || `${missionary.first_name} ${missionary.last_name}`);
  const agencyName = isLoading ? "" : (missionary.agency?.name || "Independent");
  const isPublished = isLoading ? false : page.is_published;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveMissionaryPage(page.id);
      if (result.success) {
        toast.success(result.message || "Page approved and published!");
        // If in admin preview mode with onBack callback, go back to settings
        if (isAdminPreview && onBack) {
          onBack();
        } else if (isAdminPreview) {
          // Otherwise navigate to admin page
          router.push(`/admin/missionaries/${missionary.id}`);
        } else {
          // Public view: just refresh
          router.refresh();
        }
      } else {
        toast.error(result.message || "Failed to approve page");
        setIsApproving(false);
      }
    } catch (error) {
      console.error("Error approving page:", error);
      toast.error("Failed to approve page");
      setIsApproving(false);
    }
  };


  const images = media.filter((m) => m.media_type === "image");
  const videos = media.filter((m) => m.media_type === "video");

  return (
    <>
      <MissionaryContentEngagementOnVisit
        pageId={page.id}
        enabled={
          !isAdminPreview &&
          !readOnly &&
          !isOwner &&
          isLoggedIn &&
          currentFollowerStatus === "accepted"
        }
      />
      <div className="min-h-screen w-full bg-black text-[#f5f5f5] missionary-public-view overflow-x-hidden overflow-y-visible">
        {!isAdminPreview && <Navbar initialUserProfile={initialUserProfile} readOnly={readOnly} />}
        
        <div className={isAdminPreview ? "mx-auto" : "mt-16 mx-auto"}>
        {/* Warning Banner for Admin Preview (only if not published and not loading) */}
        {isAdminPreview && !isPublished && !isLoading && (
          <div className="bg-yellow-500/15 border-b border-yellow-500/40 px-6 py-2 text-center text-sm text-yellow-100">
            <p>
              This page isn&apos;t published yet. Only admins can see this preview.
            </p>
          </div>
        )}

        {/* Top Banner Section */}
        <div className="relative w-full overflow-hidden bg-linear-to-b from-[#E1B94D] to-black">
        {/* Banner Image Container - Fixed Height with Responsive Breakpoints */}
        <div className="relative h-[280px] sm:h-[300px] md:h-[380px] lg:h-[450px] w-full" >
          {isLoading ? (
            <div className="absolute inset-0 bg-linear-to-b from-[#E1B94D] to-black">
              <div className="absolute inset-0 bg-shimmer animate-shimmer" />
            </div>
          ) : (
            <>
              {uploadingBanner && (
                <div className="absolute inset-0 z-20 flex items-center justify-center shadow-none">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E1B94D] border-t-transparent" />
                    <span className="text-sm text-white drop-shadow-lg">Uploading banner...</span>
                  </div>
                </div>
              )}
              {bannerPhotoUrl ? (
                <Image
                  src={bannerPhotoUrl}
                  alt="Banner"
                  fill
                  className="object-cover object-center"
                  sizes="100vw"
                  priority
                />
              ) : (
                <div className="absolute inset-0 bg-linear-to-b from-[#E1B94D] to-black" />
              )}
            </>
          )}
          {/* Gradient only at bottom for text readability; rest of banner shows at full brightness */}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.25)_45%,transparent_70%)]" />
        </div>

        {/* Note: Admin preview navigation (Back to Settings / Approve / View Public Page)
            is handled by the surrounding admin UI. We intentionally do not render
            duplicate controls here to keep the preview clean. */}

        {!isLoading && !isAdminPreview && !isPublished && (
          <div className="absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/80 px-5 py-2 text-sm text-white shadow-lg">
            Your page is not yet published.
          </div>
        )}

        {/* Set Banner Photo Button (only in admin preview or owner, not in readOnly mode) */}
        {!isLoading && (isAdminPreview) && !readOnly && !bannerPhotoUrl && !uploadingBanner && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <input
              ref={bannerPhotoInputRef}
              type="file"
              accept={RASTER_IMAGE_INPUT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, "banner");
                if (e.target) {
                  e.target.value = "";
                }
              }}
              disabled={uploadingBanner}
            />
            {/* <Button
              variant="secondary"
              size="sm"
              onClick={() => bannerPhotoInputRef.current?.click()}
              disabled={uploadingBanner}
              className="pointer-events-auto bg-black/60 text-[#f5f5f5] border border-white/20 hover:bg-black/70"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Banner Photo
            </Button> */}
          </div>
        )}
        {!isLoading && (isAdminPreview || isOwner) && !readOnly && bannerPhotoUrl && !uploadingBanner && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <input
              ref={bannerPhotoInputRef}
              type="file"
              accept={RASTER_IMAGE_INPUT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, "banner");
                if (e.target) {
                  e.target.value = "";
                }
              }}
              disabled={uploadingBanner}
            />
            {/* <Button
              variant="secondary"
              size="sm"
              onClick={() => bannerPhotoInputRef.current?.click()}
              disabled={uploadingBanner}
              className="pointer-events-auto bg-black/60 text-[#f5f5f5] border border-white/20 hover:bg-black/70"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Banner Photo
            </Button> */}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w px-4 lg:px-5 pb-0">
        {/* Profile Card Section - Separate Row */}
        <div className="relative z-10 -mt-32 sm:-mt-36 md:-mt-40 lg:-mt-56 w-full">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-start items-center lg:gap-12">
            {/* Profile Card - Desktop: white card, Mobile: transparent with circular photo */}
            <div className="w-full max-w-xs lg:rounded-2xl lg:bg-white lg:p-4 text-center lg:text-start lg:text-zinc-900 text-white lg:shadow-[0_25px_70px_-35px_rgba(0,0,0,0.8)]">
              {/* Profile Photo */}
              <div className="group relative mb-4 lg:mb-6 w-full overflow-hidden lg:rounded-2xl shadow-lg">
                {/* Mobile: Circular, Desktop: Square */}
                <div className="relative w-52 h-52 lg:w-full lg:h-0 lg:pb-[100%] mx-auto lg:mx-0 overflow-hidden rounded-full lg:rounded-2xl border-4 lg:border border-black lg:border-black/5 bg-zinc-800 lg:bg-zinc-200 shadow-2xl lg:shadow-none">
                  {isLoading ? (
                    <div className="absolute inset-0 bg-shimmer animate-shimmer rounded-full lg:rounded-2xl" />
                  ) : (
                    <>
                      {uploadingProfile && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-full lg:rounded-2xl">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E1B94D] border-t-transparent" />
                            <span className="text-xs text-white">Uploading...</span>
                          </div>
                        </div>
                      )}
                      <MissionaryProfileImage
                        src={profilePhotoUrl}
                        alt={missionaryName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 208px, 320px"
                      />
                      {(isAdminPreview || isOwner) && !readOnly && !uploadingProfile && (
                        <div className="absolute inset-0 flex items-center justify-center   z-10">
                          {/* <Button
                            variant="secondary"
                            size="sm"
                            className="bg-[#E1B94D] text-black hover:bg-[#d4a639] text-xs lg:text-sm px-2 lg:px-4 py-1 lg:py-2"
                            onClick={() => profilePhotoInputRef.current?.click()}
                            disabled={uploadingProfile}
                          >
                            <Upload className="mr-1 lg:mr-2 h-3 lg:h-4 w-3 lg:w-4" />
                            <span className="hidden lg:inline">Upload Photo</span>
                            <span className="lg:hidden">Edit</span>
                          </Button> */}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Missionary Name */}
              <div className="space-y-2">
                {isLoading ? (
                  <>
                    <div className="h-8 w-48 bg-zinc-800 rounded-lg mx-auto lg:mx-0">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                    <div className="h-5 w-36 bg-zinc-800 rounded-lg mx-auto lg:mx-0">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-row gap-2 justify-center lg:justify-between items-center">
                      <h1 className="text-2xl lg:text-xl font-bold lg:font-semibold">{missionaryName}</h1>
                      {missionary.destination_country && (() => {
                        const country = getCountryByCode(missionary.destination_country) || getCountryByName(missionary.destination_country);
                        const countryCode = country?.code?.toLowerCase();
                        return countryCode && country ? (
                          <div className="relative h-6 w-6 lg:h-8 lg:w-8 overflow-hidden rounded-full border-2 border-white/20 lg:border-zinc-300 shadow-lg shrink-0">
                            <Image
                              src={`https://flagcdn.com/w80/${countryCode}.png`}
                              alt={country.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <span className="text-xl lg:text-lg">{getCountryFlag(missionary.destination_country)}</span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <p className="text-sm text-zinc-400 lg:text-zinc-500">{agencyName}</p>
                    </div>
                    {page.short_quote && (
                      <p className="text-sm italic text-zinc-300 lg:text-zinc-600 px-4 lg:px-0">&ldquo;{page.short_quote}&rdquo;</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Church Info Section - Between Card and Support */}
            {isLoading ? (
              <div className="flex flex-1 flex-col gap-3 w-full lg:w-auto mt-6 lg:mt-0">
                <div className="h-7 w-48 bg-zinc-800 rounded-lg mx-auto lg:mx-0">
                  <div className="h-full w-full bg-shimmer animate-shimmer" />
                </div>
                <div className="flex items-center justify-center lg:items-start gap-2 lg:gap-3">
                  <div className="h-16 w-20 bg-zinc-800 rounded-lg">
                    <div className="h-full w-full bg-shimmer animate-shimmer" />
                  </div>
                  <div className="h-10 w-24 bg-zinc-800 rounded-lg">
                    <div className="h-full w-full bg-shimmer animate-shimmer" />
                  </div>
                </div>
                <div className="h-2.5 lg:h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-shimmer animate-shimmer" />
                </div>
                <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-3 w-full lg:w-auto mt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 w-24 bg-zinc-800 rounded-full">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {missionary.church && isManagedByHarvest21 && (
                  <div className="flex flex-1 flex-col gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="flex flex-row flex-wrap items-center justify-center lg:justify-start gap-2 lg:gap-3">
                      <h2 className="text-lg lg:text-2xl font-semibold lg:font-bold text-white text-center lg:text-left">{missionary.church.name}</h2>
                      <span
                        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 shrink-0"
                        role="status"
                        aria-label="Managed by Harvest21"
                      >
                        <Shield className="h-5 w-4 shrink-0 text-[#E1B94D]" aria-hidden />
                        <span className="text-sm font-medium text-zinc-400">Managed by</span>
                        <span className="flex items-center shrink-0">
                          <Image src="/icon.svg" alt="Harvest21" width={100} height={51} className="h-5 w-auto" />
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-4 lg:flex-wrap mt-2">
                      <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-3 w-full lg:w-auto">
                        <FollowButton
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          initialStatus={currentFollowerStatus}
                          onAuthRequired={() => setIsLoginModalOpen(true)}
                          onStatusChange={(newStatus) => setCurrentFollowerStatus(newStatus)}
                          variant="page"
                          isOwner={isOwner}
                          userRole={initialUserProfile?.role}
                          disabled
                        />
                        <DirectMessageButton
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          followerStatus={currentFollowerStatus}
                          allowDirectMessages={missionary.allow_direct_messages ?? true}
                          onAuthRequired={() => setIsLoginModalOpen(true)}
                          variant="page"
                          disabled
                        />
                        <Button
                          variant="secondary"
                          disabled={readOnly}
                          className="rounded-full border-2 lg:border border-[#E1B94D] lg:border-white/20 bg-black px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white lg:text-[#f5f5f5] shadow-lg lg:shadow-sm hover:bg-[#E1B94D] hover:text-black lg:hover:bg-black lg:hover:border-[#E1B94D]/50 lg:hover:text-[#E1B94D] transition-all hover:scale-105 lg:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white disabled:hover:scale-100"
                          onClick={() => {
                            if (!readOnly && typeof window !== "undefined") {
                              const url = `${window.location.origin}/${page.page_url}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Link copied to clipboard!");
                            }
                          }}
                        >
                          Tell Others
                        </Button>
                        {showDonateButton && (
                          <Button
                            variant="secondary"
                            disabled={donateButtonDisabled}
                            className={donateButtonClassName}
                            onClick={() => {
                              if (donateButtonDisabled) return;
                              if (donationMode === "harvest21") {
                                router.push(`/donate?page_id=${page.id}`);
                              } else if (donationMode === "external" && externalDonationUrl) {
                                setIsExternalDonateModalOpen(true);
                              }
                            }}
                          >
                            Donate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {missionary.church && !isManagedByHarvest21 && (
                  <div className="flex flex-1 flex-col gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-2 lg:gap-4">
                    <h2 className="text-lg lg:text-2xl font-semibold lg:font-bold text-white text-center lg:text-left w-full lg:w-auto">{missionary.church.name}</h2>
                      <div className="flex items-center justify-center lg:justify-end gap-2 lg:gap-3 w-full lg:w-auto lg:shrink-0 lg:ml-auto">
                        <span className="text-xl lg:text-3xl font-bold text-[#60a5fa]">
                          {supportPercentage}%
                        </span>
                        <div className="flex flex-row justify-center items-center lg:justify-start lg:flex-col text-md lg:text-md font-semibold lg:font-medium text-white uppercase lg:normal-case tracking-wide">
                          <span>Support Level</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-2.5 lg:h-3 w-full overflow-hidden rounded-full bg-zinc-800 lg:bg-[#e5e5e5]">
                      <div
                        className="h-full rounded-full bg-[#60a5fa] transition-all duration-700 lg:duration-500"
                        style={{ width: `${supportPercentage}%` }}
                      />
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-4 lg:flex-wrap mt-2">
                      <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-3 w-full lg:w-auto">
                        <FollowButton
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          initialStatus={currentFollowerStatus}
                          onAuthRequired={() => setIsLoginModalOpen(true)}
                          onStatusChange={(newStatus) => setCurrentFollowerStatus(newStatus)}
                          variant="page"
                          isOwner={isOwner}
                          userRole={initialUserProfile?.role}
                        />
                        {!isOwner && (
                          <DirectMessageButton
                            missionaryId={missionary.id}
                            missionaryName={missionaryName}
                            isLoggedIn={isLoggedIn}
                            followerStatus={currentFollowerStatus}
                            allowDirectMessages={missionary.allow_direct_messages ?? true}
                            onAuthRequired={() => setIsLoginModalOpen(true)}
                            variant="page"
                          />
                        )}
                        <Button
                          variant="secondary"
                          disabled={readOnly}
                          className="rounded-full border-2 lg:border border-[#E1B94D] lg:border-white/20 bg-black px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white lg:text-[#f5f5f5] shadow-lg lg:shadow-sm hover:bg-[#E1B94D] hover:text-black lg:hover:bg-black lg:hover:border-[#E1B94D]/50 lg:hover:text-[#E1B94D] transition-all hover:scale-105 lg:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white disabled:hover:scale-100"
                          onClick={() => {
                            if (!readOnly && typeof window !== "undefined") {
                              const url = `${window.location.origin}/${page.page_url}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Link copied to clipboard!");
                            }
                          }}
                        >
                          Tell Others
                        </Button>
                        {showDonateButton && (
                          <Button
                            variant="secondary"
                            disabled={donateButtonDisabled}
                            className={donateButtonClassName}
                            onClick={() => {
                              if (donateButtonDisabled) return;
                              if (donationMode === "harvest21") {
                                router.push(`/donate?page_id=${page.id}`);
                              } else if (donationMode === "external" && externalDonationUrl) {
                                setIsExternalDonateModalOpen(true);
                              }
                            }}
                          >
                            Donate
                          </Button>
                        )}
                        {missionary.open_to_visits && missionary.visits_start_date && missionary.visits_end_date && (
                          <Button
                            variant="secondary"
                            className="rounded-full border-2 lg:border border-emerald-600 bg-emerald-600 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white shadow-lg lg:shadow-sm hover:bg-emerald-500 hover:border-emerald-500 transition-all min-h-[44px] touch-manipulation"
                            onClick={() => setIsOpenToVisitsModalOpen(true)}
                            aria-label="Open to visits. Click to see availability dates"
                          >
                            Open to Visits
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!missionary.church && isManagedByHarvest21 && (
                  <div className="flex flex-1 flex-col gap-4 lg:gap-6 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-3 w-full lg:w-auto">
                      <FollowButton
                        missionaryId={missionary.id}
                        missionaryName={missionaryName}
                        isLoggedIn={isLoggedIn}
                        initialStatus={currentFollowerStatus}
                        onAuthRequired={() => setIsLoginModalOpen(true)}
                        onStatusChange={(newStatus) => setCurrentFollowerStatus(newStatus)}
                        variant="page"
                        isOwner={isOwner}
                        userRole={initialUserProfile?.role}
                        disabled
                      />
                      <DirectMessageButton
                        missionaryId={missionary.id}
                        missionaryName={missionaryName}
                        isLoggedIn={isLoggedIn}
                        followerStatus={currentFollowerStatus}
                        allowDirectMessages={missionary.allow_direct_messages ?? true}
                        onAuthRequired={() => setIsLoginModalOpen(true)}
                        variant="page"
                        disabled
                      />
                      <Button
                        variant="secondary"
                        disabled={readOnly}
                        className="rounded-full border-2 lg:border border-[#E1B94D] lg:border-white/20 bg-black px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white lg:text-[#f5f5f5] shadow-lg lg:shadow-sm hover:bg-[#E1B94D] hover:text-black lg:hover:bg-black lg:hover:border-[#E1B94D]/50 lg:hover:text-[#E1B94D] transition-all hover:scale-105 lg:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white disabled:hover:scale-100"
                        onClick={() => {
                          if (!readOnly && typeof window !== "undefined") {
                            const url = `${window.location.origin}/${page.page_url}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied to clipboard!");
                          }
                        }}
                      >
                        Tell Others
                      </Button>
                      {showDonateButton && (
                        <Button
                          variant="secondary"
                          disabled={donateButtonDisabled}
                          className={donateButtonClassName}
                          onClick={() => {
                            if (donateButtonDisabled) return;
                            if (donationMode === "harvest21") {
                              router.push(`/donate?page_id=${page.id}`);
                            } else if (donationMode === "external" && externalDonationUrl) {
                              setIsExternalDonateModalOpen(true);
                            }
                          }}
                        >
                          Donate
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!missionary.church && !isManagedByHarvest21 && (
                  <div className="flex flex-1 flex-col gap-4 lg:gap-6 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="space-y-3">
                    <div className="flex items-center justify-center lg:justify-end gap-2 lg:gap-3 lg:shrink-0 lg:ml-auto">
                    <span className="text-xl lg:text-3xl font-bold text-[#60a5fa]">
                      {supportPercentage}%
                        </span>
                        <div className="flex flex-row justify-center items-center lg:justify-start lg:flex-col text-md lg:text-md font-semibold lg:font-medium text-white uppercase lg:normal-case tracking-wide">
                          <span>Support Level</span>
                        </div>
                      </div>
                      <div className="h-2.5 lg:h-3 w-full overflow-hidden rounded-full bg-zinc-800 lg:bg-[#e5e5e5]">
                        <div
                          className="h-full rounded-full bg-[#60a5fa] transition-all duration-700 lg:duration-500"
                          style={{ width: `${supportPercentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-4 lg:flex-wrap">
                      {totalReceived > 0 && (
                        <p className="text-xs text-center lg:text-right text-zinc-500 lg:text-zinc-400 lg:ml-auto">
                          ${totalReceived.toLocaleString()} received
                        </p>
                      )}
                      <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-3 w-full lg:w-auto">
                        <FollowButton
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          initialStatus={currentFollowerStatus}
                          onAuthRequired={() => setIsLoginModalOpen(true)}
                          onStatusChange={(newStatus) => setCurrentFollowerStatus(newStatus)}
                          variant="page"
                          isOwner={isOwner}
                          userRole={initialUserProfile?.role}
                        />
                        {!isOwner && (
                          <DirectMessageButton
                            missionaryId={missionary.id}
                            missionaryName={missionaryName}
                            isLoggedIn={isLoggedIn}
                            followerStatus={currentFollowerStatus}
                            allowDirectMessages={missionary.allow_direct_messages ?? true}
                            onAuthRequired={() => setIsLoginModalOpen(true)}
                            variant="page"
                          />
                        )}
                        <Button
                          variant="secondary"
                          disabled={readOnly}
                          className="rounded-full border-2 lg:border border-[#E1B94D] lg:border-white/20 bg-black px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white lg:text-[#f5f5f5] shadow-lg lg:shadow-sm hover:bg-[#E1B94D] hover:text-black lg:hover:bg-black lg:hover:border-[#E1B94D]/50 lg:hover:text-[#E1B94D] transition-all hover:scale-105 lg:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white disabled:hover:scale-100"
                          onClick={() => {
                            if (!readOnly && typeof window !== "undefined") {
                              const url = `${window.location.origin}/${page.page_url}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Link copied to clipboard!");
                            }
                          }}
                        >
                          Tell Others
                        </Button>
                        {showDonateButton && (
                          <Button
                            variant="secondary"
                            disabled={donateButtonDisabled}
                            className={donateButtonClassName}
                            onClick={() => {
                              if (donateButtonDisabled) return;
                              if (donationMode === "harvest21") {
                                router.push(`/donate?page_id=${page.id}`);
                              } else if (donationMode === "external" && externalDonationUrl) {
                                setIsExternalDonateModalOpen(true);
                              }
                            }}
                          >
                            Donate
                          </Button>
                        )}
                        {missionary.open_to_visits && missionary.visits_start_date && missionary.visits_end_date && (
                          <Button
                            variant="secondary"
                            className="rounded-full border-2 lg:border border-emerald-600 bg-emerald-600 px-5 lg:px-6 py-2.5 lg:py-2 text-sm font-bold lg:font-semibold text-white shadow-lg lg:shadow-sm hover:bg-emerald-500 hover:border-emerald-500 transition-all min-h-[44px] touch-manipulation"
                            onClick={() => setIsOpenToVisitsModalOpen(true)}
                            aria-label="Open to visits. Click to see availability dates"
                          >
                            Open to Visits
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <Modal
          isOpen={isOpenToVisitsModalOpen}
          onClose={() => setIsOpenToVisitsModalOpen(false)}
          title="Open to Visits"
          variant="dark"
          size="sm"
        >
          <p className="text-sm text-zinc-300">
            {missionary.visits_start_date && missionary.visits_end_date
              ? `Available for visits: ${new Date(missionary.visits_start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(missionary.visits_end_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
              : "This missionary is open to visits."}
          </p>
          <div className="mt-8 flex justify-end">
            <Button variant="secondary" onClick={() => setIsOpenToVisitsModalOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>

        <Modal
          isOpen={isExternalDonateModalOpen}
          onClose={() => setIsExternalDonateModalOpen(false)}
          title="Leave Harvest 21"
          variant="dark"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              You will be taken to an external donation page. Harvest 21 is not responsible for external sites.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setIsExternalDonateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (externalDonationUrl) window.open(externalDonationUrl, "_blank", "noopener,noreferrer");
                  setIsExternalDonateModalOpen(false);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </Modal>

        {/* Content Section - Separate Row */}
        <div className="w-full">
            {/* Tabs - when managed, show only About tab */}
            {(isLoading ? (
              <div 
                className="mb-8 mt-8 flex items-center justify-center overflow-x-auto rounded-full border bg-black/40 px-4 py-3 shadow-inner backdrop-blur"
                onWheel={(e) => {
                  // Allow vertical scrolling to pass through
                  // Only prevent default for horizontal scrolling if shift is held
                  if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    // Vertical scroll - let it bubble up to the page
                    return;
                  }
                  // Horizontal scroll with shift - allow it
                }}
              >
                <div className="flex min-w-full items-center justify-start gap-10">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 w-24 bg-zinc-800 rounded-lg">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div 
                data-tabs-section
                className="mb-8 mt-8 flex items-center justify-center overflow-x-auto bg-black/40 px-4 py-3 shadow-inner backdrop-blur"
                onWheel={(e) => {
                  // Allow vertical scrolling to pass through
                  // Only prevent default for horizontal scrolling if shift is held
                  if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    // Vertical scroll - let it bubble up to the page
                    return;
                  }
                  // Horizontal scroll with shift - allow it
                }}
              >
                <nav className="flex min-w-full items-center justify-start gap-10 text-sm font-semibold uppercase tracking-wide">
                  {[
                    { id: "about" as TabType, label: "About", public: true },
                    { id: "update-letters" as TabType, label: "Update Letters", public: true },
                    { id: "photos" as TabType, label: "Photos", public: false },
                    { id: "videos" as TabType, label: "Videos", public: false },
                    { id: "prayer-wall" as TabType, label: "Prayer Wall", public: false },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isRestricted = !tab.public && !canViewRestrictedContent;
                    const isTabDisabled = isManagedByHarvest21 && !["about", "update-letters"].includes(tab.id);
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group relative px-1 py-1 text-center ${isTabDisabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
                      >
                        <span
                          className={`transition-colors duration-200 flex items-center gap-2 whitespace-nowrap ${
                            isActive ? "text-white" : isTabDisabled ? "text-[#a0a0a0]" : "text-[#a0a0a0] group-hover:text-[#E1B94D]"
                          }`}
                        >
                          {tab.label}
                          {isTabDisabled && (
                            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full normal-case">
                              Managed by Harvest21
                            </span>
                          )}
                          {isRestricted && !isTabDisabled && (
                            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full normal-case">
                              Followers Only
                            </span>
                          )}
                        </span>
                        <span
                          className={`absolute left-0 right-0 -bottom-2 h-0.5 rounded-full transition-all duration-300 ${
                            isActive ? "bg-[#E1B94D]" : "bg-transparent group-hover:bg-[#E1B94D]/60"
                          }`}
                        />
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}

            {/* Tab Content */}
            <div className="space-y-8">
              {isLoading ? (
                <section className="px-8 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.8)]">
                  <div className="space-y-4">
                    <div className="h-6 w-48 bg-zinc-800 rounded">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                    <div className="h-4 w-full bg-zinc-800 rounded">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                    <div className="h-4 w-3/4 bg-zinc-800 rounded">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                    <div className="h-4 w-5/6 bg-zinc-800 rounded">
                      <div className="h-full w-full bg-shimmer animate-shimmer" />
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  {activeTab === "about" && (
                    <section className=" md:px-4 pb-8 pt-0 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.8)]">
                      {page.template_content ? (
                        (() => {
                          const templateState = deserializeTemplateContent(page.template_content);
                          if (templateState) {
                            const pageTemplate = page.page_template || "default";
                            const template = getDefaultTemplate();
                            const variant =
                              pageTemplate === "simple" ? "default" : "missionaryAbout";
                            return (
                              <div className="template-content prose prose-invert max-w-none">
                                <TemplateRenderer
                                  template={template}
                                  content={templateState.fields}
                                  videoUrl={page.video_hashed_id}
                                  variant={variant}
                                />
                              </div>
                            );
                          }
                          return null;
                        })()
                      ) : (
                        <div className="space-y-6 text-base leading-relaxed pb-8">
                          {page.short_quote && (
                            <p className="text-xl font-semibold text-white">
                              &ldquo;{page.short_quote}&rdquo;
                            </p>
                          )}
                          {page.intro_text && (
                            <div
                              className="prose prose-invert max-w-none text-[#f5f5f5]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(page.intro_text) }}
                            />
                          )}
                          {page.about_text && (
                            <div
                              className="prose prose-invert max-w-none text-[#f5f5f5]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(page.about_text) }}
                            />
                          )}
                          {!page.intro_text && !page.about_text && (
                            <p className="text-[#a0a0a0]">No content available yet.</p>
                          )}
                        </div>
                      )}
                      {widgets.filter((w) => w.widget_type === "text_update").length > 0 && (
                        <div className="mt-10 space-y-4 border-t border-white/10 pt-8 md:px-4">
                          <h3 className="text-lg font-semibold text-white">Updates</h3>
                          {widgets
                            .filter((w) => w.widget_type === "text_update")
                            .map((w) => {
                              const wd = w.widget_data as { body?: string };
                              return (
                                <article
                                  key={w.id}
                                  id={`missionary-content-page_widgets-${w.id}`}
                                  className="rounded-lg border border-white/10 bg-white/5 p-4"
                                >
                                  <h4 className="text-sm font-medium text-[#E1B94D]">{w.widget_title}</h4>
                                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#e5e5e5]">
                                    {wd.body || ""}
                                  </p>
                                  <p className="mt-2 text-xs text-[#a0a0a0]">
                                    {new Date(w.created_at).toLocaleDateString()}
                                  </p>
                                </article>
                              );
                            })}
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === "update-letters" && (
                    <UpdateLettersWall
                      pageId={page.id}
                      pageUrl={page.page_url}
                      focusItemId={focusWidgetId ? Number(focusWidgetId) : undefined}
                      onFocusChange={(focus: string | null) => updateFocusUrl("update-letters", focus)}
                      updateLetters={widgets
                        .filter((w) => w.widget_type === "update_letter")
                        .map((w) => ({
                          id: w.id,
                          widget_type: w.widget_type,
                          widget_title: w.widget_title,
                          widget_data: w.widget_data as {
                            pdf_url?: string;
                            thumbnail_url?: string;
                            description?: string;
                            view_count?: number;
                          },
                          created_at: w.created_at,
                        }))}
                      loading={false}
                      isOwner={isOwner || canAdminManageLetters}
                      onUpdateLetterAdded={() => {
                        router.refresh();
                      }}
                    />
                  )}

                  {isManagedByHarvest21 && activeTab === "photos" && (
                    <FollowGate
                      missionaryId={missionary.id}
                      missionaryName={missionaryName}
                      isLoggedIn={isLoggedIn}
                      followerStatus={currentFollowerStatus}
                      contentType="Photos"
                      onFollowSuccess={() => setCurrentFollowerStatus("pending")}
                      isManagedByHarvest21
                    />
                  )}

                  {!isManagedByHarvest21 && activeTab === "photos" && (
                    <>
                      {canViewRestrictedContent ? (
                        <PhotosWall
                          pageId={page.id}
                          pageUrl={page.page_url}
                          focusItemId={focusMediaId ? Number(focusMediaId) : undefined}
                          onFocusChange={(focus: string | null) => updateFocusUrl("photos", focus)}
                          photos={images.map((img) => ({
                            id: img.id,
                            media_type: img.media_type,
                            media_url: img.media_url,
                            description: img.description,
                            thumbnail_url: img.thumbnail_url,
                            created_at: img.created_at,
                          }))}
                          loading={false}
                          isOwner={isOwner}
                          selectedYear="all"
                          onPhotoAdded={() => {
                            router.refresh();
                          }}
                        />
                      ) : (
                        <FollowGate
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          followerStatus={currentFollowerStatus}
                          contentType="Photos"
                          onFollowSuccess={() => setCurrentFollowerStatus("pending")}
                        />
                      )}
                    </>
                  )}

                  {isManagedByHarvest21 && activeTab === "videos" && (
                    <FollowGate
                      missionaryId={missionary.id}
                      missionaryName={missionaryName}
                      isLoggedIn={isLoggedIn}
                      followerStatus={currentFollowerStatus}
                      contentType="Videos"
                      onFollowSuccess={() => setCurrentFollowerStatus("pending")}
                      isManagedByHarvest21
                    />
                  )}

                  {!isManagedByHarvest21 && activeTab === "videos" && (
                    <>
                      {canViewRestrictedContent ? (
                        <VideosWall
                          pageId={page.id}
                          pageUrl={page.page_url}
                          focusItemId={focusMediaId ? Number(focusMediaId) : undefined}
                          onFocusChange={(focus: string | null) => updateFocusUrl("videos", focus)}
                          videos={videos.map((v) => ({
                            id: v.id,
                            media_type: v.media_type,
                            media_url: v.media_url,
                            description: v.description,
                            thumbnail_url: v.thumbnail_url,
                            created_at: v.created_at,
                          }))}
                          loading={false}
                          isOwner={isOwner}
                          selectedYear="all"
                          onVideoAdded={() => {
                            router.refresh();
                          }}
                        />
                      ) : (
                        <FollowGate
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          followerStatus={currentFollowerStatus}
                          contentType="Videos"
                          onFollowSuccess={() => setCurrentFollowerStatus("pending")}
                        />
                      )}
                    </>
                  )}

                  {isManagedByHarvest21 && activeTab === "prayer-wall" && (
                    <FollowGate
                      missionaryId={missionary.id}
                      missionaryName={missionaryName}
                      isLoggedIn={isLoggedIn}
                      followerStatus={currentFollowerStatus}
                      contentType="Prayer Wall"
                      onFollowSuccess={() => setCurrentFollowerStatus("pending")}
                      isManagedByHarvest21
                    />
                  )}

                  {!isManagedByHarvest21 && activeTab === "prayer-wall" && (
                    <>
                      {canViewRestrictedContent ? (
                        <PrayerWall
                          pageId={page.id}
                          pageUrl={page.page_url}
                          focusItemId={focusPrayerId ? Number(focusPrayerId) : undefined}
                          onFocusChange={(focus: string | null) => updateFocusUrl("prayer-wall", focus)}
                          userId={initialUserProfile?.id}
                          isOwner={isOwner}
                        />
                      ) : (
                        <FollowGate
                          missionaryId={missionary.id}
                          missionaryName={missionaryName}
                          isLoggedIn={isLoggedIn}
                          followerStatus={currentFollowerStatus}
                          contentType="Prayer Wall"
                          onFollowSuccess={() => setCurrentFollowerStatus("pending")}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
        </div>
        </div>

        </div>
      </div>
      {showImageCropper && cropperFile && cropperType && (
        <ImageCropper
          file={cropperFile}
          aspectRatio={cropperType === "profile" ? 1 : 1920 / 1080}
          targetWidth={cropperType === "profile" ? 720 : 1920}
          targetHeight={cropperType === "profile" ? 720 : 1080}
          onCropComplete={handleCroppedImage}
          onCancel={() => {
            setShowImageCropper(false);
            setCropperFile(null);
            setCropperType(null);
          }}
          title={cropperType === "profile" ? "Crop Profile Photo (720x720px)" : "Crop Banner Photo (1920x1080px)"}
        />
      )}
      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      <Footer />
      <style jsx global>{`
        .missionary-public-view .tiptap-column {
          border: none !important;
        }
      `}</style>
    </>
  );
}

