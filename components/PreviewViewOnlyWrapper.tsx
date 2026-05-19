"use client";

import { Button } from "@/components/ui/Button";

type PreviewViewOnlyWrapperProps = {
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
  className?: string;
};

export function PreviewViewOnlyWrapper({
  onBack,
  backLabel = "← Back to Settings",
  children,
  className = "",
}: PreviewViewOnlyWrapperProps) {
  return (
    <div className={`min-h-screen bg-black relative ${className}`}>
      <div className="sticky top-0 z-[100] bg-black/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-yellow-500/30 border border-yellow-500/50 rounded-full">
              <span className="text-sm font-bold text-yellow-200 uppercase tracking-wide">
                View Only - Preview
              </span>
            </div>
            <p className="text-xs text-yellow-100/80 hidden sm:block">
              This preview is for display only. No interactions are enabled.
            </p>
          </div>
          <Button
            onClick={onBack}
            variant="secondary"
            className="text-sm bg-black/50 text-white border border-white/20 hover:bg-black/70 pointer-events-auto z-[101]"
          >
            {backLabel}
          </Button>
        </div>
      </div>

      {/* Allow scrolling and normal cursor behavior while keeping the preview
          visually distinct. We no longer block pointer events for the entire
          preview so admins can scroll and inspect the full page content. */}
      <div
        className="relative"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <div style={{ opacity: 0.95 }}>{children}</div>
      </div>
    </div>
  );
}
