"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Calendar, Eye, Heart, Share2, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { ShareSheet } from "@/components/ui/ShareSheet";
import toast from "react-hot-toast";
import { togglePhotoReaction, incrementPhotoView, sharePhoto, deletePhoto } from "@/lib/photoActions";

interface Photo {
  id: number;
  media_url: string;
  description?: string | null;
  created_at: string;
  view_count?: number;
  reaction_count?: number;
  share_count?: number;
  has_user_reacted?: boolean;
}

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  isOwner?: boolean;
  pageUrl?: string;
  onEdit?: (photo: Photo) => void;
  onDeleted?: () => void;
}

export function PhotoViewer({ 
  photos, 
  initialIndex, 
  onClose, 
  isOwner = false,
  pageUrl,
  onEdit,
  onDeleted 
}: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [photoUpdates, setPhotoUpdates] = useState<Record<number, Partial<Photo>>>({});

  const currentPhoto = photos[currentIndex] ? {
    ...photos[currentIndex],
    ...photoUpdates[photos[currentIndex].id],
  } : null;

  useEffect(() => {
    // Increment view count when photo changes
    if (photos[currentIndex]) {
      incrementPhotoView(photos[currentIndex].id);
    }
  }, [currentIndex, photos]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleReaction = async () => {
    if (isReacting || !currentPhoto) return;
    setIsReacting(true);
    const result = await togglePhotoReaction(currentPhoto.id);
    if (result.success && result.data) {
      setPhotoUpdates((prev) => ({
        ...prev,
        [currentPhoto.id]: {
          ...prev[currentPhoto.id],
          has_user_reacted: result.data!.has_reacted,
          reaction_count: result.data!.reaction_count,
        },
      }));
    } else {
      toast.error(result.error || "Failed to react");
    }
    setIsReacting(false);
  };

  const handleShare = async () => {
    if (!currentPhoto) return;
    await sharePhoto(currentPhoto.id);
    setPhotoUpdates((prev) => ({
      ...prev,
      [currentPhoto.id]: {
        ...prev[currentPhoto.id],
        share_count: (currentPhoto.share_count || 0) + 1,
      },
    }));
    setIsShareOpen(true);
  };

  const currentShareUrl = currentPhoto && pageUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${pageUrl}?tab=photos&focus=page_media-${currentPhoto.id}`
    : "";

  const handleDelete = async () => {
    if (!currentPhoto) return;
    const result = await deletePhoto(currentPhoto.id);
    if (result.success) {
      toast.success("Photo deleted successfully");
      setIsDeleteModalOpen(false);
      if (onDeleted) {
        onDeleted();
      }
      if (photos.length === 1) {
        onClose();
      } else {
        const newIndex = currentIndex >= photos.length - 1 ? currentIndex - 1 : currentIndex;
        setCurrentIndex(newIndex);
      }
    } else {
      toast.error(result.error || "Failed to delete photo");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
      }
      if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [onClose, photos.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white">
        <span className="text-sm">
          {currentIndex + 1} / {photos.length}
        </span>
      </div> */}

      {photos.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Next photo"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {currentPhoto && (
        <div
          className="relative h-[90vh] w-[90vw]"
          onClick={onClose}
        >
          <Image
            src={currentPhoto.media_url}
            alt={currentPhoto.description || `Photo ${currentIndex + 1}`}
            fill
            className="object-contain"
            sizes="90vw"
            priority
            quality={100}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Info Panel */}
      {currentPhoto && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/80 to-transparent p-8 max-w-full "
          onClick={(e) => e.stopPropagation()}
        >
          {currentPhoto.description && (
            <p className="mb-4 text-lg text-white/70 wrap-break-word whitespace-normal word-break-break-word max-w-full ">
              {currentPhoto.description}
            </p>
          )}
          
          <div className="mb-4 flex items-center gap-6 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(currentPhoto.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleShare}
              variant="secondary"
              size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/5"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            {isOwner && onEdit && (
              <Button
                onClick={() => onEdit(currentPhoto)}
                size="sm"
                className="bg-[#E1B94D] text-black hover:bg-[#d4a639]"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {isOwner && (
              <Button
                onClick={() => setIsDeleteModalOpen(true)}
                size="sm"
                className="bg-[#E1B94D] text-black hover:bg-[#d4a639]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {photos.length > 1 && (
        <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-2">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "w-8 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={currentShareUrl}
        title={currentPhoto?.description || "Photo"}
      />
    </div>
  );
}

