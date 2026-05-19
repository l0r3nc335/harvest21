"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X } from "lucide-react";

type VideoHeaderSectionProps = {
  title: string;
  subtitle: string;
  videoUrl: string | null;
  pendingVideoFile: File | null;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onVideoSelect: (file: File | null) => void;
  readOnly?: boolean;
  isTitleMissing?: boolean;
  isSubtitleMissing?: boolean;
};

export function VideoHeaderSection({
  title,
  subtitle,
  videoUrl,
  pendingVideoFile,
  onSubtitleChange,
  onVideoSelect,
  readOnly = false,
  isSubtitleMissing = false,
}: VideoHeaderSectionProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pendingVideoFile) {
      const url = URL.createObjectURL(pendingVideoFile);
      queueMicrotask(() => {
        setVideoPreviewUrl(url);
      });
      return () => {
        URL.revokeObjectURL(url);
        setVideoPreviewUrl(null);
      };
    } else {
      queueMicrotask(() => {
        setVideoPreviewUrl(null);
      });
    }
  }, [pendingVideoFile]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelect(file);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleRemoveVideo = () => {
    onVideoSelect(null);
  };

  const hasVideo = videoUrl || pendingVideoFile;

  return (
      <div className="space-y-4">
        <div>
          <h2 className="block text-sm font-medium text-zinc-700 mb-1">
            Background Video
          </h2>
          <p className="text-xs text-zinc-500 mb-2">
          Upload Ministry Video Here (Optional)
          </p>

          {hasVideo ? (
            <div className="relative aspect-video w-full max-w-2xl rounded-lg overflow-hidden bg-zinc-900">
              {videoPreviewUrl ? (
                <video
                  src={videoPreviewUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              ) : null}

              {pendingVideoFile && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
                  Pending Upload
                </div>
              )}

              {!readOnly && (
                <button
                  type="button"
                  onClick={handleRemoveVideo}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div
              onClick={() => !readOnly && videoInputRef.current?.click()}
              className={`aspect-video w-full max-w-2xl rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center gap-3 ${
                !readOnly ? "cursor-pointer hover:border-zinc-400 hover:bg-zinc-100" : ""
              } transition-colors`}
            >
              <Upload className="h-10 w-10 text-zinc-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-600">
                  Click to upload video
                </p>
                <p className="text-xs text-zinc-500">MP4, MOV, WebM (max 100MB)</p>
              </div>
            </div>
          )}

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoSelect}
            disabled={readOnly}
          />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center mb-0.5">
            <span className="text-xs text-zinc-500">This title cannot be edited</span>
          </div>
          <h2 className="font-bold text-black m-0">
            {title || "Personal Bio"}
          </h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
      
          </label>
          <textarea
            value={subtitle}
            onChange={(e) => onSubtitleChange(e.target.value)}
            placeholder="Tell your story. Line breaks and paragraphs will be preserved."
            disabled={readOnly}
            rows={6}
            className={`block w-full rounded-md border px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 resize-y min-h-[100px] focus:border-brand-yellow focus:ring-brand-yellow/20 disabled:bg-zinc-100 disabled:cursor-not-allowed ${isSubtitleMissing ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-zinc-300"}`}
          />
          <br/>
        </div>
    </div>
  );
}
