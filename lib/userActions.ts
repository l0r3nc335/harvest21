"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  role_name: string;
  profile_photo_url: string | null;
  page_url: string | null;
};

export async function getAuthUserId(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await getSupabaseServer();
  const supabaseAdmin = supabase;

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, email, role")
      .eq("user_id", user.id)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data:", userError);
      return null;
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("id", userData.role)
      .single();

    let page_url: string | null = null;
    let profile_photo_url: string | null = null;

    if (userData.role === 3) {
      const { data: missionaryData } = await supabaseAdmin
        .from("missionaries")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (missionaryData) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", missionaryData.id)
          .eq("organization_type", "missionary")
          .single();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 4) {
      const { data: donorData } = await supabaseAdmin
        .from("donors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (donorData) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", donorData.id)
          .eq("organization_type", "supporter")
          .single();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 5) {
      const { data: agencyData } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("contact_user_id", user.id)
        .single();

      if (agencyData) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", agencyData.id)
          .eq("organization_type", "agency")
          .single();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 6) {
      const { data: churchData } = await supabaseAdmin
        .from("churches")
        .select("id")
        .eq("contact_user_id", user.id)
        .single();

      if (churchData) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", churchData.id)
          .eq("organization_type", "church")
          .single();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 7) {
      const { data: collegeData } = await supabaseAdmin
        .from("colleges")
        .select("id")
        .eq("contact_user_id", user.id)
        .single();

      if (collegeData) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", collegeData.id)
          .eq("organization_type", "college")
          .single();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    }

    return {
      id: userData.id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      role: userData.role,
      role_name: roleData?.role || "Unknown",
      profile_photo_url,
      page_url,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

