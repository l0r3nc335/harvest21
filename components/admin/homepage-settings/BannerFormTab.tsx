"use client";

import { useState, useRef } from "react";
import { HomepageBanner, BannerFormData } from "@/types/homepage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ImageCropper } from "@/components/admin/ImageCropper";
import { createBanner, updateBanner, uploadBannerImage } from "@/app/admin/homepage-settings/actions";
import toast from "react-hot-toast";
import { RASTER_IMAGE_INPUT_ACCEPT } from "@/lib/uploadMimeValidation";
import Image from "next/image";

type BannerFormTabProps = {
  banner?: HomepageBanner | null;
  onSuccess: () => void;
  onCancel: () => void;
  maxOrder: number;
};

export function BannerFormTab({ banner, onSuccess, onCancel, maxOrder }: BannerFormTabProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(banner?.image_url || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<BannerFormData>({
    location: banner?.location || "",
    description: banner?.description || "",
    image_url: banner?.image_url || "",
    is_active: banner?.is_active ?? true,
    display_order: banner?.display_order || maxOrder + 1,
    scroll_duration: banner?.scroll_duration || 5000,
  });

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setCropperFile(file);
    setShowImageCropper(true);
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!cropperFile) return;

    const fileExtension = cropperFile.name.split(".").pop() || "jpg";
    const fileName = `cropped-banner-${cropperFile.name.replace(/\.[^.]+$/, "")}.${fileExtension}`;
    const croppedFile = new File([croppedBlob], fileName, {
      type: croppedBlob.type || "image/jpeg",
    });

    setShowImageCropper(false);
    setCropperFile(null);

    await handleFileUpload(croppedFile);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const result = await uploadBannerImage(file);

    if (result.success && result.url) {
      setFormData({ ...formData, image_url: result.url });
      setImagePreview(result.url);
      toast.success("Image uploaded successfully");
    } else {
      toast.error(result.error || "Failed to upload image");
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location || !formData.description || !formData.image_url) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    let result;
    if (banner) {
      result = await updateBanner(banner.id, formData);
    } else {
      result = await createBanner(formData);
    }

    if (result.success) {
      toast.success(`Banner ${banner ? "updated" : "created"} successfully`);
      onSuccess();
    } else {
      toast.error(result.error || `Failed to ${banner ? "update" : "create"} banner`);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-900">
          {banner ? "Edit Banner" : "Create New Banner"}
        </h2>
        <p className="text-sm text-zinc-600 mt-1">
          Fill in the banner details below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Location/Title *
              </label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Chile, South America"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Display Order *
              </label>
              <Input
                type="number"
                min="1"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) })
                }
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Description *
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter banner description..."
              rows={4}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Banner Image * (1920x1080px)
            </label>
            <div className="relative w-full rounded-lg overflow-hidden border" style={{ aspectRatio: "1920/1080" }}>
              {imagePreview ? (
                <>
                  <Image
                    src={imagePreview}
                    alt="Banner Preview"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-black/50 text-white hover:bg-black/70"
                    >
                      {uploading ? "Uploading..." : "Change"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setImagePreview("");
                        setFormData({ ...formData, image_url: "" });
                      }}
                      className="bg-black/50 text-white hover:bg-black/70"
                    >
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? "Uploading..." : "Upload Banner"}
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={RASTER_IMAGE_INPUT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  if (e.target) e.target.value = "";
                }}
                disabled={uploading}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Recommended: 1920x1080px. Images will be cropped to fit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Scroll Duration (ms)
              </label>
              <Input
                type="number"
                min="1000"
                step="100"
                value={formData.scroll_duration}
                onChange={(e) =>
                  setFormData({ ...formData, scroll_duration: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-zinc-500 mt-1">Time to display this slide (5000ms = 5s)</p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-brand-yellow rounded focus:ring-brand-yellow"
                />
                <span className="text-sm font-medium text-zinc-700">Active</span>
              </label>
              <p className="text-xs text-zinc-500 mt-1 ml-6">
                Show this banner on the homepage
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" disabled={loading || uploading}>
            {loading ? "Saving..." : banner ? "Update Banner" : "Create Banner"}
          </Button>
        </div>
      </form>

      {showImageCropper && cropperFile && (
        <ImageCropper
          file={cropperFile}
          aspectRatio={1920 / 1080}
          targetWidth={1920}
          targetHeight={1080}
          onCropComplete={handleCroppedImage}
          onCancel={() => {
            setShowImageCropper(false);
            setCropperFile(null);
          }}
          title="Crop Banner Image (1920x1080px)"
        />
      )}
    </div>
  );
}

