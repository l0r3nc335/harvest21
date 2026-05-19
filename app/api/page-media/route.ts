import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireAuth, requirePageOwnership } from "@/lib/apiAuth";
import { pageMediaCreateSchema, parseBody } from "@/lib/validations";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { reportServerError } from "@/lib/errorReporting";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/page-media", method: "POST" });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const rawBody = await request.json();
    const parsed = parseBody(pageMediaCreateSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
    }
    const { pageId, mediaUrl, description, thumbnailUrl, postToFacebook, postToInstagram } = parsed.data;

    const ownerCheck = await requirePageOwnership(auth.id, pageId);
    if (ownerCheck instanceof NextResponse) return ownerCheck;

    const supabase = await getSupabaseServer();

    const { data, error } = await supabase
      .from("page_media")
      .insert({
        page_id: pageId,
        media_type: "video",
        media_url: mediaUrl,
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
        hashed_id: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      const { incidentId } = reportServerError(error, {
        path: "/api/page-media",
        method: "POST",
        userId: auth.id,
        extra: { step: "insert_page_media" },
      });
      return NextResponse.json(
        { success: false, message: "Failed to upload media", incidentId },
        { status: 500 }
      );
    }

    await supabase
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", pageId);

    const { notifyMissionaryFollowers } = await import("@/lib/notificationHelpers");
    await notifyMissionaryFollowers(pageId, "video", description || undefined, {
      sourceTable: "page_media",
      sourceId: data.id as number,
    });

    if (postToFacebook || postToInstagram) {
      const { data: pageRow } = await supabase
        .from("pages")
        .select("organization_type, organization_id")
        .eq("id", pageId)
        .maybeSingle();
      if (pageRow?.organization_type === "missionary") {
        const { scheduleSocialCrossPost } = await import("@/lib/social-cross-post-schedule");
        scheduleSocialCrossPost({
          pageId,
          missionaryId: pageRow.organization_id as number,
          sourceTable: "page_media",
          sourceId: data.id as number,
          kind: "video",
          postToFacebook: !!postToFacebook,
          postToInstagram: !!postToInstagram,
          textBody: (description as string) || "",
          mediaUrl,
          mediaType: "video",
        });
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/page-media",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, message: "Unexpected error", incidentId },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "general");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/page-media", method: "DELETE" });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const mediaId = Number(searchParams.get("id"));

    if (!mediaId) {
      return NextResponse.json({ success: false, message: "Missing media id" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();

    const { data: mediaRecord, error: fetchError } = await supabase
      .from("page_media")
      .select("media_url, thumbnail_url, page_id")
      .eq("id", mediaId)
      .maybeSingle();

    if (fetchError || !mediaRecord) {
      return NextResponse.json({ success: false, message: "Media record not found" }, { status: 404 });
    }

    const ownerCheck = await requirePageOwnership(auth.id, mediaRecord.page_id);
    if (ownerCheck instanceof NextResponse) return ownerCheck;

    const supabaseStorageHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const filesToDelete: string[] = [];

    const extractPath = (url: string) => {
      if (!supabaseStorageHost || !url.includes(supabaseStorageHost)) return null;
      const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      return match ? { bucket: match[1], path: match[2] } : null;
    };

    const videoPath = extractPath(mediaRecord.media_url);
    if (videoPath) filesToDelete.push(videoPath.path);

    if (mediaRecord.thumbnail_url) {
      const thumbPath = extractPath(mediaRecord.thumbnail_url);
      if (thumbPath) filesToDelete.push(thumbPath.path);
    }

    if (filesToDelete.length > 0 && videoPath) {
      await supabase.storage.from(videoPath.bucket).remove(filesToDelete);
    }

    const { error: deleteError } = await supabase.from("page_media").delete().eq("id", mediaId);
    if (deleteError) {
      const { incidentId } = reportServerError(deleteError, {
        path: "/api/page-media",
        method: "DELETE",
        userId: auth.id,
        extra: { step: "delete_page_media", mediaId },
      });
      return NextResponse.json(
        { success: false, message: "Failed to delete media", incidentId },
        { status: 500 }
      );
    }

    await supabase
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", mediaRecord.page_id);

    return NextResponse.json({
      success: true,
      message: "Media deleted successfully!",
      fileUrl: mediaRecord.media_url,
      thumbnailUrl: mediaRecord.thumbnail_url,
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/page-media",
      method: "DELETE",
    });
    return NextResponse.json(
      { success: false, message: "Unexpected error", incidentId },
      { status: 500 }
    );
  }
}
