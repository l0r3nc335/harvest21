"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { ShareSheet } from "@/components/ui/ShareSheet";
import { Edit, Trash2, Share2 } from "lucide-react";
import {
  getPrayerUpdates,
  createPrayerUpdate,
  updatePrayerUpdate,
  deletePrayerUpdate,
  togglePrayerReaction,
  sharePrayer,
  type PrayerUpdate,
} from "@/lib/prayerActions";
import toast from "react-hot-toast";
import type { Prayer } from "@/lib/prayerActions";

type PrayerUpdateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  prayer: Prayer;
  pageUrl?: string;
  isOwner: boolean;
  onPrayerUpdate?: () => void;
};

export function PrayerUpdateModal({
  isOpen,
  onClose,
  prayer,
  pageUrl,
  isOwner,
  onPrayerUpdate,
}: PrayerUpdateModalProps) {
  const [updates, setUpdates] = useState<PrayerUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateText, setUpdateText] = useState("");
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUpdateId, setDeletingUpdateId] = useState<number | null>(null);
  const [localAmenCount, setLocalAmenCount] = useState<number | null>(null);
  const [localHasUserReacted, setLocalHasUserReacted] = useState<boolean | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const previousPrayerIdRef = useRef<number | null>(null);

  const shareUrl = pageUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${pageUrl}?tab=prayer-wall&focus=prayers-${prayer.id}`
    : "";

  const displayAmenCount = localAmenCount ?? prayer.amen_count;
  const displayHasUserReacted = localHasUserReacted ?? (prayer.has_user_reacted || false);

  const loadUpdates = async () => {
    setLoading(true);
    const result = await getPrayerUpdates(prayer.id);
    if (result.success && result.data) {
      const sorted = [...result.data].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setUpdates(sorted);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("prayer-updated"));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen || !prayer) return;
    
    if (previousPrayerIdRef.current !== prayer.id) {
      setLocalAmenCount(null);
      setLocalHasUserReacted(null);
      previousPrayerIdRef.current = prayer.id;
    }
    
    let cancelled = false;
    
    const fetchUpdates = async () => {
      setLoading(true);
      const result = await getPrayerUpdates(prayer.id);
      if (cancelled) return;
      if (result.success && result.data) {
        const sorted = [...result.data].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setUpdates(sorted);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("prayer-updated"));
        }
      }
      setLoading(false);
    };
    
    fetchUpdates();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prayer.id]);

  const handlePostUpdate = async () => {
    if (!updateText.trim()) return;

    const result = await createPrayerUpdate(prayer.id, updateText);
    if (result.success) {
      toast.success("Update posted successfully");
      setUpdateText("");
      loadUpdates();
      onPrayerUpdate?.();
    } else {
      toast.error(result.error || "Failed to post update");
    }
  };

  const handleEditUpdate = (update: PrayerUpdate) => {
    setEditingUpdateId(update.id);
    setEditingText(update.body);
  };

  const handleSaveEdit = async () => {
    if (!editingUpdateId || !editingText.trim()) return;

    const result = await updatePrayerUpdate(editingUpdateId, editingText);
    if (result.success) {
      toast.success("Update edited successfully");
      setEditingUpdateId(null);
      setEditingText("");
      loadUpdates();
    } else {
      toast.error(result.error || "Failed to edit update");
    }
  };

  const handleDelete = (updateId: number) => {
    setDeletingUpdateId(updateId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUpdateId) return;

    const result = await deletePrayerUpdate(deletingUpdateId);
    if (result.success) {
      toast.success("Update deleted successfully");
      setIsDeleteModalOpen(false);
      setDeletingUpdateId(null);
      loadUpdates();
      onPrayerUpdate?.();
    } else {
      toast.error(result.error || "Failed to delete update");
    }
  };

  const handleReaction = async () => {
    const result = await togglePrayerReaction(prayer.id);
    if (result.success && result.data) {
      setLocalAmenCount(result.data.amen_count);
      setLocalHasUserReacted(result.data.has_reacted);
    } else {
      toast.error(result.error || "Failed to react to prayer");
    }
  };

  const handleShare = async () => {
    await sharePrayer(prayer.id);
    if (pageUrl) {
      setIsShareOpen(true);
    } else {
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Update A Prayer Request"
        size="lg"
        variant="dark"
      >
        <div className="flex flex-col max-h-[calc(90vh-120px)] overflow-y-auto scrollbar-yellow p-4 space-y-6">
          <div className="rounded-lg border border-white/10 bg-[#0a0a0a] p-4 space-y-3">
            <p className="mb-3 text-sm text-white">Write an update to a prayer request</p>
            <textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="Type something"
              rows={5}
              className="w-full rounded-lg border border-white/20 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-[#a0a0a0] focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 resize-none"
            />
            <div className="flex flex-col gap-2 justify-center sm:flex-row sm:justify-end sm:items-center">
              <Button
                onClick={handlePostUpdate}
                disabled={!updateText.trim()}
                className="w-full bg-[#E1B94D] px-8 text-black hover:bg-[#d4a639] disabled:opacity-50 sm:w-auto"
              >
                Post Update
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Updates {updates.length > 0 && `(${updates.length})`}
            </h3>
            {loading ? (
              <div className="text-center text-[#a0a0a0] py-8">Loading updates...</div>
            ) : updates.length === 0 ? (
              <div className="text-center text-[#a0a0a0] py-8">No updates yet.</div>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm text-[#a0a0a0]">
                        {formatDate(update.created_at)}
                      </span>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleReaction}
                          className="flex items-center gap-1.5 text-[#E1B94D] transition-colors hover:text-[#d4a639]"
                        >
                          <span className={`text-base ${displayHasUserReacted ? "opacity-100" : "opacity-70"}`}>
                            🙏
                          </span>
                          <span className="text-sm font-medium">
                            {displayAmenCount}
                          </span>
                        </button>
                        <button
                          onClick={handleShare}
                          className="text-[#E1B94D] transition-colors hover:text-[#d4a639]"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {editingUpdateId === update.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-white/20 bg-[#0a0a0a] px-4 py-3 text-sm text-white focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            onClick={handleSaveEdit}
                            size="sm"
                            className="w-full bg-[#E1B94D] text-black hover:bg-[#d4a639] sm:w-auto"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingUpdateId(null);
                              setEditingText("");
                            }}
                            variant="secondary"
                            size="sm"
                            className="w-full border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 sm:w-auto"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mb-3 text-sm leading-relaxed text-white whitespace-pre-wrap">
                          {update.body}
                        </p>
                        {isOwner && (
                          <div className="flex gap-2 border-t border-white/10 pt-3">
                            <Button
                              onClick={() => handleEditUpdate(update)}
                              variant="secondary"
                              size="sm"
                              className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white"
                            >
                              <Edit className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDelete(update.id)}
                              variant="secondary"
                              size="sm"
                              className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingUpdateId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Update"
        message="Are you sure you want to delete this update? This action cannot be undone."
      />

      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={shareUrl}
        title={prayer.title || prayer.body.slice(0, 80)}
      />
    </>
  );
}

