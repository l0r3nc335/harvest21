"use client";

import { useState } from "react";
import { HomepageBanner } from "@/types/homepage";
import { Edit, Trash2, Plus, Eye, EyeOff, GripVertical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteBanner, toggleBannerActive, reorderBanners } from "@/app/admin/homepage-settings/actions";
import toast from "react-hot-toast";
import Image from "next/image";

type BannerListTabProps = {
  banners: HomepageBanner[];
  onEdit: (banner: HomepageBanner) => void;
  onCreate: () => void;
};

const MAX_BANNERS = 8;

export function BannerListTab({ banners, onEdit, onCreate }: BannerListTabProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [localBanners, setLocalBanners] = useState(banners);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setLoading(id);
    const result = await deleteBanner(id);

    if (result.success) {
      toast.success("Banner deleted successfully");
      setDeleteConfirmId(null);
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to delete banner");
    }
    setLoading(null);
  };

  const handleToggleActive = async (id: number, currentState: boolean) => {
    setLoading(id);
    const result = await toggleBannerActive(id, !currentState);

    if (result.success) {
      toast.success(`Banner ${!currentState ? "activated" : "deactivated"}`);
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to update banner");
    }
    setLoading(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newBanners = [...localBanners];
    const draggedBanner = newBanners[draggedIndex];
    newBanners.splice(draggedIndex, 1);
    newBanners.splice(index, 0, draggedBanner);

    setLocalBanners(newBanners);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    const bannerIds = localBanners.map((b) => b.id);
    const result = await reorderBanners(bannerIds);

    if (result.success) {
      toast.success("Banners reordered successfully");
    } else {
      toast.error(result.error || "Failed to reorder banners");
      setLocalBanners(banners);
    }

    setDraggedIndex(null);
  };

  const isMaxBanners = localBanners.length >= MAX_BANNERS;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Banner List</h2>
          <p className="text-sm text-zinc-600 mt-1">
            Manage homepage banner slides. Drag to reorder. Maximum {MAX_BANNERS} banners.
          </p>
        </div>
        <Button 
          onClick={onCreate} 
          className="flex items-center gap-2"
          disabled={isMaxBanners}
        >
          <Plus className="w-4 h-4" />
          Add Banner {localBanners.length}/{MAX_BANNERS}
        </Button>
      </div>

      {isMaxBanners && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Maximum of {MAX_BANNERS} banners reached. Delete a banner to add a new one.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {localBanners.map((banner, index) => (
          <div
            key={banner.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`bg-white border rounded-lg p-4 cursor-move hover:shadow-md transition-shadow ${
              !banner.is_active ? "opacity-60" : ""
            }`}
          >
            <div className="flex gap-4">
              <div className="flex items-center text-zinc-400">
                <GripVertical className="w-5 h-5" />
              </div>

              <div className="relative w-32 h-20 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={banner.image_url}
                  alt={banner.location}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900">{banner.location}</h3>
                    <p className="text-sm text-zinc-600 line-clamp-2 mt-1">
                      {banner.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                      <span>Order: {banner.display_order}</span>
                      <span>Duration: {banner.scroll_duration}ms</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(banner.id, banner.is_active)}
                      disabled={loading === banner.id}
                      className="p-2 text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
                      title={banner.is_active ? "Deactivate" : "Activate"}
                    >
                      {banner.is_active ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => onEdit(banner)}
                      disabled={loading === banner.id}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(banner.id)}
                      disabled={loading === banner.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {localBanners.length === 0 && (
          <div className="text-center py-12 bg-zinc-50 rounded-lg">
            <p className="text-zinc-600">No banners yet. Create your first banner!</p>
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Delete Banner</h3>
                <p className="text-sm text-zinc-600 mt-1">
                  Are you sure you want to delete this banner? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button
                onClick={() => setDeleteConfirmId(null)}
                variant="secondary"
                disabled={loading === deleteConfirmId}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={loading === deleteConfirmId}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading === deleteConfirmId ? "Deleting..." : "Delete Banner"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

