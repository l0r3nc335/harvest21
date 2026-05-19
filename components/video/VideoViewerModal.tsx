"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Edit, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { ShareSheet } from "@/components/ui/ShareSheet";
import toast from "react-hot-toast";
import { sharePhoto } from "@/lib/photoActions";
import type { MediaItem } from "./types";

type VideoViewerModalProps = {
  videos: MediaItem[];
  initialIndex: number;
  onClose: () => void;
  isOwner?: boolean;
  pageUrl?: string;
  onEdit?: (video: MediaItem) => void;
  onDeleted?: () => void;
};

export function VideoViewerModal({
  videos,
  initialIndex,
  onClose,
  isOwner = false,
  pageUrl,
  onEdit,
  onDeleted,
}: VideoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const currentVideo = videos[currentIndex];

  const currentShareUrl = currentVideo && pageUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${pageUrl}?tab=videos&focus=page_media-${currentVideo.id}`
    : "";

  const handleShare = async () => {
    if (!currentVideo) return;
    await sharePhoto(currentVideo.id);
    setIsShareOpen(true);
  };

  const handleDelete = async () => {
    if (!currentVideo) return;
    try {
      const res = await fetch(`/api/page-media?id=${currentVideo.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("Video deleted successfully");
        setIsDeleteModalOpen(false);
        if (onDeleted) onDeleted();
        setTimeout(() => onClose(), 0);
      } else {
        toast.error(result.message || "Failed to delete video");
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    }
  };

  const isYouTubeUrl = (url: string) => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/.test(url);
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
    }
    return url;
  };

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(false);
      setIsLoading(true);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(false);
      setIsLoading(true);
    }
  }, [currentIndex, videos.length]);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleCanPlay = async () => {
    setIsLoading(false);
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Error playing video:", error);
        setIsPlaying(false);
      }
    }
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    }
    if (isRightSwipe) {
      handlePrevious();
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleLoadStart = () => {
        setIsLoading(true);
      };
      const handleLoad = async () => {
        setCurrentTime(0);
        setDuration(video.duration || 0);
        try {
          await video.play();
          setIsPlaying(true);
          setIsLoading(false);
        } catch (error) {
          console.error("Error auto-playing video:", error);
          setIsPlaying(false);
          setIsLoading(false);
        }
      };
      video.addEventListener("loadstart", handleLoadStart);
      video.addEventListener("loadedmetadata", handleLoad);
      video.load();
      return () => {
        video.removeEventListener("loadstart", handleLoadStart);
        video.removeEventListener("loadedmetadata", handleLoad);
      };
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === " ") {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentIndex, isPlaying, handleNext, handlePrevious, handlePlayPause, onClose]);

  if (!currentVideo) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/95"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
        >
          <X className="h-6 w-6" />
        </button>

        {currentIndex > 0 && (
          <button
            onClick={handlePrevious}
            className="absolute left-4 z-10 rounded-full bg-black/60 p-3 text-white transition-colors hover:bg-black/80"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {currentIndex < videos.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-10 rounded-full bg-black/60 p-3 text-white transition-colors hover:bg-black/80"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div className="relative w-full max-w-7xl mx-auto px-4">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute inset-0">
              {isYouTubeUrl(currentVideo.media_url) ? (
                <iframe
                  src={getYouTubeEmbedUrl(currentVideo.media_url)}
                  title="YouTube Video"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E1B94D] border-t-transparent" />
                        <p className="text-white text-sm">Loading video...</p>
                      </div>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    src={currentVideo.media_url}
                    poster={currentVideo.thumbnail_url || undefined}
                    className="h-full w-full object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onCanPlay={handleCanPlay}
                    onWaiting={handleWaiting}
                    onClick={handlePlayPause}
                    autoPlay
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4 space-y-3">
                    {currentVideo.description && (
                      <p className="text-white text-sm px-2">
                        {currentVideo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handlePlayPause}
                        className="rounded-full bg-[#E1B94D] p-2 text-black hover:bg-[#d4a639]"
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </button>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-white text-xs min-w-[40px]">
                          {formatTime(currentTime)}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          step="0.1"
                          value={currentTime}
                          onChange={handleSeek}
                          className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #E1B94D 0%, #E1B94D ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.2) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                        <span className="text-white text-xs min-w-[40px]">
                          {formatTime(duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleMuteToggle} className="text-white">
                          {isMuted ? (
                            <VolumeX className="h-5 w-5" />
                          ) : (
                            <Volume2 className="h-5 w-5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #E1B94D 0%, #E1B94D ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2 text-white">
            <div className="flex flex-wrap items-center justify-center gap-3">
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
                  onClick={() => onEdit(currentVideo)}
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
            <div className="w-full text-center text-sm">
              {currentIndex + 1} / {videos.length}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        elevation="high"
      />

      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={currentShareUrl}
        title={currentVideo?.description || "Video"}
      />
    </div>
  );
}

