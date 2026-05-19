"use client";
import imageCompression from "browser-image-compression";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { isRasterImageFile } from "@/lib/uploadMimeValidation";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;

export async function compressImage(file: File): Promise<File> {
  if (!isRasterImageFile(file)) {
    return file;
  }

  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type,
    preserveExif: true,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    return new File([compressedFile], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Error compressing image:", error);
    return file;
  }
}

async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (ffmpegLoading) {
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpegInstance) {
      return ffmpegInstance;
    }
  }

  ffmpegLoading = true;

  try {
    const ffmpeg = new FFmpeg();
    
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    return ffmpeg;
  } catch (error) {
    ffmpegLoading = false;
    throw error;
  }
}

export async function compressVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  try {
    const ffmpeg = await loadFFmpeg();

    const inputFileName = "input" + file.name.substring(file.name.lastIndexOf("."));
    const outputFileName = "output.mp4";

    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    if (onProgress) {
      ffmpeg.on("progress", ({ progress }) => {
        onProgress(Math.round(progress * 100));
      });
    }

    await ffmpeg.exec([
      "-i",
      inputFileName,
      "-vcodec",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "fast",
      "-vf",
      "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
      "-acodec",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputFileName,
    ]);

    const data = await ffmpeg.readFile(outputFileName);
    const uint8Array = new Uint8Array(data as Uint8Array);
    const compressedBlob = new Blob([uint8Array], { type: "video/mp4" });

    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^/.]+$/, ".mp4"),
      {
        type: "video/mp4",
        lastModified: Date.now(),
      }
    );

    return compressedFile;
  } catch (error) {
    console.error("Error compressing video:", error);
    return file;
  }
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export async function generateVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(2, video.duration / 2);
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        "image/jpeg",
        0.8
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video"));
    };

    video.src = URL.createObjectURL(file);
    video.load();
  });
}

