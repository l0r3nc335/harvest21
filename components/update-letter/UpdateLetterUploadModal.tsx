"use client";

import { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPageWidget, uploadFileToStorage } from "@/lib/pageActions";
import { SocialCrossPostCheckboxes } from "@/components/social/social-cross-post-checkboxes";
import toast from "react-hot-toast";

type UpdateLetterUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pageId: number;
  onSuccess: () => void;
};

async function generatePdfThumbnail(file: File): Promise<Blob> {
  try {
    // Dynamically import pdfjs only when needed
    const pdfjsLib = await import("pdfjs-dist");
    
    // Set worker path for pdfjs - use local file from public folder
    if (typeof window !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    if (pdf.numPages === 0) {
      throw new Error("PDF has no pages");
    }
    
    // Get first page
    const page = await pdf.getPage(1);
    
    // Calculate scale to fit within reasonable dimensions
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    if (!context) {
      throw new Error("Could not get canvas context");
    }
    
    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    };
    
    await page.render(renderContext).promise;

    // Full first page (no OG crop) — match card previews; optionally cap width for file size
    const MAX_THUMB_WIDTH = 1200;
    let out = canvas;
    const fullW = canvas.width;
    const fullH = canvas.height;
    if (fullW > MAX_THUMB_WIDTH) {
      const scale = MAX_THUMB_WIDTH / fullW;
      const scaled = document.createElement("canvas");
      scaled.width = MAX_THUMB_WIDTH;
      scaled.height = Math.round(fullH * scale);
      const scaledCtx = scaled.getContext("2d");
      if (!scaledCtx) {
        throw new Error("Could not get canvas context");
      }
      scaledCtx.drawImage(canvas, 0, 0, fullW, fullH, 0, 0, scaled.width, scaled.height);
      out = scaled;
    }

    return new Promise((resolve, reject) => {
      out.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        },
        "image/jpeg",
        0.8
      );
    });
  } catch (error) {
    console.error("Error generating PDF thumbnail:", error);
    throw new Error(
      error instanceof Error 
        ? `Failed to generate thumbnail: ${error.message}` 
        : "Failed to generate thumbnail"
    );
  }
}

export function UpdateLetterUploadModal({
  isOpen,
  onClose,
  pageId,
  onSuccess,
}: UpdateLetterUploadModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [postToInstagram, setPostToInstagram] = useState(false);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPdfFile(null);
      setTitle("");
      setDescription("");
      setThumbnailPreview(null);
      setPostToFacebook(false);
      setPostToInstagram(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPdfFile) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setThumbnailPreview(null);
      setGeneratingThumbnail(false);
      return;
    }

    let isMounted = true;
    setGeneratingThumbnail(true);

    generatePdfThumbnail(selectedPdfFile)
      .then((blob) => {
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = url;
        setThumbnailPreview(url);
        setGeneratingThumbnail(false);
      })
      .catch((error) => {
        console.error("Error generating thumbnail:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to generate thumbnail";
        toast.error(errorMessage);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        setThumbnailPreview(null);
        setGeneratingThumbnail(false);
      });

    return () => {
      isMounted = false;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [selectedPdfFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        setSelectedPdfFile(acceptedFiles[0]);
      }
    },
    onDropRejected: () => {
      toast.error("Please drop a valid PDF file");
    },
  });

  const handleSubmit = async () => {
    if (!selectedPdfFile) {
      toast.error("Please select a PDF file");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setUploading(true);

    try {
      const response = await fetch("/api/get-page-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch page data");
      }

      const pageData = await response.json();
      const { organization_type, organization_id } = pageData;

      if (!organization_type || !organization_id) {
        throw new Error("Invalid page data");
      }

      // Upload PDF
      const pdfUploadResult = await uploadFileToStorage(
        organization_type,
        organization_id,
        "update-letters",
        selectedPdfFile,
        null
      );

      if (!pdfUploadResult.success || !pdfUploadResult.publicUrl) {
        throw new Error(pdfUploadResult.error || "Failed to upload PDF");
      }

      // Generate and upload thumbnail
      let thumbnailUrl: string | null = null;
      if (thumbnailPreview) {
        try {
          const thumbnailBlob = await fetch(thumbnailPreview).then((r) => r.blob());
          const thumbnailFile = new File(
            [thumbnailBlob],
            `thumbnail-${Date.now()}.jpg`,
            { type: "image/jpeg" }
          );

          const thumbnailUploadResult = await uploadFileToStorage(
            organization_type,
            organization_id,
            "update-letters",
            thumbnailFile,
            null
          );

          if (thumbnailUploadResult.success && thumbnailUploadResult.publicUrl) {
            thumbnailUrl = thumbnailUploadResult.publicUrl;
          }
        } catch (thumbnailError) {
          console.error("Error uploading thumbnail:", thumbnailError);
          // Continue without thumbnail - not critical
        }
      }

      // Create widget
      const widgetResult = await createPageWidget(
        pageId,
        "update_letter",
        title.trim(),
        {
          pdf_url: pdfUploadResult.publicUrl,
          thumbnail_url: thumbnailUrl,
          description: description.trim() || null,
          view_count: 0,
        },
        {
          postToFacebook,
          postToInstagram,
        }
      );

      if (!widgetResult.success) {
        throw new Error(widgetResult.message || "Failed to save update letter");
      }

      onSuccess();
      onClose();
      setTimeout(() => {
        toast.success("Update letter uploaded successfully!");
      }, 200);
    } catch (error) {
      console.error("Error uploading update letter:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload update letter"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Update Letter"
      size="md"
      variant="dark"
    >
      <div className="flex flex-col max-h-[calc(90vh-120px)] overflow-y-auto scrollbar-yellow p-4 space-y-6">
        <div className="space-y-6">
          <div>
          <label className="mb-2 block text-sm text-white">Title *</label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter update letter title..."
            className="w-full border-white/20 bg-[#0a0a0a] text-white placeholder:text-[#a0a0a0] focus:border-[#E1B94D]"
            required
          />
          </div>

          <div>
            <p className="mb-3 text-sm text-white">Upload PDF</p>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-6 sm:p-8 text-center transition-colors overflow-hidden max-h-[60vh] sm:max-h-[420px] ${
                isDragActive
                  ? "border-[#E1B94D] bg-[#E1B94D]/10"
                  : "border-white/20 bg-[#0a0a0a] hover:border-white/30"
              }`}
            >
              <input {...getInputProps()} />
              {selectedPdfFile ? (
                <div className="space-y-4">
                  {generatingThumbnail ? (
                    <div className="text-sm text-[#a0a0a0]">Generating thumbnail...</div>
                  ) : thumbnailPreview ? (
                    <div className="relative mx-auto w-full max-w-md h-[50vh] sm:h-[320px] overflow-hidden rounded-lg">
                      <Image
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        fill
                        sizes="(max-width: 640px) 90vw, 400px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPdfFile(null);
                      setThumbnailPreview(null);
                    }}
                    variant="secondary"
                    size="sm"
                    className="border-white/20 bg-transparent text-[#a0a0a0] hover:bg-white/5 hover:text-white"
                  >
                    Change PDF
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white">
                    Drag and drop a PDF here, or click to select
                  </p>
                  <p className="text-xs text-[#a0a0a0]">PDF files only</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white">Description (Optional)</label>
            <Input
              type="text"
              value={description}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 250) {
                  setDescription(value);
                } else {
                  setDescription(value.substring(0, 250));
                }
              }}
              placeholder="Add a description..."
              maxLength={250}
              className="w-full border-white/20 bg-[#0a0a0a] text-white placeholder:text-[#a0a0a0] focus:border-[#E1B94D]"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs ${description.length >= 250 ? "text-red-400" : "text-[#a0a0a0]"}`}>
                  {description.length}/250 characters
                </span>
                {description.length >= 250 && (
                  <span className="text-xs font-medium text-red-400">
                    (Limit reached)
                  </span>
                )}
              </div>
              {description.length >= 250 && (
                <span className="text-xs text-red-400 font-medium">
                  Maximum length reached
                </span>
              )}
            </div>
          </div>
        </div>

        <SocialCrossPostCheckboxes
          pageId={pageId}
          contentMode="media"
          postToFacebook={postToFacebook}
          postToInstagram={postToInstagram}
          onChangeFacebook={setPostToFacebook}
          onChangeInstagram={setPostToInstagram}
          disabled={uploading || generatingThumbnail}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            className="w-full border-white/20 bg-transparent text-white hover:bg-white/5 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedPdfFile || !title.trim() || uploading || generatingThumbnail}
            className="w-full bg-[#E1B94D] px-8 text-black hover:bg-[#d4a639] disabled:opacity-50 sm:w-auto"
          >
            {uploading ? "Uploading..." : generatingThumbnail ? "Processing..." : "Upload"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

