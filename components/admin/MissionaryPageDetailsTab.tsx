"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Copy, Save, Eye, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ImageCropper } from "@/components/admin/ImageCropper";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
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
  updateMissionaryPhoto,
  uploadFileToStorage,
  deleteFileFromStorage
} from "@/app/admin/missionaries/[id]/actions";
import { getBaseUrl } from "@/lib/envHelpers";
import { RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";

type MissionaryDetailData = {
  id: number;
  first_name: string;
  last_name: string;
  page?: {
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
    is_published: boolean;
  } | null;
};

type MissionaryPageDetailsTabProps = {
  missionary: MissionaryDetailData;
  pageId: number | null;
  onUpdatePageDetails: (
    missionaryId: number,
    data: {
      pageUrl?: string;
      pageName?: string;
      pageTemplate?: string;
      profilePhotoUrl?: string;
      bannerPhotoUrl?: string;
      shortQuote?: string;
      introText?: string;
      templateContent?: string;
      videoHashedId?: string | null;
    }
  ) => Promise<{ success: boolean; message?: string }>;
  onUnsavedChanges?: (hasChanges: boolean) => void;
};

export function MissionaryPageDetailsTab({ 
  missionary, 
  pageId: initialPageId,
  onUpdatePageDetails,
  onUnsavedChanges
}: MissionaryPageDetailsTabProps) {
  const defaultPageName = missionary.page?.name || `${missionary.first_name} ${missionary.last_name}`.trim() || "";
  const [pageUrl, setPageUrl] = useState(missionary.page?.page_url || "");
  const [pageName, setPageName] = useState(defaultPageName);
  const [shortQuote, setShortQuote] = useState(missionary.page?.short_quote || "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(missionary.page?.profile_photo_url || "");
  const [bannerPhotoUrl, setBannerPhotoUrl] = useState(missionary.page?.banner_photo_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [pageId, setPageId] = useState<number | null>(initialPageId);

  // Modals
  const [showBannerPreviewModal, setShowBannerPreviewModal] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Upload states
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Refs for file inputs
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const bannerPhotoInputRef = useRef<HTMLInputElement>(null);

  // Image cropper state
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperType, setCropperType] = useState<"profile" | "banner" | null>(null);

  // Template editor state
  const templateEditorRef = useRef<TemplateEditorHandle>(null);
  const initialTemplateState = deserializeTemplateContent(missionary.page?.template_content) || getDefaultContentState();
  const [templateContent, setTemplateContent] = useState<Record<string, TemplateFieldValue>>(initialTemplateState.fields);
  const [templateId, setTemplateId] = useState(initialTemplateState.templateId);
  const [videoHashedId, setVideoHashedId] = useState<string | null>(missionary.page?.video_hashed_id || null);
  const initialVideoHashedIdRef = useRef<string | null>(missionary.page?.video_hashed_id || null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  // Track initial values for unsaved changes detection
  const initialValuesRef = useRef({
    pageUrl: missionary.page?.page_url || "",
    pageName: defaultPageName,
    shortQuote: missionary.page?.short_quote || "",
    templateContent: JSON.stringify(initialTemplateState.fields),
    videoHashedId: missionary.page?.video_hashed_id || null,
  });

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentTemplateContent, setCurrentTemplateContent] = useState<Record<string, TemplateFieldValue>>(templateContent);
  const [hasPendingVideo, setHasPendingVideo] = useState(false);

  // Sync state when missionary prop changes
  useEffect(() => {
    const defaultPageName = missionary.page?.name || `${missionary.first_name} ${missionary.last_name}`.trim() || "";
    setPageUrl(missionary.page?.page_url || "");
    setPageName(defaultPageName);
    setShortQuote(missionary.page?.short_quote || "");
    setProfilePhotoUrl(missionary.page?.profile_photo_url || "");
    setBannerPhotoUrl(missionary.page?.banner_photo_url || "");
    
    const templateState = deserializeTemplateContent(missionary.page?.template_content) || getDefaultContentState();
    setTemplateContent(templateState.fields);
    setTemplateId(templateState.templateId);
    setVideoHashedId(missionary.page?.video_hashed_id || null);
    initialVideoHashedIdRef.current = missionary.page?.video_hashed_id || null;

    // Update initial values ref
    initialValuesRef.current = {
      pageUrl: missionary.page?.page_url || "",
      pageName: defaultPageName,
      shortQuote: missionary.page?.short_quote || "",
      templateContent: JSON.stringify(templateState.fields),
      videoHashedId: missionary.page?.video_hashed_id || null,
    };
    setCurrentTemplateContent(templateState.fields);
    setHasUnsavedChanges(false);
  }, [missionary]);

  // Sync pageId when initialPageId changes
  useEffect(() => {
    setPageId(initialPageId);
  }, [initialPageId]);

  // Detect unsaved changes
  useEffect(() => {
    const templateChanged = JSON.stringify(currentTemplateContent) !== initialValuesRef.current.templateContent;
    const videoChanged = videoHashedId !== initialValuesRef.current.videoHashedId;
    
    const hasChanges = 
      pageUrl !== initialValuesRef.current.pageUrl ||
      pageName !== initialValuesRef.current.pageName ||
      shortQuote !== initialValuesRef.current.shortQuote ||
      templateChanged ||
      videoChanged ||
      hasPendingVideo;

    setHasUnsavedChanges(hasChanges);
  }, [pageUrl, pageName, shortQuote, currentTemplateContent, videoHashedId, hasPendingVideo]);

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
          "missionary",
          missionary.id,
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
      
      const finalPageName = pageName.trim() || `${missionary.first_name} ${missionary.last_name}`.trim();
      const result = await onUpdatePageDetails(missionary.id, {
        pageUrl,
        pageName: finalPageName,
        pageTemplate,
        shortQuote,
        templateContent: templateContentJson,
        videoHashedId: newVideoHashedId,
        profilePhotoUrl: profilePhotoUrl || undefined,
        bannerPhotoUrl: bannerPhotoUrl || undefined,
      });

      if (result.success) {
        initialVideoHashedIdRef.current = newVideoHashedId;
        // Update initial values after successful save
        const savedTemplateContent = templateEditorRef.current?.getContentState().fields || templateContent;
        initialValuesRef.current = {
          pageUrl,
          pageName: finalPageName,
          shortQuote,
          templateContent: JSON.stringify(savedTemplateContent),
          videoHashedId: newVideoHashedId,
        };
        setCurrentTemplateContent(savedTemplateContent);
        setHasPendingVideo(false);
        setHasUnsavedChanges(false);
        toast.success(result.message || "Content updated successfully!");
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
    // Show cropper for profile and banner photos
    setCropperFile(file);
    setCropperType(type);
    setShowImageCropper(true);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!cropperFile || !cropperType || !pageId || !missionary.id) {
      return;
    }

    // Convert blob to File
    const fileExtension = cropperFile.name.split(".").pop() || "jpg";
    const fileName = `cropped-${cropperType}-${Date.now()}.${fileExtension}`;
    const croppedFile = new File([croppedBlob], fileName, {
      type: croppedBlob.type || "image/jpeg",
    });

    // Close cropper
    setShowImageCropper(false);
    setCropperFile(null);
    setCropperType(null);

    // Upload the cropped file
    await handleFileUpload(croppedFile, cropperType);
  };

  const handleFileUpload = async (file: File, type: "profile" | "banner") => {
    if (!pageId || !missionary.id) {
      toast.error("Page ID or Missionary ID not found");
      return;
    }

    try {
      // Set loading state
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

      // Use server action to upload file (uses Supabase Admin)
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

      // Update database based on type
      if (type === "profile") {
        const dbResult = await updateMissionaryPhoto(missionary.id, "profile", publicUrl);
        if (dbResult.success) {
          setProfilePhotoUrl(publicUrl);
          toast.success("Profile photo uploaded successfully!");
        } else {
          throw new Error(dbResult.message || "Failed to update profile photo");
        }
      } else if (type === "banner") {
        const dbResult = await updateMissionaryPhoto(missionary.id, "banner", publicUrl);
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
      {/* Customize your page */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Customize your page</h2>
        <div className="space-y-4">
          {/* Page URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Page URL
            </label>
            <p className="text-xs text-zinc-500 mb-2">Keep your URL up-to-date wherever you&apos;ve shared it.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center border border-zinc-300 rounded-md overflow-hidden">
                <span className="px-3 py-2 bg-zinc-100 text-sm text-zinc-600 border-r border-zinc-300">
                  {getBaseUrl()}
                </span>
                <Input
                  type="text"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value.replace(/^\//, ""))}
                  className="border-0 focus:ring-0 flex-1"
                  placeholder="page-url"
                />
              </div>
              <Button variant="secondary" onClick={handleCopyUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Profile Photo */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Profile Photo
            </label>
            <p className="text-xs text-zinc-500 mb-2">We recommend a 720x720px image.</p>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-full border-2 border-zinc-300 bg-zinc-100 flex items-center justify-center overflow-hidden relative">
                <MissionaryProfileImage
                  src={profilePhotoUrl}
                  alt="Profile"
                  fill
                  className="object-cover rounded-full"
                  sizes="96px"
                />
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
                    // Reset input so same file can be selected again
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
                  {uploadingProfile ? "Uploading..." : "Upload Photo"}
                </Button>
                {profilePhotoUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      // Delete file from storage
                      if (profilePhotoUrl) {
                        await deleteFileFromStorage(profilePhotoUrl, "h21-dev");
                      }
                      // Update database
                      const result = await updateMissionaryPhoto(missionary.id, "profile", null);
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

          {/* Page Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Photo Name
            </label>
            <p className="text-xs text-zinc-500 mb-2">The name displayed on your photo.</p>
            <Input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder={`${missionary.first_name} ${missionary.last_name}`}
            />
          </div>

          {/* Short Quote */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Short Quote
            </label>
            <p className="text-xs text-zinc-500 mb-2">Keep it short and simple.</p>
            <Input
              type="text"
              value={shortQuote}
              onChange={(e) => setShortQuote(e.target.value)}
              placeholder="Enter a short quote"
            />
          </div>

          {/* Banner Photo */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Banner Photo
            </label>
            <p className="text-xs text-zinc-500 mb-2">We recommend a 1920x1080px image.</p>
            <div className="relative h-96 w-full rounded-md bg-linear-to-r from-[#D3AF37] to-zinc-800 overflow-hidden">
              {bannerPhotoUrl ? (
                <>
                  {/* Preview Image - Centered */}
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
                  {/* Action Buttons */}
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
                        // Delete file from storage
                        if (bannerPhotoUrl) {
                          await deleteFileFromStorage(bannerPhotoUrl, "h21-dev");
                        }
                        // Update database
                        const result = await updateMissionaryPhoto(missionary.id, "banner", null);
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
                      // Reset input so same file can be selected again
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

          {/* About You - Template Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-zinc-700">
                About You
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
            <p className="text-xs text-zinc-500 mb-4">
              Use the template below to create a compelling story about your mission.
            </p>
            <TemplateEditor
              ref={templateEditorRef}
              initialTemplateId={templateId}
              initialContent={templateContent}
              initialVideoUrl={videoHashedId}
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
        </div>
      </div>

      {/* Template Preview Modal */}
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
            variant="missionaryAbout"
          />
        </div>
      </Modal>

      {/* Image Cropper */}
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

      {/* Banner Preview Modal */}
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
