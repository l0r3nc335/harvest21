"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Copy, Save, Eye, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ImageCropper } from "@/components/admin/ImageCropper";
import toast from "react-hot-toast";
import { TemplateEditor, TemplateEditorHandle, TemplateRenderer } from "@/components/templates";
import {
  deserializeTemplateContent,
  serializeTemplateContent,
  getDefaultContentState,
} from "@/lib/templates/contentHelpers";
import { getTemplate, getDefaultTemplate } from "@/lib/templates";
import type { TemplateFieldValue } from "@/types/template";
import {
  getPageByEntity,
  updatePageDetails,
  updatePagePhoto,
  uploadFileToStorage,
  deleteFileFromStorage,
  type OrganizationType,
} from "@/lib/pageActions";
import { ChurchAboutUsEditor } from "@/components/admin/churches/ChurchAboutUsEditor";
import type { ChurchAboutUsContent } from "@/types/church";
import { AgencyAboutUsEditor } from "@/components/admin/agencies/AgencyAboutUsEditor";
import type { AgencyAboutUsContent } from "@/types/agency";
import { PageDetailsQRCode } from "@/components/admin/shared/PageDetailsQRCode";
import { getBaseUrl } from "@/lib/envHelpers";
import { RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";

type PageData = {
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
};

type EntityDetailData = {
  id: number;
  name: string;
};

type PageDetailsTabProps = {
  entity: EntityDetailData;
  organizationType: OrganizationType;
  organizationId: number;
  missingFields?: Set<string>;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  isPageOwner?: boolean;
  initialPageData?: {
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
      donation_percentage?: number | null;
      is_published: boolean;
      is_review?: boolean | null;
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
};

export function PageDetailsTab({
  entity,
  organizationType,
  organizationId,
  missingFields = new Set(),
  onUnsavedChanges,
  isPageOwner = true,
  initialPageData,
}: PageDetailsTabProps) {
  const defaultPageName = initialPageData?.page?.name || entity.name || "";
  const initialPage: PageData | null = initialPageData?.page
    ? { ...initialPageData.page, donation_percentage: initialPageData.page.donation_percentage ?? null }
    : null;
  const [pageData, setPageData] = useState<PageData | null>(initialPage);
  const [pageUrl, setPageUrl] = useState(initialPageData?.page?.page_url || "");
  const [pageName, setPageName] = useState(defaultPageName);
  const [shortQuote, setShortQuote] = useState(initialPageData?.page?.short_quote || "");
  const [supportPercentage, setSupportPercentage] = useState<number | "">(
    initialPageData?.page?.donation_percentage != null ? initialPageData.page.donation_percentage : ""
  );
  const [aboutText, setAboutText] = useState(initialPageData?.page?.about_text || "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(initialPageData?.page?.profile_photo_url || "");
  const [bannerPhotoUrl, setBannerPhotoUrl] = useState(initialPageData?.page?.banner_photo_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(!initialPageData);

  const [showBannerPreviewModal, setShowBannerPreviewModal] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const bannerPhotoInputRef = useRef<HTMLInputElement>(null);

  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperType, setCropperType] = useState<"profile" | "banner" | null>(null);

  const templateEditorRef = useRef<TemplateEditorHandle>(null);
  const initialTemplateState = deserializeTemplateContent(initialPageData?.page?.template_content) || getDefaultContentState();
  const [templateContent, setTemplateContent] = useState<Record<string, TemplateFieldValue>>(initialTemplateState.fields);
  const [templateId, setTemplateId] = useState(initialTemplateState.templateId);
  const [videoHashedId, setVideoHashedId] = useState<string | null>(initialPageData?.page?.video_hashed_id || null);
  const initialVideoHashedIdRef = useRef<string | null>(initialPageData?.page?.video_hashed_id || null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  // Track if we've initialized to prevent overwriting user edits
  const isInitializedRef = useRef(false);
  const lastSavedPageNameRef = useRef<string | null>(null);

  // Track initial values for unsaved changes detection
  const initialValuesRef = useRef({
    pageUrl: initialPageData?.page?.page_url || "",
    pageName: defaultPageName,
    shortQuote: initialPageData?.page?.short_quote || "",
    supportPercentage: initialPageData?.page?.donation_percentage ?? "",
    aboutText: initialPageData?.page?.about_text || "",
    templateContent: JSON.stringify(initialTemplateState.fields),
    videoHashedId: initialPageData?.page?.video_hashed_id || null,
  });

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentTemplateContent, setCurrentTemplateContent] = useState<Record<string, TemplateFieldValue>>(templateContent);
  const [hasPendingVideo, setHasPendingVideo] = useState(false);

  // Initialize only once on mount - don't reset when initialPageData or entity.name changes
  useEffect(() => {
    // Only initialize once
    if (isInitializedRef.current) {
      return;
    }

    if (initialPageData) {
      const defaultPageName = initialPageData.page?.name || entity.name || "";
      setPageName(defaultPageName);
      lastSavedPageNameRef.current = defaultPageName;
      
      const templateState = deserializeTemplateContent(initialPageData.page?.template_content) || getDefaultContentState();
      setTemplateContent(templateState.fields);
      setTemplateId(templateState.templateId);
      setVideoHashedId(initialPageData.page?.video_hashed_id || null);
      initialVideoHashedIdRef.current = initialPageData.page?.video_hashed_id || null;

      // Update initial values ref
      const initSupport = initialPageData.page?.donation_percentage ?? "";
      setSupportPercentage(initialPageData.page?.donation_percentage != null ? initialPageData.page.donation_percentage : "");
      initialValuesRef.current = {
        pageUrl: initialPageData.page?.page_url || "",
        pageName: defaultPageName,
        shortQuote: initialPageData.page?.short_quote || "",
        supportPercentage: initSupport,
        aboutText: initialPageData.page?.about_text || "",
        templateContent: JSON.stringify(templateState.fields),
        videoHashedId: initialPageData.page?.video_hashed_id || null,
      };
      setCurrentTemplateContent(templateState.fields);
      setHasUnsavedChanges(false);
      isInitializedRef.current = true;
      return;
    }

    async function loadPageData() {
      setIsLoadingPage(true);
      try {
        const result = await getPageByEntity(organizationType, organizationId);
        if (result.success && result.data) {
          const page = result.data as PageData;
          const loadedPageName = page.name || entity.name || "";
          setPageData(page);
          setPageUrl(page.page_url || "");
          setPageName(loadedPageName);
          lastSavedPageNameRef.current = loadedPageName;
          setShortQuote(page.short_quote || "");
          setSupportPercentage(page.donation_percentage ?? "");
          setAboutText(page.about_text || "");
          setProfilePhotoUrl(page.profile_photo_url || "");
          setBannerPhotoUrl(page.banner_photo_url || "");
          
          const templateState = deserializeTemplateContent(page.template_content) || getDefaultContentState();
          setTemplateContent(templateState.fields);
          setTemplateId(templateState.templateId);
          setVideoHashedId(page.video_hashed_id || null);
          initialVideoHashedIdRef.current = page.video_hashed_id || null;

          const loadedSupport = (page as PageData).donation_percentage ?? "";
          initialValuesRef.current = {
            pageUrl: page.page_url || "",
            pageName: loadedPageName,
            shortQuote: page.short_quote || "",
            supportPercentage: loadedSupport,
            aboutText: page.about_text || "",
            templateContent: JSON.stringify(templateState.fields),
            videoHashedId: page.video_hashed_id || null,
          };
          setCurrentTemplateContent(templateState.fields);
          setHasUnsavedChanges(false);
          isInitializedRef.current = true;
        }
      } catch (error) {
        console.error("Error loading page data:", error);
      } finally {
        setIsLoadingPage(false);
      }
    }
    loadPageData();
    // Only run on mount or when organization changes, not when initialPageData or entity.name changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationType, organizationId]);

  // Detect unsaved changes
  useEffect(() => {
    const templateChanged = JSON.stringify(currentTemplateContent) !== initialValuesRef.current.templateContent;
    const videoChanged = videoHashedId !== initialValuesRef.current.videoHashedId;
    const initialSupport = initialValuesRef.current.supportPercentage;
    const supportChanged = (supportPercentage === "" ? null : supportPercentage) !== (initialSupport === "" || initialSupport === undefined ? null : initialSupport);

    const hasChanges = 
      pageUrl !== initialValuesRef.current.pageUrl ||
      pageName !== initialValuesRef.current.pageName ||
      shortQuote !== initialValuesRef.current.shortQuote ||
      (organizationType === "missionary" && supportChanged) ||
      aboutText !== initialValuesRef.current.aboutText ||
      templateChanged ||
      videoChanged ||
      hasPendingVideo;

    setHasUnsavedChanges(hasChanges);
  }, [pageUrl, pageName, shortQuote, supportPercentage, aboutText, currentTemplateContent, videoHashedId, hasPendingVideo, organizationType]);

  // Browser beforeunload event to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChanges]);

  const handleCopyUrl = () => {
    const fullUrl = `${getBaseUrl()}/${pageUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("URL copied to clipboard!");
  };

  const handleSave = async () => {
    // Removed early return - we don't need pageData to save pageName
    // The updatePageDetails function will handle finding the page record

    console.log("==========================================================================")
    console.log(pageName)

    setIsSaving(true);
    const hasPendingVideo = templateEditorRef.current?.hasPendingVideo() || false;
    if (hasPendingVideo) {
      setVideoUploadProgress(0);
    }
    
    try {
      let newVideoHashedId = videoHashedId;
      let templateContentJson = "";
      let pageTemplate: string | undefined = undefined;

      if (templateEditorRef.current) {
        const uploadResult = await templateEditorRef.current.processUploads(
          organizationType,
          organizationId,
          hasPendingVideo ? (progress) => {
            setVideoUploadProgress(progress);
          } : undefined
        );
        newVideoHashedId = uploadResult.videoUrl;
        setVideoHashedId(newVideoHashedId);

        const contentState = templateEditorRef.current.getContentState();
        contentState.videoUrl = newVideoHashedId;
        templateContentJson = serializeTemplateContent(contentState);
        // Normalize template ID for storage: treat the default
        // "about-you" template as "default" in the pages table.
        pageTemplate = contentState.templateId === "about-you" ? "default" : contentState.templateId;
      }
      
      setVideoUploadProgress(null);

      const videoChanged = newVideoHashedId !== initialVideoHashedIdRef.current;
      if (videoChanged) {
        console.log("Video changed:", {
          from: initialVideoHashedIdRef.current,
          to: newVideoHashedId,
        });
      }
      
      // Save the current textbox value directly to pages.name column
      const finalPageName = pageName.trim();
      
      // Debug logging to track the save process
      console.log("🔍 Saving pageName:", {
        original: pageName,
        trimmed: finalPageName,
        pageDataExists: !!pageData,
        organizationType,
        organizationId
      });

      console.log("==========================================================================")
      console.log(finalPageName)


      const donationPercentage =
        organizationType === "missionary" && supportPercentage !== ""
          ? Math.min(100, Math.max(0, Number(supportPercentage)))
          : undefined;

      const result = await updatePageDetails(organizationType, organizationId, {
        pageUrl,
        pageName: finalPageName, // Always pass this, even if empty
        pageTemplate,
        shortQuote,
        aboutText,
        templateContent: templateContentJson,
        videoHashedId: newVideoHashedId,
        profilePhotoUrl: profilePhotoUrl || undefined,
        bannerPhotoUrl: bannerPhotoUrl || undefined,
        ...(organizationType === "missionary" && { donationPercentage: donationPercentage ?? null }),
      });
      
      console.log("🔍 Save result:", result);

      if (result.success) {
        // Verify the save was successful by fetching the saved value from database
        const verifyResult = await getPageByEntity(organizationType, organizationId);
        if (verifyResult.success && verifyResult.data) {
          const savedPage = verifyResult.data as PageData;
          const savedPageName = savedPage.name || "";
          const savedSupport = savedPage.donation_percentage ?? "";

          // Update state with the verified saved value from database
          setPageName(savedPageName);
          lastSavedPageNameRef.current = savedPageName;
          if (organizationType === "missionary") {
            setSupportPercentage(savedPage.donation_percentage != null ? savedPage.donation_percentage : "");
          }

          // Update pageData state
          setPageData(savedPage);

          initialVideoHashedIdRef.current = newVideoHashedId;
          // Update initial values after successful save
          const savedTemplateContent = templateEditorRef.current?.getContentState().fields || templateContent;
          initialValuesRef.current = {
            pageUrl,
            pageName: savedPageName,
            shortQuote,
            supportPercentage: savedSupport,
            aboutText,
            templateContent: JSON.stringify(savedTemplateContent),
            videoHashedId: newVideoHashedId,
          };
          setCurrentTemplateContent(savedTemplateContent);
          setHasPendingVideo(false);
          setHasUnsavedChanges(false);
          toast.success(result.message || "Content updated successfully!");
        } else {
          console.error("Failed to verify save - could not fetch saved page data");
          toast.error("Save completed but verification failed. Please refresh the page.");
        }
      } else {
        toast.error(result.message || "Failed to save page details");
      }
    } catch (error) {
      console.error("Error saving page details:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
      setVideoUploadProgress(null);
    }
  };

  const handleFileSelect = (file: File, type: "profile" | "banner") => {
    setCropperFile(file);
    setCropperType(type);
    setShowImageCropper(true);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!cropperFile || !cropperType || !pageData) {
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
    if (!pageData) {
      toast.error("Page data not found");
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
        organizationType,
        organizationId,
        type,
        file,
        existingUrl
      );

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || "Failed to upload file");
      }

      const publicUrl = result.publicUrl;

      if (type === "profile") {
        const dbResult = await updatePagePhoto(organizationType, organizationId, "profile", publicUrl);
        if (dbResult.success) {
          setProfilePhotoUrl(publicUrl);
          toast.success("Profile photo uploaded successfully!");
        } else {
          throw new Error(dbResult.message || "Failed to update profile photo");
        }
      } else if (type === "banner") {
        const dbResult = await updatePagePhoto(organizationType, organizationId, "banner", publicUrl);
        if (dbResult.success) {
          setBannerPhotoUrl(publicUrl);
          toast.success("Banner photo uploaded successfully!");
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

  const handleUploadImage = async (file: File): Promise<string> => {
    if (!pageData) {
      throw new Error("Page data not found");
    }

    const result = await uploadFileToStorage(
      organizationType,
      organizationId,
      "media",
      file
    );

    if (!result.success || !result.publicUrl) {
      throw new Error(result.error || "Failed to upload image");
    }

    return result.publicUrl;
  };

  if (isLoadingPage) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center py-8">
          <p className="text-zinc-500">Loading page details...</p>
        </div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center py-8">
          <p className="text-zinc-500">Page not found. Please create a page first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {isSaving && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {videoUploadProgress !== null ? `Uploading video... ${Math.round(videoUploadProgress)}%` : "Saving your changes..."}
            </p>
            {videoUploadProgress !== null && (
              <div className="w-48 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all duration-300"
                  style={{ width: `${videoUploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Customize your page</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
              Page URL
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Keep your URL up-to-date wherever you&apos;ve shared it.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center border border-zinc-300 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-800">
                <span className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-300 border-r border-zinc-300 dark:border-zinc-700">
                  {getBaseUrl()}
                </span>
                <Input
                  type="text"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value.replace(/^\//, ""))}
                  className="border-0 focus:ring-0 flex-1 bg-transparent"
                  placeholder="page-url"
                />
              </div>
              <Button variant="secondary" onClick={handleCopyUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <PageDetailsQRCode
              canonicalPageUrl={`${getBaseUrl()}/${pageUrl.replace(/^\//, "")}`.replace(/\/+/g, "/")}
              isPageOwner={isPageOwner}
            />
          </div>

          {/* Profile Photo / Logo */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
              {organizationType === "church" || organizationType === "agency" ? "Logo or Photo" : "Profile Photo"}
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">We recommend a 720x720px image.</p>
            <div className="flex items-center gap-4">
              <div className={`h-24 w-24 rounded-full border-2 flex items-center justify-center overflow-hidden relative ${
                missingFields.has("profile_photo") ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" : "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"
              }`}>
                {profilePhotoUrl ? (
                  <Image
                    src={profilePhotoUrl}
                    alt="Profile"
                    fill
                    className="object-cover rounded-full"
                    sizes="96px"
                  />
                ) : (
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    {entity.name?.substring(0, 2).toUpperCase() || "MP"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept={RASTER_IMAGE_INPUT_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, "profile");
                    if (e.target) {
                      e.target.value = "";
                    }
                  }}
                  disabled={uploadingProfile}
                />
                <Button
                  variant="secondary"
                  disabled={uploadingProfile}
                  onClick={() => profilePhotoInputRef.current?.click()}
                >
                  {uploadingProfile ? "Uploading..." : (organizationType === "agency" || organizationType === "church") ? "Upload Logo or Photo" : "Upload Photo"}
                </Button>
                {profilePhotoUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      if (profilePhotoUrl) {
                        await deleteFileFromStorage(profilePhotoUrl, "h21-dev");
                      }
                      const result = await updatePagePhoto(organizationType, organizationId, "profile", null);
                      if (result.success) {
                        setProfilePhotoUrl("");
                        toast.success("Profile photo removed successfully!");
                      } else {
                        toast.error(result.message || "Failed to remove profile photo");
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
              {organizationType === "church" ? "Church Name" : organizationType === "agency" ? "Agency Name" : "Photo Name"}
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              {organizationType === "church" 
                ? "The name displayed for your church." 
                : organizationType === "agency"
                ? "The name displayed for your agency."
                : "The name displayed on your photo."}
            </p>
            <Input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder={entity.name}
              className={missingFields.has("page_name") ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
              Short Quote
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Keep it short and simple.</p>
            <Input
              type="text"
              value={shortQuote}
              onChange={(e) => setShortQuote(e.target.value)}
              placeholder="Enter a short quote"
              className={missingFields.has("short_quote") ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}
            />
          </div>

          {organizationType === "missionary" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
                Support Percentage
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Enter the percentage that you are currently supported at (0–100).
              </p>
              <Input
                type="number"
                min={0}
                max={100}
                value={supportPercentage === "" ? "" : supportPercentage}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setSupportPercentage("");
                    return;
                  }
                  const n = parseInt(v, 10);
                  if (!Number.isNaN(n)) {
                    setSupportPercentage(Math.min(100, Math.max(0, n)));
                  }
                }}
                placeholder="0–100"
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
              Banner Photo
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">We recommend a 1920x1080px image.</p>
            <div className={`relative h-96 w-full rounded-md bg-linear-to-r from-brand-yellow to-zinc-800 overflow-hidden ${
              missingFields.has("banner_photo") ? "ring-2 ring-red-500" : ""
            }`}>
              {bannerPhotoUrl ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={() => setShowBannerPreviewModal(true)}>
                    <div className="relative w-full h-full">
                      <Image
                        src={bannerPhotoUrl}
                        alt="Banner Preview"
                        fill
                        className="object-cover rounded-md"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-2 z-10">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowBannerPreviewModal(true)}
                      className="bg-black/50 text-white hover:bg-black/70"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        if (bannerPhotoUrl) {
                          await deleteFileFromStorage(bannerPhotoUrl, "h21-dev");
                        }
                        const result = await updatePagePhoto(organizationType, organizationId, "banner", null);
                        if (result.success) {
                          setBannerPhotoUrl("");
                          toast.success("Banner photo removed successfully!");
                        } else {
                          toast.error(result.message || "Failed to remove banner photo");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
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
                  <Button
                    variant="secondary"
                    disabled={uploadingBanner}
                    onClick={() => bannerPhotoInputRef.current?.click()}
                  >
                    {uploadingBanner ? "Uploading..." : "Upload Banner"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Content Editor - Church & Agency use fixed 7 sections, others use template editor */}
          {organizationType === "church" ? (
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Complete all seven required sections to tell your church&apos;s story.
              </p>
              <ChurchAboutUsEditor
                churchId={organizationId}
                pageId={pageData?.id || null}
                pageName={pageName}
                pageUrl={pageUrl}
                shortQuote={shortQuote}
                onShortQuoteChange={setShortQuote}
                initialContent={(() => {
                  try {
                    return pageData?.template_content ? JSON.parse(pageData.template_content) as ChurchAboutUsContent : null;
                  } catch {
                    return null;
                  }
                })()}
                initialVideoHashedId={pageData?.video_hashed_id || null}
                onSave={(content, videoHashedId) => {
                  // Update local state
                  setPageData(prev => prev ? {
                    ...prev,
                    template_content: JSON.stringify(content),
                    video_hashed_id: videoHashedId,
                    short_quote: shortQuote,
                  } : null);
                }}
              />
            </div>
          ) : organizationType === "agency" ? (
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Complete all seven required sections to tell your agency&apos;s story.
              </p>
              <AgencyAboutUsEditor
                agencyId={organizationId}
                pageId={pageData?.id || null}
                shortQuote={shortQuote}
                onShortQuoteChange={setShortQuote}
                initialContent={(() => {
                  try {
                    return pageData?.template_content ? JSON.parse(pageData.template_content) as AgencyAboutUsContent : null;
                  } catch {
                    return null;
                  }
                })()}
                initialVideoHashedId={pageData?.video_hashed_id || null}
                onSave={(content, videoHashedId) => {
                  // Update local state
                  setPageData(prev => prev ? {
                    ...prev,
                    template_content: JSON.stringify(content),
                    video_hashed_id: videoHashedId,
                    short_quote: shortQuote,
                  } : null);
                }}
              />
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-white">
                    Personal Bio
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowTemplatePreview(true)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </Button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  Use the template below to create a compelling story about your mission.
                </p>
                <TemplateEditor
                  ref={templateEditorRef}
                  initialTemplateId={templateId}
                  initialContent={templateContent}
                  initialVideoUrl={videoHashedId}
                  missingFields={missingFields}
                  onChange={(content, videoUrl, pendingVideoFile) => {
                    setCurrentTemplateContent(content);
                    setVideoHashedId(videoUrl);
                    setHasPendingVideo(pendingVideoFile !== null);
                  }}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Update Content
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showTemplatePreview}
        onClose={() => setShowTemplatePreview(false)}
        title="Template Preview"
        size="fullscreen"
      >
        <div className="max-w-4xl mx-auto">
          <TemplateRenderer
            template={getTemplate(templateId) || getDefaultTemplate()}
            content={templateEditorRef.current?.getContentState().fields || templateContent}
            videoUrl={videoHashedId}
          />
        </div>
      </Modal>

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

      <Modal
        isOpen={showBannerPreviewModal}
        onClose={() => setShowBannerPreviewModal(false)}
        title="Banner Preview"
        size="xl"
      >
        {bannerPhotoUrl && (
          <div className="relative w-full" style={{ aspectRatio: "1920/1080" }}>
            <Image
              src={bannerPhotoUrl}
              alt="Banner Full Size"
              fill
              className="object-contain rounded-md"
              sizes="100vw"
            />
          </div>
        )}
      </Modal>



      <Modal
        isOpen={showUnsavedWarning}
        onClose={() => {
          setShowUnsavedWarning(false);
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
                Save your changes before continuing?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowUnsavedWarning(false);
                if (pendingAction) {
                  setHasUnsavedChanges(false);
                  pendingAction();
                  setPendingAction(null);
                }
              }}
            >
              Discard Changes
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                setShowUnsavedWarning(false);
                await handleSave();
                if (pendingAction) {
                  pendingAction();
                  setPendingAction(null);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
