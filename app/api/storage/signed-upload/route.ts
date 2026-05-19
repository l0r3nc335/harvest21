import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireAuth, requirePageOwnership } from "@/lib/apiAuth";
import { signedUploadSchema, parseBody } from "@/lib/validations";
import type { OrganizationType } from "@/lib/pageActions";
import { v4 as uuidv4 } from "uuid";
import { sanitizeFilename, DENIED_EXTS } from "@/lib/uploadValidation";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { reportServerError } from "@/lib/errorReporting";
import { logSecurityEvent } from "@/lib/securityLogger";

const BUCKET = "h21-dev";

// Security: allowlisted file extensions to prevent arbitrary file uploads.
// SVG is explicitly excluded (stored-XSS vector via embedded scripts).
const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "webm", "mov",
  "pdf",
]);


// Security: allowed folder names to prevent path traversal
const ALLOWED_FOLDERS = new Set([
  "videos", "photos", "documents", "thumbnails", "profile", "banner",
]);

const getPluralType = (type: OrganizationType): string => {
  switch (type) {
    case "missionary":
      return "missionaries";
    case "agency":
      return "agencies";
    case "college":
      return "colleges";
    case "church":
      return "churches";
    case "donor":
      return "donors";
    default:
      return `${type}s`;
  }
};

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", {
        ip,
        path: "/api/storage/signed-upload",
        method: "POST",
      });
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const rawBody = await request.json();
    const parsed = parseBody(signedUploadSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { organizationType, organizationId, fileName, folder, contentType } = parsed.data;

    const ext = fileName.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext) || DENIED_EXTS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: "File type not allowed" },
        { status: 400 }
      );
    }

    const EXT_TO_MIME: Record<string, string[]> = {
      jpg: ["image/jpeg"],
      jpeg: ["image/jpeg"],
      png: ["image/png"],
      gif: ["image/gif"],
      webp: ["image/webp"],
      mp4: ["video/mp4"],
      webm: ["video/webm"],
      mov: ["video/quicktime"],
      pdf: ["application/pdf"],
    };
    if (contentType) {
      const allowed = EXT_TO_MIME[ext] ?? [];
      if (!allowed.includes(contentType.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: "Content type does not match file extension" },
          { status: 400 }
        );
      }
    }

    // Security: validate folder to prevent path traversal
    const subFolder = folder || "videos";
    if (!ALLOWED_FOLDERS.has(subFolder) || subFolder.includes("..") || subFolder.includes("/")) {
      return NextResponse.json({ success: false, error: "Invalid folder" }, { status: 400 });
    }

    const supabaseAdmin = await getSupabaseServer();

    // Security: verify the user owns this organization/page
    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (page) {
      const ownerCheck = await requirePageOwnership(auth.id, page.id);
      if (ownerCheck instanceof NextResponse) return ownerCheck;
    } else {
      // No page yet — verify user owns the org directly
      let isOwner = false;
      if (organizationType === "missionary") {
        const { data: m } = await supabaseAdmin
          .from("missionaries").select("user_id").eq("id", organizationId).maybeSingle();
        isOwner = m?.user_id === auth.id;
      } else {
        const table = organizationType === "church" ? "churches"
          : organizationType === "agency" ? "agencies" : "colleges";
        const { data: org } = await supabaseAdmin
          .from(table).select("contact_user_id").eq("id", organizationId).maybeSingle();
        isOwner = org?.contact_user_id === auth.id;
      }
      if (!isOwner) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const sanitizedFileName = sanitizeFilename(fileName);
    const newFileName = `${uuidv4()}-${sanitizedFileName}`;
    const path = `${getPluralType(organizationType)}/${organizationId}/${subFolder}/${newFileName}`;

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      const { incidentId } = reportServerError(error ?? new Error("No signed URL"), {
        path: "/api/storage/signed-upload",
        method: "POST",
        userId: auth.id,
      });
      return NextResponse.json(
        { success: false, error: "Failed to create signed upload URL", incidentId },
        { status: 500 }
      );
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      path,
      publicUrl,
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/storage/signed-upload",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, error: "Unexpected error", incidentId },
      { status: 500 }
    );
  }
}
