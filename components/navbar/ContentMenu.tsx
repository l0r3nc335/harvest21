"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, FileText, Image, Video, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UpdateLetterUploadModal } from "@/components/update-letter/UpdateLetterUploadModal";
import { PhotoUploadModal } from "@/components/photo/PhotoUploadModal";
import { VideoUploadModal } from "@/components/video/VideoUploadModal";
import { PrayerForm } from "@/components/prayer/PrayerForm";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";
import { createPrayer, type PrayerFormData } from "@/lib/prayerActions";
import toast from "react-hot-toast";

type ContentMenuProps = {
  onSuccess?: () => void;
  pageId?: number | null;
  isLoadingPageId?: boolean;
};

export function ContentMenu({ onSuccess, pageId = null, isLoadingPageId = false }: ContentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [prayerPostFb, setPrayerPostFb] = useState(false);
  const [prayerPostIg, setPrayerPostIg] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleOpenLetter = () => {
    setIsOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setIsLetterModalOpen(true);
  };

  const handleOpenPhoto = () => {
    setIsOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setIsPhotoModalOpen(true);
  };

  const handleOpenVideo = () => {
    setIsOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setIsVideoModalOpen(true);
  };

  const handleOpenPrayer = () => {
    setIsOpen(false);
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }
    setPrayerPostFb(false);
    setPrayerPostIg(false);
    setIsPrayerModalOpen(true);
  };

  const handlePrayerSubmit = async (formData: PrayerFormData) => {
    if (!pageId) {
      toast.error("Page not found. Please ensure you have a published page.");
      return;
    }

    const result = await createPrayer(pageId, formData, {
      postToFacebook: prayerPostFb,
      postToInstagram: prayerPostIg,
    });
    if (result.success) {
      setIsPrayerModalOpen(false);
      setPrayerPostFb(false);
      setPrayerPostIg(false);
      handleSuccess();
      setTimeout(() => {
        toast.success("Prayer request posted successfully!");
      }, 200);
    } else {
      toast.error(result.error || "Failed to post prayer request");
    }
  };

  const handleSuccess = () => {
    onSuccess?.();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("content-updated"));
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-4 py-2 text-sm font-semibold text-[#1A1A1A] hover:from-[#E6B800] hover:to-[#D4A639] shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 touch-manipulation"
        >
          <Plus className="h-4 w-4" />
          Upload 
        </Button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFD700]/10">
                  <Plus className="h-4 w-4 text-[#FFD700]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Upload Content</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Share updates with supporters</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
            <button
              onClick={handleOpenLetter}
              disabled={isLoadingPageId || !pageId}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-zinc-900 transition-all duration-200 hover:scale-[1.02] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:bg-blue-500/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white">Update Letter</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Share written updates</div>
                </div>
            </button>

            <button
              onClick={handleOpenPhoto}
              disabled={isLoadingPageId || !pageId}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-zinc-900 transition-all duration-200 hover:scale-[1.02] hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:bg-purple-500/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors shrink-0">
                  <Image className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white">Photos</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Upload photo galleries</div>
                </div>
            </button>

            <button
              onClick={handleOpenVideo}
              disabled={isLoadingPageId || !pageId}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-zinc-900 transition-all duration-200 hover:scale-[1.02] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:bg-red-500/10"
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors shrink-0">
                  <Video className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white">Videos</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Share video content</div>
                </div>
            </button>

            <button
              onClick={handleOpenPrayer}
              disabled={isLoadingPageId || !pageId}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-zinc-900 transition-all duration-200 hover:scale-[1.02] hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:bg-pink-500/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors shrink-0">
                  <Heart className="h-5 w-5 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white">Prayer Request</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Request prayer support</div>
                </div>
            </button>
            </div>
          </div>
        )}
      </div>

      {pageId && (
        <>
          <UpdateLetterUploadModal
            isOpen={isLetterModalOpen}
            onClose={() => setIsLetterModalOpen(false)}
            pageId={pageId}
            onSuccess={handleSuccess}
          />

          <PhotoUploadModal
            isOpen={isPhotoModalOpen}
            onClose={() => setIsPhotoModalOpen(false)}
            pageId={pageId}
            onSuccess={handleSuccess}
          />

          <VideoUploadModal
            isOpen={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
            pageId={pageId}
            onSuccess={handleSuccess}
          />

          <PrayerForm
            isOpen={isPrayerModalOpen}
            onClose={() => setIsPrayerModalOpen(false)}
            onSubmit={handlePrayerSubmit}
            footerSlot={
              <SocialCrossPostCheckboxes
                pageId={pageId}
                contentMode="text-only"
                postToFacebook={prayerPostFb}
                postToInstagram={prayerPostIg}
                onChangeFacebook={setPrayerPostFb}
                onChangeInstagram={setPrayerPostIg}
                disabled={false}
              />
            }
          />
        </>
      )}
    </>
  );
}

