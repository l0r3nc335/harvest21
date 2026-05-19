"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import type { SupporterProfile, SupporterProfileFormData, ActionResult } from "@/types/supporter";
import { updateUserLastActivity } from "@/lib/userActivityHelpers";

export async function getSupporterProfile(): Promise<ActionResult<SupporterProfile>> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("supporter_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching supporter profile:", error);
      return { success: false, error: "Failed to fetch profile" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getSupporterProfile:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateSupporterProfile(formData: SupporterProfileFormData): Promise<ActionResult> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    if (!formData.firstName || !formData.lastName || !formData.countryOfResidence) {
      return { success: false, error: "First name, last name, and country are required" };
    }

    const { error } = await supabase
      .from("supporter_profiles")
      .update({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber || null,
        country_of_residence: formData.countryOfResidence,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating supporter profile:", error);
      return { success: false, error: "Failed to update profile" };
    }

    const { error: userError } = await supabase
      .from("users")
      .update({
        first_name: formData.firstName,
        last_name: formData.lastName,
      })
      .eq("user_id", user.id);

    if (userError) {
      console.error("Error updating users table:", userError);
    }

    // Update user activity - Join relationship: public.users.user_id = auth.users.id
    await updateUserLastActivity(user.id, true);

    return { success: true, message: "Profile updated successfully" };
  } catch (error) {
    console.error("Error in updateSupporterProfile:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function requestEmailChange(newEmail: string): Promise<ActionResult> {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    if (!newEmail || !newEmail.includes("@")) {
      return { success: false, error: "Invalid email address" };
    }

    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      console.error("Error requesting email change:", error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      message: "Verification email sent. Please check your new email address to confirm the change." 
    };
  } catch (error) {
    console.error("Error in requestEmailChange:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

