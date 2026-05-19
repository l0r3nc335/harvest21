"use client";

import { v4 as uuidv4 } from "uuid";
import type { JSONContent } from "@tiptap/core";
import { supabase } from "@/lib/supabaseClient";
import {
  compressImage,
  compressVideo,
  isVideoFile,
} from "@/lib/mediaCompressionService";
import {
  validateUpload,
  sanitizeFilename,
  MAX_MEDIA_IMAGE_BYTES,
  MAX_MEDIA_VIDEO_BYTES,
} from "@/lib/uploadValidation";
import { isRasterImageFile } from "./uploadMimeValidation";

const BUCKET = "h21-dev";
const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;

export type UploadMediaResult = {
  publicUrl: string;
  path: string;
};

export async function uploadMedia(file: File): Promise<UploadMediaResult> {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  const category: "image" | "video" = isVideoFile(file) ? "video" : "image";
  const maxBytes =
    category === "video" ? MAX_MEDIA_VIDEO_BYTES : MAX_MEDIA_IMAGE_BYTES;
  const validation = await validateUpload(file, {
    category,
    maxBytes,
    filename: file.name,
  });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  let processed: File = file;

  if (isRasterImageFile(file)) {
    processed = await compressImage(file);
  } else if (isVideoFile(file)) {
    processed = await compressVideo(file);
  } else {
    throw new Error(
      "Unsupported media type. Upload a JPEG, PNG, GIF, WebP, AVIF image, or a video file.",
    );
  }

  const safeName = sanitizeFilename(file.name);
  const key = `rich-content/${uuidv4()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(key, processed, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw error;
  }

  const publicUrl = `${BASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;

  return {
    publicUrl,
    path: key,
  };
}

export async function deleteMedia(pathOrUrl: string): Promise<void> {
  if (!pathOrUrl) return;

  let path = pathOrUrl;
  const marker = `${BUCKET}/`;
  const index = pathOrUrl.indexOf(marker);

  if (index !== -1) {
    path = pathOrUrl.substring(index + marker.length);
  }

  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}

function isLocalSrc(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:");
}

type MediaNodeInfo = {
  node: JSONContent;
  src: string;
  storagePath?: string | null;
};

function collectMediaNodes(doc: JSONContent | null | undefined): MediaNodeInfo[] {
  const result: MediaNodeInfo[] = [];
  if (!doc) return result;

  const visit = (node: JSONContent) => {
    if (node.type === "image" || node.type === "video") {
      const attrs = (node as any).attrs ?? {};
      const src = attrs.src as string | undefined;
      const storagePath = attrs.storagePath as string | undefined;
      if (src) {
        result.push({
          node,
          src,
          storagePath: storagePath ?? null,
        });
      }
    }

    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  };

  visit(doc);
  return result;
}

export type SyncEditorMediaResult = {
  syncedJSON: JSONContent;
  uploaded: {
    from: string;
    to: string;
    path: string;
  }[];
  deleted: {
    src: string;
    path: string;
  }[];
};

export async function syncEditorMedia(
  newJSON: JSONContent,
  oldJSON: JSONContent | null,
): Promise<SyncEditorMediaResult> {
  const cloned: JSONContent =
    typeof structuredClone === "function"
      ? structuredClone(newJSON)
      : (JSON.parse(JSON.stringify(newJSON)) as JSONContent);

  const newMedia = collectMediaNodes(cloned);
  const oldMedia = collectMediaNodes(oldJSON);

  const oldBySrc = new Map<string, MediaNodeInfo>();
  const oldPaths = new Set<string>();

  for (const item of oldMedia) {
    oldBySrc.set(item.src, item);
    if (item.storagePath) {
      oldPaths.add(item.storagePath);
    } else {
      const marker = `${BUCKET}/`;
      const index = item.src.indexOf(marker);
      if (index !== -1) {
        const path = item.src.substring(index + marker.length);
        if (path) oldPaths.add(path);
      }
    }
  }

  const stillUsedPaths = new Set<string>();
  const uploaded: SyncEditorMediaResult["uploaded"] = [];

  for (const item of newMedia) {
    if (isLocalSrc(item.src)) {
      const response = await fetch(item.src);
      const blob = await response.blob();
      const filename =
        (blob as any).name ||
        (item.node.type === "image" ? "image" : "video") + ".bin";

      const file = new File([blob], filename, {
        type: blob.type || "application/octet-stream",
      });

      const { publicUrl, path } = await uploadMedia(file);

      const attrs = { ...((item.node as any).attrs ?? {}), src: publicUrl, storagePath: path };
      (item.node as any).attrs = attrs;

      uploaded.push({
        from: item.src,
        to: publicUrl,
        path,
      });

      stillUsedPaths.add(path);
    } else {
      const fromOld = oldBySrc.get(item.src);
      const storagePath = item.storagePath || fromOld?.storagePath;

      if (storagePath) {
        stillUsedPaths.add(storagePath);
      } else {
        const marker = `${BUCKET}/`;
        const index = item.src.indexOf(marker);
        if (index !== -1) {
          const path = item.src.substring(index + marker.length);
          if (path) stillUsedPaths.add(path);
        }
      }
    }
  }

  const deleted: SyncEditorMediaResult["deleted"] = [];

  for (const path of oldPaths) {
    if (!stillUsedPaths.has(path)) {
      await deleteMedia(path);
      deleted.push({
        src: "",
        path,
      });
    }
  }

  return {
    syncedJSON: cloned,
    uploaded,
    deleted,
  };
}


