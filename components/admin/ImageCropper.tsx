"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { getCroppedImg, getFileDataUrl } from "@/lib/imageCropperUtils";
import { toast } from "react-hot-toast";

type ImageCropperProps = {
  file: File;
  aspectRatio: number;
  targetWidth: number;
  targetHeight: number;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  title?: string;
};

export function ImageCropper({
  file,
  aspectRatio,
  targetWidth,
  targetHeight,
  onCropComplete,
  onCancel,
  title = "Crop Image",
}: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load image when file changes
  useEffect(() => {
    getFileDataUrl(file)
      .then((dataUrl) => {
        setImageSrc(dataUrl);
      })
      .catch((error) => {
        console.error("Error loading image:", error);
        toast.error("Failed to load image");
        onCancel();
      });
  }, [file, onCancel]);

  const onCropChange = useCallback((crop: Point) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      toast.error("Please wait for image to load");
      return;
    }

    setIsProcessing(true);
    try {
      // Crop and resize to exact dimensions
      // react-easy-crop provides croppedAreaPixels in pixels relative to original image
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        targetWidth,
        targetHeight
      );

      onCropComplete(croppedBlob);
    } catch (error) {
      console.error("Error cropping image:", error);
      toast.error("Failed to crop image");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!imageSrc) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <p className="text-zinc-600">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-4xl rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative h-[60vh] w-full bg-zinc-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="rect"
            showGrid={true}
            restrictPosition={true}
            minZoom={0.5}
            maxZoom={3}
          />
        </div>

        {/* Controls */}
        <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Zoom
            </label>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="mb-4 text-xs text-zinc-500">
            Target size: {targetWidth}x{targetHeight}px
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCrop}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Crop & Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

