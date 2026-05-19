"use client";

import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { UpdateLetter } from "./types";

type UpdateLetterViewerModalProps = {
  updateLetters: UpdateLetter[];
  initialIndex: number;
  onClose: () => void;
};

export function UpdateLetterViewerModal({
  updateLetters,
  initialIndex,
  onClose,
}: UpdateLetterViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfPages, setPdfPages] = useState<HTMLCanvasElement[]>([]);
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLetter = updateLetters[currentIndex];
  const pdfUrl = currentLetter?.widget_data?.pdf_url;

  useEffect(() => {
    if (!pdfUrl) return;

    let cancelled = false;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setPdfPages([]);
        setNumPages(0);

        const pdfjsLib = await import("pdfjs-dist");

        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setNumPages(pdf.numPages);

        const containerWidth = containerRef.current?.clientWidth || window.innerWidth - 32;

        const canvases: HTMLCanvasElement[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);

          const viewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;

          const context = canvas.getContext("2d");
          if (context) {
            await page.render({
              canvas: canvas,
              canvasContext: context,
              viewport: scaledViewport,
            }).promise;
          }

          if (cancelled) return;
          canvases.push(canvas);
        }

        setPdfPages(canvases);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading PDF:", error);
        setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? updateLetters.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === updateLetters.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;
    
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentLetter.widget_title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  if (!currentLetter || !pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 overflow-hidden">
      <button
        onClick={onClose}
        className="absolute right-2 sm:right-4 top-2 sm:top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        aria-label="Close"
      >
        <X className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white hidden sm:block">
        <span className="text-sm">
          {currentIndex + 1} / {updateLetters.length}
        </span>
      </div>

      {updateLetters.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 sm:left-4 top-1/2 z-10 flex h-10 w-10 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Previous letter"
          >
            <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-2 sm:right-4 top-1/2 z-10 flex h-10 w-10 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Next letter"
          >
            <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        </>
      )}

      {/* PDF Container - pdf.js canvas renderer */}
      <div 
        ref={containerRef}
        className="relative w-full h-full flex flex-col items-center overflow-y-auto overflow-x-hidden px-2 sm:px-4 pb-32 sm:pb-36 pt-12 sm:pt-16"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y pinch-zoom"
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
              <p className="text-white">Loading PDF...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full max-w-full">
            {pdfPages.map((canvas, index) => (
              <div 
                key={index} 
                className="w-full flex justify-center bg-white"
                style={{ maxWidth: "100%" }}
              >
                <canvas
                  ref={(el) => {
                    if (el && canvas) {
                      el.width = canvas.width;
                      el.height = canvas.height;
                      const ctx = el.getContext("2d");
                      if (ctx) {
                        ctx.drawImage(canvas, 0, 0);
                      }
                    }
                  }}
                  className="w-full h-auto"
                  style={{ display: "block", maxWidth: "100%" }}
                />
              </div>
            ))}
            {numPages > 0 && (
              <div className="text-center text-white/60 text-sm py-4">
                {numPages} {numPages === 1 ? "page" : "pages"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/80 to-transparent p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-base sm:text-lg font-semibold text-white">
          {currentLetter.widget_title}
        </h3>
        
        {currentLetter.widget_data?.description && (
          <p className="mb-4 text-xs sm:text-sm text-white/80">
            {currentLetter.widget_data.description}
          </p>
        )}
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-white/80">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{formatDate(currentLetter.created_at)}</span>
          </div>
          <Button
            onClick={handleDownload}
            size="sm"
            className="bg-[#E1B94D] text-black hover:bg-[#d4a639] text-xs sm:text-sm"
          >
            <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {updateLetters.length > 1 && (
        <div className="absolute bottom-20 sm:bottom-24 left-1/2 flex -translate-x-1/2 gap-2">
          {updateLetters.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "w-8 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Go to letter ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

