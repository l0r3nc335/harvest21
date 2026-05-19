"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { updatePhoto } from "@/lib/photoActions";
import toast from "react-hot-toast";

type EditPhotoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  photo: {
    id: number;
    description?: string | null;
  } | null;
  onSuccess: () => void;
  elevation?: "default" | "high";
  mediaType?: "photo" | "video";
};

export function EditPhotoModal({
  isOpen,
  onClose,
  photo,
  onSuccess,
  elevation = "default",
  mediaType = "photo",
}: EditPhotoModalProps) {
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (photo) {
      setDescription(photo.description || "");
    }
  }, [photo]);

  const handleSave = async () => {
    if (!photo) return;

    setIsSaving(true);
    try {
      const result = await updatePhoto(photo.id, description.trim() || null);
      if (result.success) {
        onSuccess();
        toast.success(mediaType === "video" ? "Video caption updated successfully!" : "Photo description updated successfully!");
        onClose();
      } else {
        toast.error(result.error || (mediaType === "video" ? "Failed to update video caption" : "Failed to update photo description"));
      }
    } catch (error) {
      console.error("Error updating photo:", error);
      toast.error("An error occurred while updating");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mediaType === "video" ? "Edit Video Caption" : "Edit Photo Description"}
      size="md"
      variant="dark"
      elevation={elevation}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-[#E1B94D] focus:ring-2 focus:ring-[#E1B94D]/20 min-h-[120px]"
            placeholder={mediaType === "video" ? "Enter video caption..." : "Enter photo description..."}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
            className="border-white/20 text-black hover:bg-white/90"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#E1B94D] text-black hover:bg-[#d4a639]"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

