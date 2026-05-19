"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { PrayerForm } from "./PrayerForm";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";
import { PrayerUpdateModal } from "./PrayerUpdateModal";
import { PrayerViewModal } from "./PrayerViewModal";
import { PrayerCard } from "./PrayerCard";
import {
  createPrayer,
  updatePrayer,
  deletePrayer,
  getPrayerUpdatesForPage,
  type Prayer,
  type PrayerFormData,
  type PrayerWallItem,
} from "@/lib/prayerActions";
import toast from "react-hot-toast";

type PrayerWallProps = {
  pageId: number;
  pageUrl?: string;
  focusItemId?: number;
  onFocusChange?: (focus: string | null) => void;
  userId?: string | null;
  isOwner?: boolean;
};

export function PrayerWall({
  pageId,
  pageUrl,
  focusItemId,
  onFocusChange,
  userId,
  isOwner = false,
}: PrayerWallProps) {
  const [prayerItems, setPrayerItems] = useState<PrayerWallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingPrayer, setEditingPrayer] = useState<Prayer | null>(null);
  const [selectedPrayer, setSelectedPrayer] = useState<Prayer | null>(null);
  const [viewingPrayer, setViewingPrayer] = useState<Prayer | null>(null);
  const [deletingPrayerId, setDeletingPrayerId] = useState<number | null>(null);
  const [prayerPostFb, setPrayerPostFb] = useState(false);
  const [prayerPostIg, setPrayerPostIg] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPrayerUpdates = async () => {
      setLoading(true);
      const result = await getPrayerUpdatesForPage(pageId, userId || null);
      
      if (cancelled) return;
      
      if (result.success && result.data) {
        setPrayerItems(result.data);
      } else {
        toast.error(result.error || "Failed to load prayers");
      }
      setLoading(false);
    };

    loadPrayerUpdates();

    return () => {
      cancelled = true;
    };
  }, [pageId, userId]);

  useEffect(() => {
    const handleContentUpdate = async () => {
      const result = await getPrayerUpdatesForPage(pageId, userId || null);
      if (result.success && result.data) {
        setPrayerItems(result.data);
      }
    };

    window.addEventListener("content-updated", handleContentUpdate);

    return () => {
      window.removeEventListener("content-updated", handleContentUpdate);
    };
  }, [pageId, userId]);

  const handleCreate = () => {
    setEditingPrayer(null);
    setPrayerPostFb(false);
    setPrayerPostIg(false);
    setIsFormOpen(true);
  };

  const handleEdit = (prayer: Prayer) => {
    setEditingPrayer(prayer);
    setIsFormOpen(true);
  };

  const handleDelete = (prayerId: number) => {
    setDeletingPrayerId(prayerId);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (formData: PrayerFormData) => {
    if (editingPrayer) {
      const result = await updatePrayer(editingPrayer.id, formData);
      if (result.success) {
        toast.success("Prayer updated successfully");
        setEditingPrayer(null);
        const userIdToUse = userId;
        const loadResult = await getPrayerUpdatesForPage(pageId, userIdToUse);
        if (loadResult.success && loadResult.data) {
          setPrayerItems(loadResult.data);
        }
      } else {
        toast.error(result.error || "Failed to update prayer");
        throw new Error(result.error || "Failed to update prayer");
      }
    } else {
      const result = await createPrayer(pageId, formData, {
        postToFacebook: prayerPostFb,
        postToInstagram: prayerPostIg,
      });
      if (result.success) {
        toast.success("Prayer request added successfully");
        setPrayerPostFb(false);
        setPrayerPostIg(false);
        const userIdToUse = userId;
        const loadResult = await getPrayerUpdatesForPage(pageId, userIdToUse);
        if (loadResult.success && loadResult.data) {
          setPrayerItems(loadResult.data);
        }
      } else {
        toast.error(result.error || "Failed to create prayer");
        throw new Error(result.error || "Failed to create prayer");
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPrayerId) return;

    const result = await deletePrayer(deletingPrayerId);
    if (result.success) {
      toast.success("Prayer deleted successfully");
      setIsDeleteModalOpen(false);
      setDeletingPrayerId(null);
      const userIdToUse = userId;
      const loadResult = await getPrayerUpdatesForPage(pageId, userIdToUse);
      if (loadResult.success && loadResult.data) {
        setPrayerItems(loadResult.data);
      }
    } else {
      toast.error(result.error || "Failed to delete prayer");
    }
  };

  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focusItemId || loading || focusHandled.current) return;
    const item = prayerItems.find((pi) => pi.prayer.id === focusItemId);
    if (item) {
      focusHandled.current = true;
      setViewingPrayer(item.prayer);
      setIsViewModalOpen(true);
    }
  }, [focusItemId, prayerItems, loading]);

  const handleUpdate = (prayer: Prayer) => {
    setSelectedPrayer(prayer);
    setIsUpdateModalOpen(true);
  };

  const handleView = (prayer: Prayer) => {
    setViewingPrayer(prayer);
    setIsViewModalOpen(true);
    onFocusChange?.(`prayers-${prayer.id}`);
  };

  return (
    <>
      <section className=" md:px-4 pb-10 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Prayer Request</h2>
          {isOwner ? (
            <Button
              onClick={handleCreate}
              className="bg-[#E1B94D] text-black hover:bg-[#d4a639]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Prayer Request
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-[#1a1a1a] h-[240px] flex flex-col animate-pulse"
              >
                <div className="shrink-0 flex items-center justify-between p-3 border-b border-white/10">
                  <div className="h-3 w-24 bg-white/10 rounded" />
                </div>
                <div className="flex-1 min-h-0 p-3 space-y-2">
                  <div className="h-3 w-full bg-white/10 rounded" />
                  <div className="h-3 w-full bg-white/10 rounded" />
                  <div className="h-3 w-3/4 bg-white/10 rounded" />
                </div>
                {isOwner && (
                  <div className="shrink-0 flex items-center gap-2 border-t border-white/10 p-2">
                    <div className="flex-1 h-7 bg-white/10 rounded" />
                    <div className="flex-1 h-7 bg-white/10 rounded" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : prayerItems.length === 0 ? (
          <div className="py-10 text-center text-[#a0a0a0]">
            No prayer requests yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {prayerItems.map((item) => (
              <div key={item.id} id={`missionary-content-prayers-${item.prayer.id}`}>
                <PrayerCard
                  prayer={item.prayer}
                  pageUrl={pageUrl}
                  isOwner={isOwner}
                  onEdit={() => handleEdit(item.prayer)}
                  onDelete={() => handleDelete(item.prayer.id)}
                  onUpdate={() => handleUpdate(item.prayer)}
                  onView={() => handleView(item.prayer)}
                  displayContent={item.content}
                  displayDate={item.date}
                  hasUpdates={item.isUpdate}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <PrayerForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPrayer(null);
          setPrayerPostFb(false);
          setPrayerPostIg(false);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingPrayer}
        footerSlot={
          !editingPrayer && isOwner ? (
            <SocialCrossPostCheckboxes
              pageId={pageId}
              contentMode="text-only"
              postToFacebook={prayerPostFb}
              postToInstagram={prayerPostIg}
              onChangeFacebook={setPrayerPostFb}
              onChangeInstagram={setPrayerPostIg}
              disabled={false}
            />
          ) : null
        }
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingPrayerId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Prayer Request"
        message="Are you sure you want to delete this prayer request? This action cannot be undone."
      />

      {selectedPrayer && (
        <PrayerUpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => {
            setIsUpdateModalOpen(false);
            setSelectedPrayer(null);
          }}
          prayer={selectedPrayer}
          pageUrl={pageUrl}
          isOwner={isOwner}
          onPrayerUpdate={async () => {
            const userIdToUse = userId;
            const loadResult = await getPrayerUpdatesForPage(pageId, userIdToUse);
            if (loadResult.success && loadResult.data) {
              setPrayerItems(loadResult.data);
            }
          }}
        />
      )}

      {viewingPrayer && (
        <PrayerViewModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingPrayer(null);
            onFocusChange?.(null);
          }}
          prayer={viewingPrayer}
          onPrayerUpdate={async () => {
            const userIdToUse = userId;
            const loadResult = await getPrayerUpdatesForPage(pageId, userIdToUse);
            if (loadResult.success && loadResult.data) {
              setPrayerItems(loadResult.data);
            }
          }}
        />
      )}
    </>
  );
}

