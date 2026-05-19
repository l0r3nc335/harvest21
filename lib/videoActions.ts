"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";

export async function getPageData(pageId: number) {
  const supabaseAdmin = await getSupabaseServer();
  const { data: pageData } = await supabaseAdmin
    .from("pages")
    .select("organization_type, organization_id")
    .eq("id", pageId)
    .single();
  return pageData;
}

