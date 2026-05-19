"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MissionaryProfileImage } from "@/components/ui/MissionaryProfileImage";
import { ArrowLeft, Upload, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ImageCropper } from "@/components/admin/ImageCropper";
import { Navbar } from "@/components/Navbar";
import toast from "react-hot-toast";
import type { MissionaryPreviewData } from "@/app/[page_url]/actions";
import { approveMissionaryPage } from "@/app/[page_url]/actions";
import { PrayerWall } from "@/components/prayer/PrayerWall";
import { VideosWall } from "@/components/video/VideosWall";
import { PhotosWall } from "@/components/photo/PhotosWall";
import { UpdateLettersWall } from "@/components/update-letter/UpdateLettersWall";
import { supabase } from "@/lib/supabaseClient";
import { updateMissionaryPhoto, uploadFileToStorage } from "@/app/admin/missionaries/[id]/actions";
import type { NavbarUserProfile } from "@/lib/navbarHelpers";
import { TemplateRenderer } from "@/components/templates";
import { deserializeTemplateContent } from "@/lib/templates/contentHelpers";
import { getTemplate, getDefaultTemplate } from "@/lib/templates";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";
import { RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";

type MissionaryPreviewPageClientProps = {
  data: MissionaryPreviewData;
  isAdmin: boolean;
  initialUserProfile?: NavbarUserProfile | null;
};

type TabType = "about" | "update-letters" | "photos" | "videos" | "prayer-wall";

export function MissionaryPreviewPageClient({
  data,
  isAdmin,
  initialUserProfile = null,
}: MissionaryPreviewPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [isApproving, setIsApproving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [supportPercentage] = useState(0);
  const [totalReceived] = useState(data.donations?.totalReceived || 0);
  
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperType, setCropperType] = useState<"profile" | "banner" | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(data.page.profile_photo_url || "");
  const [bannerPhotoUrl, setBannerPhotoUrl] = useState(data.page.banner_photo_url || "");
  
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const bannerPhotoInputRef = useRef<HTMLInputElement>(null);
  const [userProfile, setUserProfile] = useState<NavbarUserProfile | null>(initialUserProfile);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const authUserId = user?.id || null;
      setIsOwner(authUserId !== null && data.missionary.user_id !== null && authUserId === data.missionary.user_id);
      
      if (!initialUserProfile && user) {
        try {
          const { data: profileData, error } = await supabase
            .from("users")
            .select("id, first_name, last_name, email, role, profile_photo_url, page_url")
            .eq("id", user.id)
            .single();
          
          if (!error && profileData) {
            setUserProfile({
              id: profileData.id,
              first_name: profileData.first_name,
              last_name: profileData.last_name,
              email: profileData.email,
              role: profileData.role,
              profile_photo_url: profileData.profile_photo_url,
              page_url: profileData.page_url,
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
    };
    checkAuth();
  }, [data.missionary.user_id, initialUserProfile]);

  useEffect(() => {
    setProfilePhotoUrl(data.page.profile_photo_url || "");
    setBannerPhotoUrl(data.page.banner_photo_url || "");
  }, [data.page.profile_photo_url, data.page.banner_photo_url]);

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
    if (!data.missionary.id) {
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
        data.missionary.id,
        type,
        file,
        existingUrl
      );

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || "Failed to upload file");
      }

      const publicUrl = result.publicUrl;

      if (type === "profile") {
        const dbResult = await updateMissionaryPhoto(data.missionary.id, "profile", publicUrl);
        if (dbResult.success) {
          setProfilePhotoUrl(publicUrl);
          toast.success("Profile photo uploaded successfully!");
          router.refresh();
        } else {
          throw new Error(dbResult.message || "Failed to update profile photo");
        }
      } else if (type === "banner") {
        const dbResult = await updateMissionaryPhoto(data.missionary.id, "banner", publicUrl);
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

  const missionaryName = data.page.name?.trim() || `${data.missionary.first_name} ${data.missionary.last_name}`;
  const agencyName = data.missionary.agency?.name || "Independent";

  // Donations are fetched on the server, so we don't need useEffect here
  // This prevents hydration mismatch

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveMissionaryPage(data.page.id);
      if (result.success) {
        toast.success(result.message || "Page approved and published!");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to approve page");
      }
    } catch (error) {
      console.error("Error approving page:", error);
      toast.error("Failed to approve page");
    } finally {
      setIsApproving(false);
    }
  };

  const images = data.media.filter((m) => m.media_type === "image");
  const videos = data.media.filter((m) => m.media_type === "video");

  return (
    <div className="min-h-screen w-full bg-black text-white" style={{ position: 'relative', zIndex: 9999 }}>
      {!isAdmin && <Navbar initialUserProfile={userProfile} />}
      <div className={isAdmin ? "" : "mt-16"}>
      {/* Top Banner Section */}
      <div
        className="relative h-96 bg-linear-to-b from-[#E1B94D] to-black"
        style={
          bannerPhotoUrl && !uploadingBanner
            ? {
                backgroundImage: `url(${bannerPhotoUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {uploadingBanner && (
          <div className="absolute inset-0 z-20 flex items-center justify-center shadow-none">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E1B94D] border-t-transparent" />
              <span className="text-sm text-white drop-shadow-lg">Uploading banner...</span>
            </div>
          </div>
        )}
        {/* Unpublished Banner */}
        {!data.page.is_published && (
          <div className="absolute top-4 left-4 bg-black/80 px-4 py-2 rounded-md">
            <p className="text-sm text-white">Your page is not yet published.</p>
          </div>
        )}

        {/* Admin Controls */}
        {isAdmin && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href={`/admin/missionaries/${data.missionary.id}`}>
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back To Settings 
              </Button>
            </Link>
            {!data.page.is_published && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                disabled={isApproving}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isApproving ? "Approving..." : "Approve This Page"}
              </Button>
            )}
          </div>
        )}

        {/* Set Banner Photo Button */}
        {(isAdmin || isOwner) && !bannerPhotoUrl && !uploadingBanner && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
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
              size="sm" 
              onClick={() => bannerPhotoInputRef.current?.click()}
              disabled={uploadingBanner}
            >
              <Upload className="h-4 w-4 mr-2" />
              Set Banner Photo
            </Button>
          </div>
        )}
        {(isAdmin || isOwner) && bannerPhotoUrl && !uploadingBanner && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
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
              size="sm" 
              onClick={() => bannerPhotoInputRef.current?.click()}
              disabled={uploadingBanner}
            >
              <Upload className="h-4 w-4 mr-2" />
              Change Banner
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-xl p-6 -mt-24 relative z-10">
              {/* Profile Photo */}
              <div className="relative mb-4">
                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-zinc-200 relative group">
                  {uploadingProfile && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-full">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#E1B94D] border-t-transparent" />
                        <span className="text-xs text-white">Uploading...</span>
                      </div>
                    </div>
                  )}
                  <MissionaryProfileImage
                    src={profilePhotoUrl}
                    alt={missionaryName}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                  {(isAdmin || isOwner) && !uploadingProfile && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 z-10">
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
                        size="sm"
                        className="bg-[#E1B94D] text-black hover:bg-[#d4a639]"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        disabled={uploadingProfile}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Missionary Name */}
              <h1 className="text-2xl font-bold text-zinc-900 text-center mb-2">
                {missionaryName}
              </h1>

              {/* Agency/Affiliation */}
              <p className="text-sm text-zinc-600 text-center mb-6">{agencyName}</p>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-zinc-900">{supportPercentage}%</span>
                  <span className="text-sm text-zinc-600">Support Level</span>
                </div>
                <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${supportPercentage}%` }}
                  />
                </div>
                {totalReceived > 0 && (
                  <p className="text-xs text-zinc-500 mt-1 text-center">
                    ${totalReceived.toLocaleString()} received
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button variant="primary" className="w-full" onClick={() => {
                  toast.success("Follow functionality coming soon!");
                }}>
                  Follow
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => {
                  toast.success("Encourage functionality coming soon!");
                }}>
                  Encourage
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => {
                  if (typeof window !== "undefined") {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copied to clipboard!");
                  }
                }}>
                  Tell Others
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => {
                  toast.success("Donate functionality coming soon!");
                }}>
                  Donate
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="border-b border-zinc-700 mb-6">
              <nav className="flex space-x-8">
                {[
                  { id: "about" as TabType, label: "About" },
                  { id: "update-letters" as TabType, label: "Update Letters" },
                  { id: "photos" as TabType, label: "Photos" },
                  { id: "videos" as TabType, label: "Videos" },
                  { id: "prayer-wall" as TabType, label: "Prayer Wall" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`cursor-pointer whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-[#D3AF37] text-[#D3AF37]"
                        : "border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === "about" && (
                <div className="space-y-4">
                  {data.page.template_content ? (
                    (() => {
                      const templateState = deserializeTemplateContent(data.page.template_content);
                      if (templateState) {
                        const pageTemplate = data.page.page_template || "default";
                        const template = getDefaultTemplate();
                        const variant =
                          pageTemplate === "simple" ? "default" : "missionaryAbout";
                        return (
                          <div className="template-content prose prose-invert max-w-none">
                            <TemplateRenderer
                              template={template}
                              content={templateState.fields}
                              videoUrl={data.page.video_hashed_id}
                              variant={variant}
                            />
                          </div>
                        );
                      }
                      return null;
                    })()
                  ) : (
                    <>
                      {data.page.short_quote && (
                        <div className="text-xl font-semibold text-zinc-200 mb-4">
                          &ldquo;{data.page.short_quote}&rdquo;
                        </div>
                      )}
                      {data.page.intro_text && (
                        <div
                          className="prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(data.page.intro_text) }}
                        />
                      )}
                      {data.page.about_text && (
                        <div
                          className="prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(data.page.about_text) }}
                        />
                      )}
                      {!data.page.intro_text && !data.page.about_text && (
                        <p className="text-zinc-400">No content available yet.</p>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        router.push(`/admin/missionaries/${data.missionary.id}?tab=page-details`);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}

              {activeTab === "update-letters" && (
                <UpdateLettersWall
                  pageId={data.page.id}
                  updateLetters={data.widgets
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
                  isOwner={isOwner}
                  onUpdateLetterAdded={() => {
                    router.refresh();
                  }}
                />
              )}

              {activeTab === "photos" && (
                <PhotosWall
                  pageId={data.page.id}
                  photos={images.map((img) => ({
                    id: img.id,
                    media_type: img.media_type,
                    media_url: img.media_url,
                    description: undefined,
                    thumbnail_url: undefined,
                    created_at: img.created_at,
                  }))}
                  loading={false}
                  isOwner={isOwner}
                  selectedYear="all"
                  onPhotoAdded={() => {
                    router.refresh();
                  }}
                />
              )}

              {activeTab === "videos" && (
                <VideosWall
                  pageId={data.page.id}
                  videos={videos.map((v) => ({
                    id: v.id,
                    media_type: v.media_type,
                    media_url: v.media_url,
                    description: undefined,
                    thumbnail_url: undefined,
                    created_at: v.created_at,
                  }))}
                  loading={false}
                  isOwner={isOwner}
                  selectedYear="all"
                  onVideoAdded={() => {
                    router.refresh();
                  }}
                />
              )}

              {activeTab === "prayer-wall" && (
                <PrayerWall
                  pageId={data.page.id}
                  userId={null}
                />
              )}
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
      </div>
    </div>
  );
}

