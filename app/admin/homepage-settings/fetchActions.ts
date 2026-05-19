import { getSupabaseServer } from "@/lib/supabaseServer";
import { getServiceRoleSupabase } from "@/lib/supabaseServiceRoleClient";
import { assertAdminOrStaff } from "@/lib/apiAuth";
import { HomepageBanner, HomepageSettings } from "@/types/homepage";

export async function fetchHomepageBanners() {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching homepage banners:", error);
    return { success: false, error: error.message, data: null };
  }

  return { success: true, data: data as HomepageBanner[], error: null };
}

export async function fetchActiveBanners() {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.rpc("public_homepage_active_banners");

  if (error) {
    console.error("Error fetching active banners:", error);
    return { success: false, error: error.message, data: null };
  }

  return { success: true, data: (data ?? []) as HomepageBanner[], error: null };
}

export async function fetchHomepageSettings() {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("homepage_settings")
    .select("*")
    .single();

  if (error) {
    console.error("Error fetching homepage settings:", error);
    return { success: false, error: error.message, data: null };
  }

  return { success: true, data: data as HomepageSettings, error: null };
}

export async function fetchActiveHomepageSettings() {
  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.rpc("public_homepage_settings_row");

  if (error) {
    console.error("Error fetching active homepage settings:", error);
    return { success: false, error: error.message, data: null };
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  const row = rows[0] as HomepageSettings | undefined;
  return { success: true, data: row ?? null, error: null };
}

export async function fetchBannerById(id: number) {
  await assertAdminOrStaff();
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching banner:", error);
    return { success: false, error: error.message, data: null };
  }

  return { success: true, data: data as HomepageBanner, error: null };
}

