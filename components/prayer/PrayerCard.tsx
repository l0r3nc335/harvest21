"use client";

import { useState } from "react";
import { Edit, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ShareSheet } from "@/components/ui/ShareSheet";
import { sharePrayer } from "@/lib/prayerActions";
import type { Prayer } from "@/lib/prayerActions";

type PrayerCardProps = {
  prayer: Prayer;
  pageUrl?: string;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate?: () => void;
  onView?: () => void;
  displayContent?: string;
  displayDate?: string;
  hasUpdates?: boolean;
};

export function PrayerCard({
  prayer,
  pageUrl,
  isOwner,
  onEdit,
  onDelete,
  onUpdate,
  onView,
  displayContent,
  displayDate,
  hasUpdates = false,
}: PrayerCardProps) {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const shareUrl = pageUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${pageUrl}?tab=prayer-wall&focus=prayers-${prayer.id}`
    : "";

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    sharePrayer(prayer.id);
    setIsShareOpen(true);
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const content = displayContent || prayer.body;
  const dateToShow = displayDate || prayer.created_at;

  if (hasUpdates === true) {
    return (
      <>
      <div className="relative w-full" style={{ height: '240px' }}>
        <div className="absolute top-4 left-4 w-full rounded-2xl border border-white/10 bg-[#1a1a1a] h-[240px] opacity-60 pointer-events-none" style={{ transform: 'translateZ(0)' }}></div>
        <div className="absolute top-2 left-2 w-full rounded-2xl border border-white/10 bg-[#1a1a1a] h-[240px] opacity-75 pointer-events-none" style={{ transform: 'translateZ(0)' }}></div>
        <div 
          className="group relative rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-lg transition-all hover:border-[#E1B94D]/30 flex flex-col h-[240px] overflow-hidden cursor-pointer"
          onClick={onView}
          style={{ transform: 'translateZ(0)' }}
        >
          <div 
            className="shrink-0 flex items-center justify-between p-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-[#a0a0a0]">
              {formatDate(dateToShow)}
            </span>
            {pageUrl && (
              <button onClick={handleShare} className="text-zinc-400 hover:text-[#E1B94D] transition-colors" aria-label="Share">
                <Share2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-yellow">
            <p className="text-sm leading-relaxed text-[#f5f5f5] whitespace-pre-wrap break-words">
              {content} 
            </p>
          </div>

          {isOwner && (
            <div 
              className="shrink-0 flex items-center gap-2 border-t border-white/10 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={onEdit}
                className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white text-xs"
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onDelete}
                className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white text-xs"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
              {onUpdate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onUpdate}
                  className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white text-xs"
                >
                  Update
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <ShareSheet isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} url={shareUrl} title={prayer.title || prayer.body.slice(0, 80)} />
      </>
    );
  }

  return (
    <>
    <div 
      className="group relative rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-lg transition-all hover:border-[#E1B94D]/30 flex flex-col h-[240px] overflow-hidden cursor-pointer"
      onClick={onView}
    >
      <div 
        className="shrink-0 flex items-center justify-between p-3 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-[#a0a0a0]">
          {formatDate(dateToShow)}
        </span>
        {pageUrl && (
          <button onClick={handleShare} className="text-zinc-400 hover:text-[#E1B94D] transition-colors" aria-label="Share">
            <Share2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-yellow">
        <p className="text-sm leading-relaxed text-[#f5f5f5] whitespace-pre-wrap break-words">
          {content} 
        </p>
      </div>

      {isOwner && (
        <div 
          className="shrink-0 flex items-center gap-2 border-t border-white/10 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white text-xs"
          >
            <Edit className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDelete}
            className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white text-xs"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
          {onUpdate && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onUpdate}
              className="flex-1 border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white text-xs"
            >
              Update
            </Button>
          )}
        </div>
      )}
    </div>
    <ShareSheet isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} url={shareUrl} title={prayer.title || prayer.body.slice(0, 80)} />
    </>
  );
}

