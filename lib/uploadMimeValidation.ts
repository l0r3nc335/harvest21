/**
 * Server- and client-side guards for uploads. Blocks SVG and other non-raster
 * "image/*" types that can carry script (stored XSS when served or embedded in HTML).
 */

/** Use on `<input type="file" accept={...}>` so pickers do not default to `image/svg+xml`. */
export const RASTER_IMAGE_INPUT_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif";

const RASTER_IMAGE_MIMES = new Set([
  "image/avif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function normalizeMimeType(type: string): string {
  return type.toLowerCase().split(";")[0].trim();
}

export function isRasterImageMime(type: string): boolean {
  return RASTER_IMAGE_MIMES.has(normalizeMimeType(type));
}

export function isRasterImageFile(file: File): boolean {
  return isRasterImageMime(file.type);
}

export function assertRasterImageUpload(file: File | Blob, label = "image"): void {
  if (isRasterImageMime(file.type)) {
    return;
  }
  throw new Error(
    `Invalid ${label}: only JPEG, PNG, GIF, WebP, and AVIF are allowed. SVG and other image types are blocked for security.`,
  );
}

export function assertVideoUpload(file: File | Blob): void {
  const t = normalizeMimeType(file.type);
  if (t.startsWith("video/")) {
    return;
  }
  throw new Error("Invalid file: only video uploads are allowed.");
}

export function assertPdfUpload(file: File | Blob): void {
  if (normalizeMimeType(file.type) === "application/pdf") {
    return;
  }
  throw new Error("Invalid file: only PDF uploads are allowed.");
}

/** Update-letter bucket: PDF body or raster thumbnail (JPEG/PNG/WebP, etc.). */
export function assertUpdateLetterUpload(file: File | Blob): void {
  if (isRasterImageMime(file.type)) {
    return;
  }
  assertPdfUpload(file);
}

export function assertUploadForFolder(
  folder: "profile" | "banner" | "media" | "videos" | "update-letters",
  file: File | Blob,
): void {
  switch (folder) {
    case "profile":
    case "banner":
    case "media":
      assertRasterImageUpload(file, "image");
      break;
    case "videos":
      assertVideoUpload(file);
      break;
    case "update-letters":
      assertUpdateLetterUpload(file);
      break;
  }
}
