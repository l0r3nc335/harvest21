"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import type { OrganizationType } from "./pageActions";

export type PageDataWithRelations = {
  page: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    is_review: boolean | null;
    donation_mode: "harvest21" | "external" | "off" | null;
    external_donation_url: string | null;
  } | null;
  media: Array<{
    id: number;
    media_type: string;
    media_url: string;
    created_at: string;
  }>;
  widgets: Array<{
    id: number;
    widget_type: string;
    widget_title: string;
    widget_data: Record<string, unknown>;
    created_at: string;
  }>;
};

export async function getPageDataWithRelations(
  organizationType: OrganizationType,
  organizationId: number
): Promise<PageDataWithRelations> {
  const supabase = await getSupabaseServer();

  try {
    const { data: pageData } = await supabase
      .from("pages")
      .select("*")
      .eq("organization_type", organizationType)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!pageData) {
      return {
        page: null,
        media: [],
        widgets: [],
      };
    }

    const pageId = pageData.id;

    const [mediaResult, widgetsResult] = await Promise.all([
      supabase
        .from("page_media")
        .select("*")
        .eq("page_id", pageId)
        .neq("media_url", "placeholder")
        .order("created_at", { ascending: false }),
      supabase
        .from("page_widgets")
        .select("*")
        .eq("page_id", pageId)
        .not("widget_type", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    const media = (mediaResult.data || []) as Array<{
      id: number;
      media_type: string;
      media_url: string;
      created_at: string;
    }>;

    const widgets = (widgetsResult.data || []) as Array<{
      id: number;
      widget_type: string;
      widget_title: string;
      widget_data: Record<string, unknown>;
      created_at: string;
    }>;

    const page = pageData as Record<string, unknown>;
    return {
      page: {
        id: pageData.id,
        page_url: pageData.page_url,
        name: pageData.name,
        profile_photo_url: pageData.profile_photo_url,
        banner_photo_url: pageData.banner_photo_url,
        short_quote: pageData.short_quote,
        about_text: pageData.about_text,
        intro_text: pageData.intro_text,
        template_content: pageData.template_content,
        video_hashed_id: pageData.video_hashed_id,
        donation_percentage: pageData.donation_percentage,
        is_published: pageData.is_published,
        is_review: pageData.is_review,
        donation_mode: (page.donation_mode as "harvest21" | "external" | "off") ?? null,
        external_donation_url: (page.external_donation_url as string | null) ?? null,
      },
      media,
      widgets,
    };
  } catch (error) {
    console.error("Error fetching page data with relations:", error);
    return {
      page: null,
      media: [],
      widgets: [],
    };
  }
}
