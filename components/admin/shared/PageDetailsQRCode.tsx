"use client";

import { useState, useRef, useCallback } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Copy, Download, Loader2, QrCode } from "lucide-react";
import toast from "react-hot-toast";

type PageDetailsQRCodeProps = {
  canonicalPageUrl: string;
  isPageOwner?: boolean;
};

export function PageDetailsQRCode({ canonicalPageUrl, isPageOwner = true }: PageDetailsQRCodeProps) {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalSvgRef = useRef<HTMLDivElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(() => {
    const url = canonicalPageUrl.trim();
    if (!url) {
      setError("Page URL is required to generate QR code.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      setQrValue(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate QR code.");
      setQrValue(null);
    } finally {
      setIsGenerating(false);
    }
  }, [canonicalPageUrl]);

  const downloadPngFromRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "qr-code.png";
    link.click();
    toast.success("QR code downloaded as PNG");
  }, []);

  const downloadSvgFromRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "qr-code.svg";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("QR code downloaded as SVG");
  }, []);

  const downloadPng = useCallback(() => {
    if (!qrValue) return;
    downloadPngFromRef(canvasRef.current);
  }, [qrValue, downloadPngFromRef]);

  const downloadSvg = useCallback(() => {
    if (!qrValue) return;
    downloadSvgFromRef(svgContainerRef.current);
  }, [qrValue, downloadSvgFromRef]);

  const downloadPngFromModal = useCallback(() => {
    if (!qrValue) return;
    downloadPngFromRef(modalCanvasRef.current);
  }, [qrValue, downloadPngFromRef]);

  const downloadSvgFromModal = useCallback(() => {
    if (!qrValue) return;
    downloadSvgFromRef(modalSvgRef.current);
  }, [qrValue, downloadSvgFromRef]);

  const copyUrl = useCallback(() => {
    if (!canonicalPageUrl) return;
    navigator.clipboard.writeText(canonicalPageUrl);
    toast.success("Page URL copied to clipboard");
  }, [canonicalPageUrl]);

  if (!isPageOwner) return null;

  const trimmed = canonicalPageUrl.trim();
  const urlValid = trimmed.length > 0 && trimmed !== "/" && !/^https?:\/\/[^/]*\/?$/.test(trimmed);

  return (
    <div className="mt-3 space-y-3">
      {!qrValue && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={generate}
          disabled={isGenerating || !urlValid}
          className="inline-flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4 shrink-0" />
              Generate QR Code
            </>
          )}
        </Button>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {qrValue && !error && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 rounded border border-zinc-200 dark:border-zinc-700 bg-white p-2 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-400"
              aria-label="Preview QR code in larger view"
            >
              <div ref={svgContainerRef}>
                <QRCodeSVG value={qrValue} size={160} level="M" />
              </div>
            </button>
            <div className="sr-only" aria-hidden>
              <QRCodeCanvas value={qrValue} size={256} level="M" ref={canvasRef} />
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" onClick={downloadPng}>
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadSvg}>
                <Download className="h-4 w-4 mr-2" />
                Download SVG
              </Button>
              <Button variant="secondary" size="sm" onClick={copyUrl}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Page URL
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={previewOpen && !!qrValue && !error}
        onClose={() => setPreviewOpen(false)}
        title="QR Code Preview"
        size="md"
        trapFocus
      >
        {qrValue && (
          <div className="flex flex-col items-center gap-4">
            <div ref={modalSvgRef} className="rounded border border-zinc-200 dark:border-zinc-700 bg-white p-4">
              <QRCodeSVG value={qrValue} size={320} level="M" />
            </div>
            <div className="sr-only" aria-hidden>
              <QRCodeCanvas value={qrValue} size={512} level="M" ref={modalCanvasRef} />
            </div>
            {canonicalPageUrl && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center break-all max-w-full">
                {canonicalPageUrl}
              </p>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="secondary" size="sm" onClick={downloadPngFromModal} className="inline-flex items-center gap-2">
                <Download className="h-4 w-4 shrink-0" />
                Download PNG
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadSvgFromModal} className="inline-flex items-center gap-2">
                <Download className="h-4 w-4 shrink-0" />
                Download SVG
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
