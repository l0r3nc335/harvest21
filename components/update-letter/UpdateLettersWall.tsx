"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronDown, Calendar, Download, X, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UpdateLetterUploadModal } from "./UpdateLetterUploadModal";
import { UpdateLetterViewerModal } from "./UpdateLetterViewerModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { ShareSheet } from "@/components/ui/ShareSheet";
import Image from "next/image";
import toast from "react-hot-toast";
import type { UpdateLetter } from "./types";

type UpdateLettersWallProps = {
  pageId: number;
  pageUrl?: string;
  focusItemId?: number;
  onFocusChange?: (focus: string | null) => void;
  updateLetters: UpdateLetter[];
  loading: boolean;
  isOwner: boolean;
  onUpdateLetterAdded: () => void;
};

type GroupedLetters = {
  [key: string]: UpdateLetter[];
};

type FilterType = "year" | "month";
type SortOption = "newest" | "oldest" | "a-z" | "z-a";

export function UpdateLettersWall({
  pageId,
  pageUrl,
  focusItemId,
  onFocusChange,
  updateLetters: initialUpdateLetters,
  loading,
  isOwner,
  onUpdateLetterAdded,
}: UpdateLettersWallProps) {
  const [updateLetters, setUpdateLetters] = useState<UpdateLetter[]>(initialUpdateLetters);
  const [filterType, setFilterType] = useState<FilterType>("year");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedLetterIndex, setSelectedLetterIndex] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState<UpdateLetter | null>(null);
  const [shareLetterUrl, setShareLetterUrl] = useState("");
  const [shareLetterTitle, setShareLetterTitle] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    setUpdateLetters(initialUpdateLetters);
  }, [initialUpdateLetters]);

  const groupedLettersByYear = useMemo(() => {
    const grouped: GroupedLetters = {};
    updateLetters.forEach((letter) => {
      const date = new Date(letter.created_at);
      const year = date.getFullYear().toString();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(letter);
    });

    Object.keys(grouped).forEach((year) => {
      grouped[year].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return grouped;
  }, [updateLetters]);

  const groupedLettersByMonth = useMemo(() => {
    const grouped: GroupedLetters = {};
    updateLetters.forEach((letter) => {
      const date = new Date(letter.created_at);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString("default", { month: "long", year: "numeric" });
      const key = `${year}-${month}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(letter);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return grouped;
  }, [updateLetters]);

  const availableYears = useMemo(() => {
    return Object.keys(groupedLettersByYear).sort((a, b) => parseInt(b) - parseInt(a));
  }, [groupedLettersByYear]);

  const availableMonths = useMemo(() => {
    return Object.keys(groupedLettersByMonth).sort((a, b) => {
      const dateA = new Date(a.split("-")[1] + " 1, " + a.split("-")[0]);
      const dateB = new Date(b.split("-")[1] + " 1, " + b.split("-")[0]);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupedLettersByMonth]);

  const filteredAndSortedLetters = useMemo(() => {
    let list = [...updateLetters];

    if (filterType === "year" && selectedYear !== "all") {
      list = list.filter((letter) => {
        const year = new Date(letter.created_at).getFullYear().toString();
        return year === selectedYear;
      });
    }

    if (filterType === "month" && selectedMonth !== "all") {
      list = list.filter((letter) => {
        const date = new Date(letter.created_at);
        const monthKey = `${date.getFullYear()}-${date.toLocaleString("default", { month: "long", year: "numeric" })}`;
        return monthKey === selectedMonth;
      });
    }

    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "a-z":
          return (a.widget_title || "").localeCompare(b.widget_title || "");
        case "z-a":
          return (b.widget_title || "").localeCompare(a.widget_title || "");
        default:
          return 0;
      }
    });

    const grouped: GroupedLetters = {};

    sorted.forEach((letter) => {
      const date = new Date(letter.created_at);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString("default", { month: "long", year: "numeric" });
      const key = filterType === "year" ? year : `${year}-${month}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(letter);
    });

    return grouped;
  }, [updateLetters, filterType, selectedYear, selectedMonth, sortBy]);


  const getGroupLabel = (key: string) => {
    if (filterType === "year") {
      return key;
    } else {
      const [, ...monthParts] = key.split("-");
      const month = monthParts.join("-");
      return month;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  };

  const allLetters = useMemo(() => {
    const letters = Object.values(filteredAndSortedLetters).flat();
    return letters.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredAndSortedLetters]);

  const hasActiveFilters = useMemo(() => {
    return (
      sortBy !== "newest" ||
      (filterType === "year" && selectedYear !== "all") ||
      (filterType === "month" && selectedMonth !== "all")
    );
  }, [filterType, selectedMonth, selectedYear, sortBy]);

  const clearFilters = () => {
    setFilterType("year");
    setSelectedYear("all");
    setSelectedMonth("all");
    setSortBy("newest");
  };

  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focusItemId || focusHandled.current) return;
    const index = allLetters.findIndex((l) => l.id === focusItemId);
    if (index >= 0) {
      focusHandled.current = true;
      setSelectedLetterIndex(index);
      setIsViewerOpen(true);
    }
  }, [focusItemId, allLetters]);

  const handleLetterClick = (letter: UpdateLetter) => {
    const index = allLetters.findIndex((l) => l.id === letter.id);
    setSelectedLetterIndex(index >= 0 ? index : 0);
    setIsViewerOpen(true);
    onFocusChange?.(`page_widgets-${letter.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, letter: UpdateLetter) => {
    e.stopPropagation();
    setLetterToDelete(letter);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!letterToDelete) return;

    try {
      const res = await fetch(`/api/page-widgets?id=${letterToDelete.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setUpdateLetters((prev) => prev.filter((letter) => letter.id !== letterToDelete.id));
        onUpdateLetterAdded();
        setTimeout(() => toast.success("Update letter deleted successfully"), 300);
      } else {
        toast.error(result.message || "Failed to delete update letter");
      }
    } catch (error) {
      console.error("Error deleting update letter:", error);
      toast.error("Failed to delete update letter");
    } finally {
      setLetterToDelete(null);
    }
  };

  return (
    <>
      <section className=" md:px-4 pb-6 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)]">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Update Letter</h2>
            {isOwner && (
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full sm:w-auto bg-[#E1B94D] text-black hover:bg-[#d4a639]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Update Letter
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as FilterType);
                  setSelectedYear("all");
                  setSelectedMonth("all");
                }}
                  className="appearance-none rounded-lg border border-white/20 bg-[#1a1a1a] px-4 py-2 pr-8 text-sm text-white focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 cursor-pointer"
              >
                <option value="year">Year</option>
                <option value="month">Month</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0a0a0]" />
            </div>

            {filterType === "year" ? (
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none rounded-lg border border-white/20 bg-[#1a1a1a] px-4 py-2 pr-8 text-sm text-white focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 cursor-pointer"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0a0a0]" />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none rounded-lg border border-white/20 bg-[#1a1a1a] px-4 py-2 pr-8 text-sm text-white focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 cursor-pointer"
                >
                  <option value="all">All Months</option>
                  {availableMonths.map((monthKey) => {
                    const [, ...monthParts] = monthKey.split("-");
                    const month = monthParts.join("-");
                    return (
                      <option key={monthKey} value={monthKey}>
                        {month}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0a0a0]" />
              </div>
            )}

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none rounded-lg border border-white/20 bg-[#1a1a1a] px-4 py-2 pr-10 text-sm text-white focus:border-[#E1B94D] focus:outline-none focus:ring-2 focus:ring-[#E1B94D]/20 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="a-z">A-Z</option>
                <option value="z-a">Z-A</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0a0a0]" />
            </div>

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
        </div>

        {loading ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(10)].map((_, index) => (
              <div
                key={index}
                className="h-[450px] sm:h-[340px] md:h-[380px] lg:h-[420px] animate-pulse rounded-lg bg-white/10"
              />
            ))}
          </div>
        ) : allLetters.length === 0 ? (
          <div className="py-12 sm:py-16 text-center text-[#a0a0a0]">
            {hasActiveFilters ? "No update letters match your filters." : "No update letters uploaded yet."}
          </div>
        ) : (
          <>
            <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-[#a0a0a0]">
              Showing {allLetters.length} {allLetters.length === 1 ? "update letter" : "update letters"}
              {hasActiveFilters && " (filtered)"}
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5 gap-3 sm:gap-4">
              {allLetters.map((letter) => {
                const thumbnailUrl = letter.widget_data?.thumbnail_url;
                const pdfUrl = letter.widget_data?.pdf_url;
                const title = letter.widget_title;
                const truncatedTitle = title.length > 40 ? title.substring(0, 40) + "..." : title;
                
                const handleMouseEnter = () => {
                  if (pdfUrl) {
                    const link = document.createElement("link");
                    link.rel = "prefetch";
                    link.href = pdfUrl;
                    document.head.appendChild(link);
                  }
                };

                const handleDownload = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!pdfUrl) return;
                  
                  try {
                    const response = await fetch(pdfUrl);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${title}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error("Error downloading PDF:", error);
                  }
                };
                
                return (
                  <div
                    key={letter.id}
                    id={`missionary-content-page_widgets-${letter.id}`}
                    onClick={() => handleLetterClick(letter)}
                    onMouseEnter={handleMouseEnter}
                    className="group relative w-full h-[450px] sm:h-[340px] md:h-[380px] lg:h-[420px] cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] transition-all duration-300 hover:scale-[1.02] sm:hover:scale-105 hover:border-white/20 hover:shadow-xl active:scale-[0.98]"
                  >
                    <div className="relative h-[calc(100%-80px)] w-full bg-[#0a0a0a]">
                      {thumbnailUrl ? (
                        <Image
                          src={thumbnailUrl}
                          alt={title}
                          fill
                          className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-sm text-white/50">No thumbnail</span>
                        </div>
                      )}
                      {isOwner && (
                        <button
                          onClick={(e) => handleDeleteClick(e, letter)}
                          className="absolute top-2 right-2 rounded-full bg-red-600/90 p-1.5 sm:p-2 opacity-100 sm:opacity-0 transition-opacity hover:bg-red-800 sm:group-hover:opacity-100 z-10 cursor-pointer"
                          title="Delete update letter"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                        </button>
                      )}
                    </div>
                    
                    <div className="absolute inset-x-0 bottom-0 bg-[#2a2a2a] px-3 sm:px-4 py-2 sm:py-3">
                      <p className="mb-1 sm:mb-2 truncate text-xs sm:text-sm text-white">{truncatedTitle}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-white/60">
                          <Calendar className="h-3 w-3" />
                          <span className="hidden xs:inline">{formatDate(letter.created_at)}</span>
                          <span className="xs:hidden">{new Date(letter.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {pageUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareLetterUrl(`${window.location.origin}/${pageUrl}?tab=update-letters&focus=page_widgets-${letter.id}`);
                                setShareLetterTitle(title);
                                setIsShareOpen(true);
                              }}
                              className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                              aria-label="Share"
                            >
                              <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}
                          {pdfUrl && (
                            <button
                              onClick={handleDownload}
                              className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                              aria-label="Download PDF"
                            >
                              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <UpdateLetterUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        pageId={pageId}
        onSuccess={onUpdateLetterAdded}
      />

      {isViewerOpen && (
        <UpdateLetterViewerModal
          updateLetters={allLetters}
          initialIndex={selectedLetterIndex}
          onClose={() => { setIsViewerOpen(false); onFocusChange?.(null); }}
        />
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setLetterToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Update Letter"
        message="Are you sure you want to delete this update letter? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={shareLetterUrl}
        title={shareLetterTitle}
      />
    </>
  );
}

