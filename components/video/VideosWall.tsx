"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Plus, X, Play, Trash2, Calendar, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SupabaseVideoUploadModal } from "./SupabaseVideoUploadModal";
import { VideoViewerModal } from "./VideoViewerModal";
import { EditPhotoModal } from "@/components/photo/EditPhotoModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Dropdown } from "@/components/ui/Dropdown";
import { DropdownItem } from "@/components/ui/DropdownItem";
import { ShareSheet } from "@/components/ui/ShareSheet";
import Image from "next/image";
import toast from "react-hot-toast";
import type { MediaItem } from "./types";

type VideosWallProps = {
  pageId: number;
  pageUrl?: string;
  focusItemId?: number;
  onFocusChange?: (focus: string | null) => void;
  videos: MediaItem[];
  loading: boolean;
  isOwner: boolean;
  selectedYear: string;
  onVideoAdded: () => void;
};

type SortOption = "newest" | "oldest" | "a-z" | "z-a";

export function VideosWall({
  pageId,
  pageUrl,
  focusItemId,
  onFocusChange,
  videos: initialVideos,
  loading: initialLoading,
  isOwner,
  onVideoAdded,
}: VideosWallProps) {
  const [isSupabaseUploadOpen, setIsSupabaseUploadOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<MediaItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<MediaItem | null>(null);
  const [shareMediaUrl, setShareMediaUrl] = useState("");
  const [shareMediaTitle, setShareMediaTitle] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);

  const [videos, setVideos] = useState<MediaItem[]>(initialVideos);
  const [loading] = useState(initialLoading);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    setVideos(initialVideos);
    setHasMore(initialVideos.length >= 20);
    setPage(1);
  }, [initialVideos]);

  const fetchVideos = useCallback(async (pageNum: number) => {
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/videos?pageId=${pageId}&page=${pageNum}&limit=20`
      );
      const data = await response.json();
      
      if (data.videos) {
        setVideos((prev) => 
          pageNum === 1 ? data.videos : [...prev, ...data.videos]
        );
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [pageId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchVideos(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, page, fetchVideos]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    videos.forEach((video) => {
      const year = new Date(video.created_at).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [videos]);

  const availableMonths = useMemo(() => {
    if (selectedYear === "all") return [];
    
    const months = new Set<string>();
    videos.forEach((video) => {
      const date = new Date(video.created_at);
      const year = date.getFullYear().toString();
      if (year === selectedYear) {
        const month = date.toLocaleString("default", { month: "long", year: "numeric" });
        months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
  }, [videos, selectedYear]);

  const filteredAndSortedVideos = useMemo(() => {
    let filtered = [...videos];

    if (selectedYear !== "all") {
      filtered = filtered.filter((video) => {
        const year = new Date(video.created_at).getFullYear().toString();
        return year === selectedYear;
      });
    }

    if (selectedMonth !== "all") {
      filtered = filtered.filter((video) => {
        const date = new Date(video.created_at);
        const month = date.toLocaleString("default", { month: "long", year: "numeric" });
        return month === selectedMonth;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "a-z":
          return (a.description || "").localeCompare(b.description || "");
        case "z-a":
          return (b.description || "").localeCompare(a.description || "");
        default:
          return 0;
      }
    });

    return sorted;
  }, [videos, selectedYear, selectedMonth, sortBy]);

  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focusItemId || focusHandled.current) return;
    const index = filteredAndSortedVideos.findIndex((v) => v.id === focusItemId);
    if (index >= 0) {
      focusHandled.current = true;
      setSelectedVideoIndex(index);
      setIsViewerOpen(true);
    }
  }, [focusItemId, filteredAndSortedVideos]);

  const handleVideoClick = (video: MediaItem) => {
    const index = filteredAndSortedVideos.findIndex((v) => v.id === video.id);
    setSelectedVideoIndex(index >= 0 ? index : 0);
    setIsViewerOpen(true);
    onFocusChange?.(`page_media-${video.id}`);
  };

  const clearFilters = () => {
    setSelectedYear("all");
    setSelectedMonth("all");
    setSortBy("newest");
  };

  const hasActiveFilters = selectedYear !== "all" || selectedMonth !== "all" || sortBy !== "newest";

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case "newest":
        return "Newest First";
      case "oldest":
        return "Oldest First";
      case "a-z":
        return "A-Z";
      case "z-a":
        return "Z-A";
      default:
        return "Newest First";
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, video: MediaItem) => {
    e.stopPropagation();
    setVideoToDelete(video);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;

    try {
      const res = await fetch(`/api/page-media?id=${videoToDelete.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setPage(1);
        fetchVideos(1);
        onVideoAdded();
        setTimeout(() => toast.success("Video deleted successfully"), 300);
      } else {
        toast.error(result.message || "Failed to delete video");
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    } finally {
      setVideoToDelete(null);
    }
  };


  const isYouTubeUrl = (url: string) => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/.test(url);
  };

  const getThumbnailUrl = (video: MediaItem) => {
    if (video.thumbnail_url) {
      return video.thumbnail_url;
    }
    if (isYouTubeUrl(video.media_url)) {
      const videoId = video.media_url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
      )?.[1];
      return videoId
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        : null;
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <section className=" md:px-4 pb-8 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Videos</h2>
            {isOwner && (
              <Button
                onClick={() => setIsSupabaseUploadOpen(true)}
                className="w-full sm:w-auto bg-[#E1B94D] text-black hover:bg-[#d4a639]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Video
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Dropdown
              label="Year"
              selectedValue={selectedYear !== "all" ? selectedYear : undefined}
              className="[&_button]:border-white/20 [&_button]:bg-[#1a1a1a] [&_button]:text-white [&_button]:hover:bg-[#2a2a2a] [&_button]:px-4 [&_button]:py-2 [&_div]:border-white/20 [&_div]:bg-[#1a1a1a] [&_div]:shadow-xl [&_div_div]:text-white [&_div_div]:hover:bg-white/10"
            >
              <DropdownItem
                onClick={() => {
                  setSelectedYear("all");
                  setSelectedMonth("all");
                }}
                className={selectedYear === "all" ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
              >
                All Years
              </DropdownItem>
              {availableYears.map((year) => (
                <DropdownItem
                  key={year}
                  onClick={() => {
                    setSelectedYear(year.toString());
                    setSelectedMonth("all");
                  }}
                  className={selectedYear === year.toString() ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
                >
                  {year}
                </DropdownItem>
              ))}
            </Dropdown>

            <Dropdown
              label="Month"
              selectedValue={selectedMonth !== "all" ? selectedMonth : undefined}
              className="[&_button]:border-white/20 [&_button]:bg-[#1a1a1a] [&_button]:text-white [&_button]:hover:bg-[#2a2a2a] [&_button]:px-4 [&_button]:py-2 [&_button]:disabled:opacity-50 [&_button]:disabled:cursor-not-allowed [&_div]:border-white/20 [&_div]:bg-[#1a1a1a] [&_div]:shadow-xl [&_div_div]:text-white [&_div_div]:hover:bg-white/10"
            >
              <DropdownItem
                onClick={() => setSelectedMonth("all")}
                className={selectedMonth === "all" ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
                style={{ pointerEvents: selectedYear === "all" ? "none" : "auto", opacity: selectedYear === "all" ? 0.5 : 1 }}
              >
                All Months
              </DropdownItem>
              {availableMonths.map((month) => (
                <DropdownItem
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  className={selectedMonth === month ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
                >
                  {month}
                </DropdownItem>
              ))}
              {selectedYear === "all" && (
                <div className="px-4 py-2 text-xs text-[#a0a0a0] italic">
                  Select a year first
                </div>
              )}
            </Dropdown>

            <Dropdown
              label="Sort"
              selectedValue={getSortLabel(sortBy)}
              className="[&_button]:border-white/20 [&_button]:bg-[#1a1a1a] [&_button]:text-white [&_button]:hover:bg-[#2a2a2a] [&_button]:px-4 [&_button]:py-2 [&_div]:border-white/20 [&_div]:bg-[#1a1a1a] [&_div]:shadow-xl [&_div_div]:text-white [&_div_div]:hover:bg-white/10"
            >
              <DropdownItem
                onClick={() => setSortBy("newest")}
                className={sortBy === "newest" ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
              >
                Newest First
              </DropdownItem>
              <DropdownItem
                onClick={() => setSortBy("oldest")}
                className={sortBy === "oldest" ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
              >
                Oldest First
              </DropdownItem>
              <DropdownItem
                onClick={() => setSortBy("a-z")}
                className={sortBy === "a-z" ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
              >
                A-Z
              </DropdownItem>
              <DropdownItem
                onClick={() => setSortBy("z-a")}
                className={sortBy === "z-a" ? "bg-[#E1B94D]/20 text-[#E1B94D]" : "text-white hover:bg-white/10"}
              >
                Z-A
              </DropdownItem>
            </Dropdown>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-[#1a1a1a] px-3 py-2 text-sm text-white transition-colors hover:bg-[#2a2a2a] hover:border-white/30"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {selectedYear !== "all" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1B94D]/20 px-3 py-1 text-xs sm:text-sm text-[#E1B94D]">
                  Year: {selectedYear}
                  <button
                    onClick={() => {
                      setSelectedYear("all");
                      setSelectedMonth("all");
                    }}
                    className="hover:text-[#E1B94D]/70 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {selectedMonth !== "all" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1B94D]/20 px-3 py-1 text-xs sm:text-sm text-[#E1B94D]">
                  Month: {selectedMonth}
                  <button
                    onClick={() => setSelectedMonth("all")}
                    className="hover:text-[#E1B94D]/70 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {sortBy !== "newest" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1B94D]/20 px-3 py-1 text-xs sm:text-sm text-[#E1B94D]">
                  Sort: {getSortLabel(sortBy)}
                  <button
                    onClick={() => setSortBy("newest")}
                    className="hover:text-[#E1B94D]/70 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, index) => (
              <div
                key={index}
                className="h-[308px] sm:h-[332px] md:h-[352px] lg:h-[380px] animate-pulse rounded-lg bg-white/10"
              />
            ))}
          </div>
        ) : filteredAndSortedVideos.length === 0 ? (
          <div className="py-12 sm:py-16 text-center text-[#a0a0a0]">
            {hasActiveFilters ? "No videos match your filters." : "No videos uploaded yet."}
          </div>
        ) : (
          <>
            <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-[#a0a0a0]">
              Showing {filteredAndSortedVideos.length} {filteredAndSortedVideos.length === 1 ? "video" : "videos"}
              {hasActiveFilters && " (filtered)"}
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredAndSortedVideos.map((video) => {
                const thumbnailUrl = getThumbnailUrl(video);
                const rawTitle = (video.description?.trim() || "Video") as string;
                const truncatedTitle =
                  rawTitle.length > 40 ? `${rawTitle.substring(0, 40)}...` : rawTitle;
                return (
                  <div
                    key={video.id}
                    id={`missionary-content-page_media-${video.id}`}
                    onClick={() => handleVideoClick(video)}
                    className="group relative w-full h-[308px] sm:h-[332px] md:h-[352px] lg:h-[380px] cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] transition-all duration-300 hover:scale-[1.02] sm:hover:scale-105 hover:border-white/20 hover:shadow-xl active:scale-[0.98]"
                  >
                    <div className="relative h-[calc(100%-80px)] w-full bg-[#0a0a0a]">
                      {thumbnailUrl ? (
                        <Image
                          src={thumbnailUrl}
                          alt={video.description || "Video thumbnail"}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#0a0a0a]">
                          <Play className="h-8 w-8 sm:h-12 sm:w-12 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 sm:bg-black/0 sm:opacity-0 transition-all duration-300 sm:group-hover:bg-black/40 sm:group-hover:opacity-100 pointer-events-none">
                        <div className="rounded-full bg-[#E1B94D]/90 p-3 sm:p-4 transition-transform duration-300 group-hover:scale-110">
                          <Play className="h-5 w-5 sm:h-8 sm:w-8 fill-black text-black" />
                        </div>
                      </div>
                      {isOwner && (
                        <button
                          onClick={(e) => handleDeleteClick(e, video)}
                          className="absolute top-2 right-2 rounded-full bg-red-600/90 p-1.5 sm:p-2 opacity-100 sm:opacity-0 transition-opacity hover:bg-red-600 sm:group-hover:opacity-100 z-10 cursor-pointer"
                          title="Delete video"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                        </button>
                      )}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-[#2a2a2a] px-3 sm:px-4 py-2 sm:py-3">
                      <p className="mb-1 sm:mb-2 truncate text-xs sm:text-sm text-white">{truncatedTitle}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4 text-xs text-white/60">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="hidden xs:inline">{formatDate(video.created_at)}</span>
                            <span className="xs:hidden">
                              {new Date(video.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {pageUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareMediaUrl(
                                  `${window.location.origin}/${pageUrl}?tab=videos&focus=page_media-${video.id}`
                                );
                                setShareMediaTitle(rawTitle);
                                setIsShareOpen(true);
                              }}
                              className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                              aria-label="Share"
                            >
                              <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div ref={observerTarget} className="py-6 sm:py-8">
                {isLoadingMore && (
                  <div className="flex justify-center">
                    <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-3 sm:border-4 border-[#E1B94D] border-t-transparent" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <SupabaseVideoUploadModal
        isOpen={isSupabaseUploadOpen}
        onClose={() => setIsSupabaseUploadOpen(false)}
        pageId={pageId}
        onSuccess={() => {
          setPage(1);
          fetchVideos(1);
          onVideoAdded();
        }}
      />

      {isViewerOpen && (
        <VideoViewerModal
          videos={filteredAndSortedVideos}
          initialIndex={selectedVideoIndex}
          onClose={() => { setIsViewerOpen(false); onFocusChange?.(null); }}
          isOwner={isOwner}
          pageUrl={pageUrl}
          onEdit={(video) => {
            setSelectedVideo(video);
            setIsEditModalOpen(true);
          }}
          onDeleted={() => {
            setPage(1);
            fetchVideos(1);
            onVideoAdded();
          }}
        />
      )}

      <EditPhotoModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedVideo(null);
        }}
        photo={selectedVideo}
        onSuccess={() => {
          setPage(1);
          fetchVideos(1);
          onVideoAdded();
        }}
        elevation="high"
        mediaType="video"
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setVideoToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={shareMediaUrl}
        title={shareMediaTitle}
      />
    </>
  );
}

