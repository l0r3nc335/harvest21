/**
 * Central file upload validation.
 * Validates declared MIME, filename extension, magic bytes (first 12 bytes),
 * and byte size. Rejects SVG and any non-allowlisted signature.
 *
 * Used by every server-side upload path so the allowlist stays consistent.
 */

export const IMAGE_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
] as const;

export const VIDEO_ALLOWED_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const IMAGE_ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const VIDEO_ALLOWED_EXTS = ["mp4", "webm", "mov"] as const;

export const DENIED_EXTS = [
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "xml",
  "js",
  "mjs",
  "php",
  "phtml",
  "asp",
  "aspx",
  "jsp",
  "exe",
  "dll",
  "sh",
  "bat",
  "cmd",
];

export const MAX_PROFILE_BYTES = 5 * 1024 * 1024;
export const MAX_BANNER_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_MEDIA_VIDEO_BYTES = 100 * 1024 * 1024;

/** DRY-safe accept attribute strings for client inputs. */
export const ACCEPT_IMAGES = IMAGE_ALLOWED_MIMES.join(",");
export const ACCEPT_VIDEOS = VIDEO_ALLOWED_MIMES.join(",");

type ValidateResult = { ok: true } | { ok: false; error: string };

type UploadCategory = "image" | "video";

interface ValidateOptions {
  category: UploadCategory;
  maxBytes: number;
  filename?: string;
}

interface MagicSignature {
  bytes: number[];
  offset?: number;
  mask?: number[];
  mime: string;
}

/** Known safe magic-byte signatures. Unknown signatures are rejected. */
const SAFE_SIGNATURES: MagicSignature[] = [
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: "image/gif" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: "image/gif" },
  {
    bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    mask: [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1],
    mime: "image/webp",
  },
  { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4" },
  { bytes: [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4" },
  { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4" },
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: "video/mp4" },
  { bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20], offset: 4, mime: "video/quicktime" },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: "video/webm" },
];

/** Patterns that indicate a text-based / script-capable file. */
const DENIED_TEXT_PREFIXES = [
  [0x3c, 0x73, 0x76, 0x67], // <svg
  [0x3c, 0x3f, 0x78, 0x6d, 0x6c], // <?xml
  [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45], // <!DOCTYPE
  [0x3c, 0x68, 0x74, 0x6d, 0x6c], // <html
  [0x3c, 0x48, 0x54, 0x4d, 0x4c], // <HTML
  [0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74], // <script
];

function bytesMatch(buf: Uint8Array, sig: MagicSignature): boolean {
  const start = sig.offset ?? 0;
  if (buf.length < start + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    const maskByte = sig.mask?.[i] ?? 1;
    if (maskByte === 0) continue;
    if (buf[start + i] !== sig.bytes[i]) return false;
  }
  return true;
}

function matchesDeniedPrefix(buf: Uint8Array): boolean {
  let start = 0;
  while (start < buf.length && (buf[start] === 0x20 || buf[start] === 0x09 || buf[start] === 0x0a || buf[start] === 0x0d || buf[start] === 0xfe || buf[start] === 0xff || buf[start] === 0xef || buf[start] === 0xbb || buf[start] === 0xbf)) {
    start++;
    if (start > 3) break;
  }
  for (const prefix of DENIED_TEXT_PREFIXES) {
    if (buf.length < start + prefix.length) continue;
    let match = true;
    for (let i = 0; i < prefix.length; i++) {
      if (buf[start + i] !== prefix[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function extensionOf(filename: string | undefined): string {
  if (!filename) return "";
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function detectMimeFromMagic(buf: Uint8Array): string | null {
  for (const sig of SAFE_SIGNATURES) {
    if (bytesMatch(buf, sig)) return sig.mime;
  }
  return null;
}

export async function validateUpload(
  file: File | Blob,
  opts: ValidateOptions
): Promise<ValidateResult> {
  if (!file || typeof file.size !== "number") {
    return { ok: false, error: "Invalid file." };
  }

  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }

  if (file.size > opts.maxBytes) {
    const mb = (opts.maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `File is too large. Max ${mb} MB.` };
  }

  const filename =
    opts.filename ?? (file instanceof File ? file.name : undefined);
  const ext = extensionOf(filename);

  if (ext && DENIED_EXTS.includes(ext)) {
    return { ok: false, error: "File type not allowed." };
  }

  const allowedExts =
    opts.category === "image" ? IMAGE_ALLOWED_EXTS : VIDEO_ALLOWED_EXTS;
  if (ext && !allowedExts.includes(ext as never)) {
    return { ok: false, error: "File extension not allowed." };
  }

  const declaredMime = (file.type || "").toLowerCase();
  const allowedMimes =
    opts.category === "image" ? IMAGE_ALLOWED_MIMES : VIDEO_ALLOWED_MIMES;
  if (declaredMime && !allowedMimes.includes(declaredMime as never)) {
    return { ok: false, error: "File type not allowed." };
  }

  const head = new Uint8Array(
    await file.slice(0, 32).arrayBuffer()
  );

  if (matchesDeniedPrefix(head)) {
    return { ok: false, error: "File contents not allowed." };
  }

  const detected = detectMimeFromMagic(head);
  if (!detected) {
    return { ok: false, error: "Unrecognized file contents." };
  }

  if (!allowedMimes.includes(detected as never)) {
    return { ok: false, error: "File contents not allowed." };
  }

  if (declaredMime && declaredMime !== detected) {
    const webpEquivalent =
      declaredMime === "image/webp" && detected === "image/webp";
    const jpegEquivalent =
      detected === "image/jpeg" &&
      (declaredMime === "image/jpeg" || declaredMime === "image/jpg");
    const mp4Equivalent =
      detected === "video/mp4" &&
      (declaredMime === "video/mp4" || declaredMime === "application/mp4");
    if (!webpEquivalent && !jpegEquivalent && !mp4Equivalent) {
      return { ok: false, error: "File contents do not match declared type." };
    }
  }

  return { ok: true };
}

/** Strip extensions we never allow from a filename before persisting. */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const parts = base.split(".");
  if (parts.length < 2) return base;
  const ext = parts.pop()!.toLowerCase();
  if (DENIED_EXTS.includes(ext)) {
    return parts.join(".") + ".bin";
  }
  return parts.join(".") + "." + ext;
}
