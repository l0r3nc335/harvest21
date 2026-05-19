"use client";

import { useState, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { compressImage } from "@/lib/mediaCompressionService";
import { uploadPageMedia, uploadFileToStorage } from "@/lib/pageActions";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";
import toast from "react-hot-toast";

type PhotoUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pageId: number;
  onSuccess: () => void;
};

export function PhotoUploadModal({
  isOpen,
  onClose,
  pageId,
  onSuccess,
}: PhotoUploadModalProps) {
  const [photoDescription, setPhotoDescription] = useState("");
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [postToInstagram, setPostToInstagram] = useState(false);

  const photoPreviewUrl = useMemo(() => {
    return selectedPhotoFile ? URL.createObjectURL(selectedPhotoFile) : null;
  }, [selectedPhotoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPhotoFile(null);
      setPhotoDescription("");
      setPostToFacebook(false);
      setPostToInstagram(false);
    }
  }, [isOpen]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        setSelectedPhotoFile(acceptedFiles[0]);
      }
    },
    onDropRejected: () => {
      toast.error("Please drop a valid image file");
    },
  });

  const handleSubmit = async () => {
    if (!selectedPhotoFile) {
      toast.error("Please select a photo file");
      return;
    }

    setUploading(true);

    try {
      const fileSizeMB = selectedPhotoFile.size / (1024 * 1024);
      const needsCompression = fileSizeMB > 20;

      let photoToUpload: File;
      if (needsCompression) {
        photoToUpload = await compressImage(selectedPhotoFile);
      } else {
        photoToUpload = selectedPhotoFile;
      }

      const response = await fetch("/api/get-page-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch page data");
      }

      const pageData = await response.json();
      const { organization_type, organization_id } = pageData;

      if (!organization_type || !organization_id) {
        throw new Error("Invalid page data");
      }

      const uploadResult = await uploadFileToStorage(
        organization_type,
        organization_id,
        "media",
        photoToUpload,
        null
      );

      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || "Failed to upload photo");
      }

      const truncatedDescription = photoDescription.length > 250 
        ? photoDescription.substring(0, 250) 
        : photoDescription;

      const mediaResult = await uploadPageMedia(
        pageId,
        uploadResult.publicUrl,
        "image",
        truncatedDescription || undefined,
        undefined,
        undefined,
        {
          postToFacebook,
          postToInstagram,
        }
      );

      if (!mediaResult.success) {
        throw new Error(mediaResult.message || "Failed to save photo");
      }

      onSuccess();
      onClose();
      setTimeout(() => {
        toast.success("Photo uploaded successfully!");
      }, 200);
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload photo"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Photo"
      size="md"
      variant="dark"
    >
      <div className="flex flex-col max-h-[calc(90vh-120px)] overflow-y-auto scrollbar-yellow p-4 space-y-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="mb-2 text-sm text-white">Upload a photo</p>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed flex items-center justify-center transition-colors overflow-hidden p-6 sm:p-8 min-h-[220px] sm:min-h-[300px] max-h-[55vh] sm:max-h-[420px] w-full ${
                isDragActive
                  ? "border-[#E1B94D] bg-[#E1B94D]/10"
                  : "border-white/20 bg-[#0a0a0a] hover:border-white/30"
              } ${selectedPhotoFile ? "p-2" : "p-8"}`}
            >
              <input {...getInputProps()} />
              {selectedPhotoFile ? (
                <div className="relative w-full h-full max-h-[45vh] sm:max-h-[320px] flex items-center justify-center overflow-hidden rounded">
                  {photoPreviewUrl && (
                    <div className="relative w-full h-full max-h-[45vh] sm:max-h-[320px] flex items-center justify-center">
                      <Image
                        src={photoPreviewUrl}
                        alt="Preview"
                        width={800}
                        height={600}
                        className="max-h-full max-w-full h-auto w-auto object-contain rounded"
                        unoptimized
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoFile(null);
                    }}
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2 border-white/20 bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 z-10"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="text-sm text-white">
                    Drag and drop a photo here, or click to select
                  </p>
                  <p className="text-xs text-[#a0a0a0]">
                    PNG, JPG, GIF, WEBP up to 20MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-2">
            <label className="mb-1.5 block text-sm text-white">Description (Optional)</label>
            <Input
              type="text"
              value={photoDescription}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 250) {
                  setPhotoDescription(value);
                } else {
                  setPhotoDescription(value.substring(0, 250));
                }
              }}
              placeholder="Add a description..."
              maxLength={250}
              className="w-full border-white/20 bg-[#0a0a0a] text-white placeholder:text-[#a0a0a0] focus:border-[#E1B94D]"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs ${photoDescription.length >= 250 ? "text-red-400" : "text-[#a0a0a0]"}`}>
                  {photoDescription.length}/250 characters
                </span>
                {photoDescription.length >= 250 && (
                  <span className="text-xs font-medium text-red-400">
                    (Limit reached)
                  </span>
                )}
              </div>
              {photoDescription.length >= 250 && (
                <span className="text-xs text-red-400 font-medium">
                  Maximum length reached
                </span>
              )}
            </div>
          </div>
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

        <div className="flex flex-col gap-3 pt-4 border-t border-white/10 shrink-0 sm:flex-row sm:justify-end sm:items-center">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            className="w-full border-white/20 bg-transparent text-white hover:bg-white/5 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedPhotoFile || uploading}
            className="w-full bg-[#E1B94D] px-8 text-black hover:bg-[#d4a639] disabled:opacity-50 sm:w-auto"
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

