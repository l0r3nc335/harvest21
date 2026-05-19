import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireAuth, requirePageOwnership } from "@/lib/apiAuth";

export async function DELETE(request: Request) {
  try {
    // Security: require authentication
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const widgetId = Number(searchParams.get("id"));

    if (!widgetId) {
      return NextResponse.json({ success: false, message: "Missing widget id" }, { status: 400 });
    }

    const supabaseAdmin = await getSupabaseServer();

    const { data: widgetRecord, error: fetchError } = await supabaseAdmin
      .from("page_widgets")
      .select("widget_data, page_id, widget_type")
      .eq("id", widgetId)
      .single();

    if (fetchError || !widgetRecord) {
      return NextResponse.json({ success: false, message: "Widget record not found" }, { status: 404 });
    }

    // Security: verify user owns the page this widget belongs to
    const ownerCheck = await requirePageOwnership(auth.id, widgetRecord.page_id);
    if (ownerCheck instanceof NextResponse) return ownerCheck;

    const supabaseStorageHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const filesToDelete: string[] = [];

    const extractPath = (url: string) => {
      if (!supabaseStorageHost || !url.includes(supabaseStorageHost)) return null;
      const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      return match ? { bucket: match[1], path: match[2] } : null;
    };

    if (widgetRecord.widget_data) {
      const widgetData = widgetRecord.widget_data as Record<string, unknown>;
      
      if (widgetData.pdf_url && typeof widgetData.pdf_url === 'string') {
        const pdfPath = extractPath(widgetData.pdf_url);
        if (pdfPath) filesToDelete.push(pdfPath.path);
      }

      if (widgetData.thumbnail_url && typeof widgetData.thumbnail_url === 'string') {
        const thumbPath = extractPath(widgetData.thumbnail_url);
        if (thumbPath) filesToDelete.push(thumbPath.path);
      }
    }

    if (filesToDelete.length > 0) {
      const firstPath = extractPath(
        (widgetRecord.widget_data as Record<string, unknown>)?.pdf_url as string || 
        (widgetRecord.widget_data as Record<string, unknown>)?.thumbnail_url as string
      );
      if (firstPath) {
        await supabaseAdmin.storage.from(firstPath.bucket).remove(filesToDelete);
      }
    }

    const { error: deleteError } = await supabaseAdmin.from("page_widgets").delete().eq("id", widgetId);
    if (deleteError) {
      return NextResponse.json(
        { success: false, message: deleteError.message || "Failed to delete widget" },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", widgetRecord.page_id);

    return NextResponse.json({
      success: true,
      message: "Widget deleted successfully!",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

