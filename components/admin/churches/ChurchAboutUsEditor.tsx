"use client";

import { useState, useRef, useEffect } from "react";
import { Save, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import toast from "react-hot-toast";
import { deleteFileFromStorage } from "@/app/admin/missionaries/[id]/actions";
import { updatePageDetails } from "@/lib/pageActions";
import type { ChurchAboutUsContent } from "@/types/church";

interface ChurchAboutUsEditorProps {
  churchId: number;
  pageId?: number | null;
  pageName: string;
  pageUrl: string;
  shortQuote: string;
  onShortQuoteChange: (value: string) => void;
  initialContent?: ChurchAboutUsContent | null;
  initialVideoHashedId?: string | null;
  onSave?: (content: ChurchAboutUsContent, videoHashedId: string | null) => void;
}

// Fixed sections as per CHLP-004
const FIXED_SECTIONS = [
  { key: "who_we_are", label: "Personal Bio", placeholder: "Tell visitors about your church's identity and community..." },
  { key: "our_mission", label: "Our Mission", placeholder: "Describe your church's mission and calling..." },
  { key: "our_vision", label: "Our Vision", placeholder: "Share your vision for the future..." },
  { key: "what_we_believe", label: "What We Believe", placeholder: "Outline your core beliefs and doctrine..." },
  { key: "our_ministries", label: "Our Ministries", placeholder: "Describe the ministries and programs you offer..." },
  { key: "join_us", label: "Join Us", placeholder: "Invite people to join your community..." },
  { key: "contact_us", label: "Contact Us", placeholder: "Provide contact information and service times..." },
] as const;

export function ChurchAboutUsEditor({
  churchId,
  pageName,
  pageUrl,
  shortQuote,
  onShortQuoteChange,
  initialContent,
  initialVideoHashedId,
  onSave,
}: ChurchAboutUsEditorProps) {
  // Initialize content state
  const [content, setContent] = useState<ChurchAboutUsContent>({
    who_we_are: initialContent?.who_we_are || "",
    our_mission: initialContent?.our_mission || "",
    our_vision: initialContent?.our_vision || "",
    what_we_believe: initialContent?.what_we_believe || "",
    our_ministries: initialContent?.our_ministries || "",
    join_us: initialContent?.join_us || "",
    contact_us: initialContent?.contact_us || "",
  });

  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoHashedId || null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Check if all required sections are completed (CHLP-006)
  // Exclude "who_we_are" (Personal Bio) from completion check as it's hidden
  const allSectionsComplete = FIXED_SECTIONS.filter(section => section.key !== "who_we_are").every(
    (section) => content[section.key as keyof ChurchAboutUsContent]?.trim().length > 0
  );

  const handleContentChange = (key: keyof ChurchAboutUsContent, value: string) => {
    setContent((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a valid video file");
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Video file is too large. Maximum size is 500MB");
      return;
    }

    // Clean up previous preview URL
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    // Create preview URL for selected video
    const previewUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(previewUrl);
    setVideoFile(file);
    toast.success("Video selected. Click 'Save' to upload.");
  };

  const handleVideoRemove = () => {
    if (videoUrl) {
      setVideoToDelete(videoUrl);
    }
    // Clean up preview URL
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setVideoFile(null);
    setVideoUrl(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const handleUploadVideo = async (): Promise<string | null> => {
    if (!videoFile) return videoUrl;

    setUploadingVideo(true);
    setUploadProgress(0);

    try {
      // Delete old video if exists
      if (videoToDelete) {
        await deleteFileFromStorage(videoToDelete);
        setVideoToDelete(null);
      }

      setUploadProgress(5);

      // Get signed upload URL
      const signedRes = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationType: "church",
          organizationId: churchId,
          fileName: videoFile.name,
          folder: "videos",
        }),
      });

      if (!signedRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { signedUrl, publicUrl } = await signedRes.json();

      // Upload video with progress tracking
      const uploadResult = await new Promise<{ success: boolean; publicUrl?: string; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 95);
            setUploadProgress(5 + percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, publicUrl });
          } else {
            resolve({ success: false, error: `Upload failed with status ${xhr.status}` });
          }
        });

        xhr.addEventListener("error", () => {
          resolve({ success: false, error: "Network error during upload" });
        });

        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.send(videoFile);
      });

      if (uploadResult.success && uploadResult.publicUrl) {
        setVideoUrl(uploadResult.publicUrl);
        setVideoFile(null);
        // Clean up preview URL
        if (videoPreviewUrl) {
          URL.revokeObjectURL(videoPreviewUrl);
          setVideoPreviewUrl(null);
        }
        if (videoInputRef.current) {
          videoInputRef.current.value = "";
        }
        toast.success("Video uploaded successfully!");
        return uploadResult.publicUrl;
      } else {
        throw new Error(uploadResult.error || "Failed to upload video");
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload video");
      return null;
    } finally {
      setUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    // Validate all sections are filled (CHLP-006)
    if (!allSectionsComplete) {
      toast.error("Please complete all sections before saving");
      return;
    }

    setIsSaving(true);

    try {
      // Upload video if there's a pending file
      let finalVideoUrl = videoUrl;
      if (videoFile) {
        finalVideoUrl = await handleUploadVideo();
        if (!finalVideoUrl && videoFile) {
          throw new Error("Failed to upload video");
        }
      }

      // Save about us content, short quote, pageName, and pageUrl together
      const templateContent = JSON.stringify(content);
      const result = await updatePageDetails("church", churchId, {
        pageName: pageName.trim(), // Save pageName to pages.name column
        pageUrl: pageUrl.trim(), // Save pageUrl to pages.page_url column
        templateContent,
        videoHashedId: finalVideoUrl,
        shortQuote: shortQuote?.trim() || undefined,
      });

      if (result.success) {
        toast.success("Church page saved successfully!");
        onSave?.(content, finalVideoUrl);
      } else {
        throw new Error(result.message || "Failed to save content");
      }
    } catch (error) {
      console.error("Error saving church about us:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save content");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay - Same as missionaries */}
      {(isSaving || uploadingVideo) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {uploadingVideo ? `Uploading video... ${uploadProgress}%` : "Saving your changes..."}
            </p>
            {uploadingVideo && (
              <div className="w-48 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Background Video - At the top, exactly like missionaries */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-white mb-1">
          Background Video
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
          Upload Ministry Video Here (Optional)
        </p>

        {!videoUrl && !videoFile && (
          <div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="hidden"
            />
            <div
              onClick={() => videoInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-16 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors bg-zinc-50 dark:bg-zinc-900"
            >
              <Upload className="h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Click to upload video
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                MP4, MOV, WebM (max 100MB)
              </p>
            </div>
          </div>
        )}

        {videoFile && videoPreviewUrl && (
          <div className="relative aspect-video w-full max-w-2xl rounded-lg overflow-hidden bg-zinc-900">
            <video
              src={videoPreviewUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
              Pending Upload
            </div>
            <button
              type="button"
              onClick={handleVideoRemove}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {videoUrl && !videoFile && (
          <div className="relative aspect-video w-full max-w-2xl rounded-lg overflow-hidden bg-zinc-900">
            <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              playsInline
            />
            <button
              type="button"
              onClick={handleVideoRemove}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* All 7 Fixed Sections - Exclude "who_we_are" (Personal Bio) from display */}
      {FIXED_SECTIONS.filter(section => section.key !== "who_we_are").map((section) => (
        <div key={section.key} className="space-y-4">
            <div className="bg-zinc-50 rounded-lg border dark:bg-zinc-800 text-zinc-900 dark:text-white p-4">
            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
            This title cannot be edited
          </label>
          <h2
            className="font-semibold m-0"
          >{section.label}</h2>
            </div>
    
          <Textarea
            value={content[section.key as keyof ChurchAboutUsContent]}
            onChange={(e) =>
              handleContentChange(section.key as keyof ChurchAboutUsContent, e.target.value)
            }
            placeholder={section.placeholder}
            rows={8}
            className="w-full"
          />
        </div>
      ))}

      {/* Completion Status (CHLP-006) */}
      {!allSectionsComplete && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ All sections must be completed before saving.
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || uploadingVideo || !allSectionsComplete}
          className="flex items-center gap-2"
        >
          {isSaving || uploadingVideo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadingVideo ? "Uploading..." : "Saving..."}
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
  );
}

