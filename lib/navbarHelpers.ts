import { getSupabaseServer } from "@/lib/supabaseServer";

export type NavbarUserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
};

export async function getUserProfile(): Promise<NavbarUserProfile | null> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return null;
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("first_name, last_name, email, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (userError || !userData) {
      return null;
    }

    let page_url: string | null = null;
    let profile_photo_url: string | null = null;

    if (userData.role === 3) {
      const { data: missionaryData } = await supabase
        .from("missionaries")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (missionaryData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", missionaryData.id)
          .eq("organization_type", "missionary")
          .maybeSingle();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 4) {
      const { data: supporterProfile } = await supabase
        .from("supporter_profiles")
        .select("profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (supporterProfile) {
        profile_photo_url = supporterProfile.profile_photo_url;
      }
    } else if (userData.role === 5) {
      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id")
        .eq("contact_user_id", user.id)
        .maybeSingle();

      if (agencyData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", agencyData.id)
          .eq("organization_type", "agency")
          .maybeSingle();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 6) {
      const { data: churchData } = await supabase
        .from("churches")
        .select("id")
        .eq("contact_user_id", user.id)
        .maybeSingle();

      if (churchData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", churchData.id)
          .eq("organization_type", "church")
          .maybeSingle();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    } else if (userData.role === 7) {
      const { data: collegeData } = await supabase
        .from("colleges")
        .select("id")
        .eq("contact_user_id", user.id)
        .maybeSingle();

      if (collegeData) {
        const { data: pageData } = await supabase
          .from("pages")
          .select("page_url, profile_photo_url")
          .eq("organization_id", collegeData.id)
          .eq("organization_type", "college")
          .maybeSingle();

        if (pageData) {
          page_url = pageData.page_url;
          profile_photo_url = pageData.profile_photo_url;
        }
      }
    }

    return {
      id: user.id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      role: userData.role,
      profile_photo_url,
      page_url,
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}
