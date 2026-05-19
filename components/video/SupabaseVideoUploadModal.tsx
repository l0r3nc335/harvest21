"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";

type SupabaseVideoUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pageId: number;
  onSuccess: () => void;
};

export function SupabaseVideoUploadModal({
  isOpen,
  onClose,
  pageId,
  onSuccess,
}: SupabaseVideoUploadModalProps) {
  const [videoDescription, setVideoDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [postToInstagram, setPostToInstagram] = useState(false);
  const [organizationType, setOrganizationType] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoPreviewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile]
  );

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPostToFacebook(false);
      setPostToInstagram(false);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    }
  }, [isOpen, videoPreviewUrl]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch("/api/get-page-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        if (!res.ok) throw new Error("Failed to fetch page data");
        const data = await res.json();
        setOrganizationType(data?.organization_type || null);
        setOrganizationId(data?.organization_id || null);
      } catch (error) {
        console.error("Failed to load page data for upload", error);
        toast.error("Unable to load page details for upload");
      }
    })();
  }, [isOpen, pageId]);

  const handleClose = useCallback(() => {
    setVideoDescription("");
    setUploadProgress(0);
    setUploading(false);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setSelectedFile(null);
    onClose();
  }, [onClose, videoPreviewUrl]);

  const handleFileSelect = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file");
      return;
    }
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > 100) {
      toast.error("File exceeds 100MB limit.");
      return;
    }
    setSelectedFile(file);
  }, []);

  const generateThumbnail = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !selectedFile) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    });
  }, [selectedFile]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a video file");
      return;
    }
    if (!organizationType || !organizationId) {
      toast.error("Missing organization details for upload");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const thumbnailBlob = await generateThumbnail();

      const signedRes = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationType,
          organizationId,
          fileName: selectedFile.name,
        }),
      });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { signedUrl, publicUrl } = await signedRes.json();
      if (!signedUrl || !publicUrl) throw new Error("Upload URL response missing data");

      let thumbnailUrl: string | null = null;
      if (thumbnailBlob) {
        const thumbName = selectedFile.name.replace(/\.[^/.]+$/, "") + "_thumb.jpg";
        const thumbRes = await fetch("/api/storage/signed-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationType,
            organizationId,
            fileName: thumbName,
            folder: "thumbnails",
          }),
        });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          if (thumbData.signedUrl && thumbData.publicUrl) {
            await fetch(thumbData.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/jpeg" },
              body: thumbnailBlob,
            });
            thumbnailUrl = thumbData.publicUrl;
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed with status ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", selectedFile.type || "application/octet-stream");
        xhr.send(selectedFile);
      });

      const truncatedDescription =
        videoDescription.length > 250 ? videoDescription.substring(0, 250) : videoDescription;

      const saveRes = await fetch("/api/page-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          mediaUrl: publicUrl,
          description: truncatedDescription,
          thumbnailUrl,
          postToFacebook,
          postToInstagram,
        }),
      });
      const saveResult = await saveRes.json();
      if (!saveRes.ok || !saveResult.success) throw new Error(saveResult.message || "Failed to save video");

      toast.success("Video uploaded successfully!");
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload video");
    } finally {
      setUploading(false);
    }
  }, [
    selectedFile,
    organizationType,
    organizationId,
    pageId,
    videoDescription,
    postToFacebook,
    postToInstagram,
    onSuccess,
    handleClose,
    generateThumbnail,
  ]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Video"
      size="lg"
      variant="dark"
    >
      <div className="flex flex-col max-h-[calc(90vh-120px)] overflow-y-auto scrollbar-yellow p-4 space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-white">Upload a video</p>
          {!uploading ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed ${isDragging ? "border-[#E1B94D]" : "border-white/20"} bg-[#0a0a0a] transition-colors ${
                selectedFile ? "p-2" : "p-12"
              } ${selectedFile ? "flex items-center justify-center min-h-[300px]" : "text-center"}`}
            >
              {selectedFile && videoPreviewUrl ? (
                <div className="relative w-full h-full max-h-[400px] flex flex-col items-center justify-center gap-3">
                  <div className="relative w-full max-w-full max-h-[350px] flex items-center justify-center overflow-hidden rounded-lg">
                    <video
                      ref={videoRef}
                      src={videoPreviewUrl}
                      controls
                      className="max-h-[350px] max-w-full w-auto h-auto object-contain rounded"
                      style={{ maxHeight: "350px", maxWidth: "100%" }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoPreviewUrl) {
                          URL.revokeObjectURL(videoPreviewUrl);
                        }
                        setSelectedFile(null);
                      }}
                      variant="secondary"
                      size="sm"
                      className="border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white"
                    >
                      Change Video
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-white mb-3">Drag & drop or select a video (max 100MB)</p>
                  <div className="flex items-center justify-center gap-3">
                    <label className="relative inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white cursor-pointer hover:border-[#E1B94D] hover:text-[#E1B94D] transition-colors">
                      Choose file
                      <input
                        type="file"
                        accept="video/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#E1B94D]/30 bg-linear-to-br from-[#E1B94D]/10 to-[#E1B94D]/5 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {uploadProgress < 5 
                      ? "Initializing upload..." 
                      : uploadProgress >= 100 
                        ? "Processing video..." 
                        : uploadProgress > 96 
                          ? "Finalizing..." 
                          : "Uploading video..."}
                  </p>
                  <p className="text-xs text-[#a0a0a0] mt-0.5">
                    {uploadProgress < 100 ? "Please don't close this window" : "Almost done..."}
                  </p>
                </div>
                <span className="text-lg font-bold text-[#E1B94D]">{Math.round(uploadProgress)}%</span>
              </div>
              
              <div className="space-y-2">
                <div className="h-2.5 w-full rounded-full bg-[#0a0a0a]/50 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-linear-to-r from-[#E1B94D] to-[#f5c842] transition-all duration-300 ease-out rounded-full"
                    style={{ 
                      width: `${Math.max(uploadProgress, 1)}%`,
                      boxShadow: '0 0 12px rgba(225, 185, 77, 0.6)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <SocialCrossPostCheckboxes
          pageId={pageId}
          contentMode="media"
          postToFacebook={postToFacebook}
          postToInstagram={postToInstagram}
          onChangeFacebook={setPostToFacebook}
          onChangeInstagram={setPostToInstagram}
          disabled={uploading}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-white">
            Caption <span className="text-[#a0a0a0] font-normal">(Optional)</span>
          </label>
          <textarea
            value={videoDescription}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 250) {
                setVideoDescription(value);
              } else {
                setVideoDescription(value.substring(0, 250));
              }
            }}
            placeholder="Add a caption for this video..."
            rows={3}
            maxLength={250}
            disabled={uploading}
            className="w-full rounded-lg border border-white/20 bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-[#a0a0a0] focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${videoDescription.length >= 250 ? "text-red-400" : "text-[#a0a0a0]"}`}>
                {videoDescription.length}/250 characters
              </span>
              {videoDescription.length >= 250 && (
                <span className="text-xs font-medium text-red-400">
                  (Limit reached)
                </span>
              )}
            </div>
            {videoDescription.length >= 250 && (
              <span className="text-xs text-red-400 font-medium">
                Maximum length reached
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t border-white/10 sm:flex-row sm:justify-end sm:items-center">
          {!uploading && (
            <>
              <Button
                variant="secondary"
                onClick={handleClose}
                className="w-full border-white/20 bg-transparent text-white hover:bg-white/5 hover:border-white/30 transition-colors sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile}
                className="w-full bg-[#E1B94D] text-black hover:bg-[#f5c842] disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
              >
                Upload
              </Button>
            </>
          )}
          {uploading && (
            <p className="text-xs text-[#a0a0a0] self-center">
              Upload in progress...
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

