"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export type Prayer = {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  page_id: number | null;
  title: string | null;
  body: string;
  is_published: boolean;
  visibility: "public" | "private" | "supporters";
  amen_count: number;
  update_count: number;
  share_count: number;
  has_user_reacted?: boolean;
};

export type PrayerFormData = {
  title?: string | null;
  body: string;
  visibility?: "public" | "private" | "supporters";
};

export async function getPrayersForPage(
  pageId: number,
  userId?: string | null
): Promise<{ success: boolean; data?: Prayer[]; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: prayers, error } = await supabaseAdmin
      .from("prayers")
      .select("*")
      .eq("page_id", pageId)
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching prayers:", error);
      return { success: false, error: error.message };
    }

    if (!prayers || prayers.length === 0) {
      return { success: true, data: [] };
    }

    if (userId) {
      const prayerIds = prayers.map((p: Prayer) => p.id);
      const { data: reactions } = await supabaseAdmin
        .from("prayer_reactions")
        .select("prayer_id")
        .eq("user_id", userId)
        .in("prayer_id", prayerIds);

      const reactedPrayerIds = new Set(
        reactions?.map((r: { prayer_id: number }) => r.prayer_id) || []
      );

      const prayersWithReaction = prayers.map((prayer: Prayer) => ({
        ...prayer,
        has_user_reacted: reactedPrayerIds.has(prayer.id),
      }));

      return { success: true, data: prayersWithReaction };
    }

    return { success: true, data: prayers };
  } catch (error) {
    console.error("Error fetching prayers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function createPrayer(
  pageId: number,
  formData: PrayerFormData,
  social?: { postToFacebook?: boolean; postToInstagram?: boolean }
): Promise<{ success: boolean; data?: Prayer; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const supabaseAdmin = await getSupabaseServer();

    const { data: page, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("organization_type, organization_id")
      .eq("id", pageId)
      .single();

    if (pageError || !page) {
      console.error("Error fetching page for prayer creation:", pageError);
      return {
        success: false,
        error: "Page not found",
      };
    }

    let ownerUserId: string | null = null;

    if (page.organization_type === "missionary") {
      const { data: missionary } = await supabaseAdmin
        .from("missionaries")
        .select("user_id")
        .eq("id", page.organization_id)
        .single();
      ownerUserId = missionary?.user_id ?? null;
    } else if (page.organization_type === "agency") {
      const { data: agency } = await supabaseAdmin
        .from("agencies")
        .select("contact_user_id")
        .eq("id", page.organization_id)
        .single();
      ownerUserId = agency?.contact_user_id ?? null;
    } else if (page.organization_type === "church") {
      const { data: church } = await supabaseAdmin
        .from("churches")
        .select("contact_user_id")
        .eq("id", page.organization_id)
        .single();
      ownerUserId = church?.contact_user_id ?? null;
    } else if (page.organization_type === "college") {
      const { data: college } = await supabaseAdmin
        .from("colleges")
        .select("contact_user_id")
        .eq("id", page.organization_id)
        .single();
      ownerUserId = college?.contact_user_id ?? null;
    } else if (page.organization_type === "donor") {
      const { data: donor } = await supabaseAdmin
        .from("donors")
        .select("user_id")
        .eq("id", page.organization_id)
        .single();
      ownerUserId = donor?.user_id ?? null;
    }

    if (!ownerUserId || ownerUserId !== session.user.id) {
      return { success: false, error: "Not authorized to add prayers to this page" };
    }

    const { data: prayer, error } = await supabaseAdmin
      .from("prayers")
      .insert({
        user_id: session.user.id,
        page_id: pageId,
        title: formData.title || null,
        body: formData.body,
        visibility: formData.visibility || "public",
        is_published: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating prayer:", error);
      return { success: false, error: error.message };
    }

    const { data: pageData } = await supabaseAdmin
      .from("pages")
      .select("page_url")
      .eq("id", pageId)
      .single();

    if (pageData?.page_url) {
      revalidatePath(`/${pageData.page_url}`);
    }

    // Notify followers of new prayer request
    const { notifyMissionaryFollowers } = await import("@/lib/notificationHelpers");
    await notifyMissionaryFollowers(pageId, "prayer", formData.title || undefined, {
      sourceTable: "prayers",
      sourceId: prayer.id as number,
    });

    if (
      page.organization_type === "missionary" &&
      (social?.postToFacebook || social?.postToInstagram)
    ) {
      const { scheduleSocialCrossPost } = await import("@/lib/social-cross-post-schedule");
      scheduleSocialCrossPost({
        pageId,
        missionaryId: page.organization_id as number,
        sourceTable: "prayers",
        sourceId: prayer.id as number,
        kind: "prayer",
        postToFacebook: !!social.postToFacebook,
        postToInstagram: !!social.postToInstagram,
        textBody: formData.body,
      });
    }

    return { success: true, data: prayer };
  } catch (error) {
    console.error("Error creating prayer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updatePrayer(
  prayerId: number,
  formData: PrayerFormData
): Promise<{ success: boolean; data?: Prayer; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: existingPrayer } = await supabaseAdmin
      .from("prayers")
      .select("user_id, page_id")
      .eq("id", prayerId)
      .single();

    if (!existingPrayer) {
      return { success: false, error: "Prayer not found" };
    }

    if (existingPrayer.user_id !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    const { data: prayer, error } = await supabaseAdmin
      .from("prayers")
      .update({
        title: formData.title || null,
        body: formData.body,
        visibility: formData.visibility || "public",
        updated_at: new Date().toISOString(),
      })
      .eq("id", prayerId)
      .select()
      .single();

    if (error) {
      console.error("Error updating prayer:", error);
      return { success: false, error: error.message };
    }

    if (existingPrayer.page_id) {
      const { data: pageData } = await supabaseAdmin
        .from("pages")
        .select("page_url")
        .eq("id", existingPrayer.page_id)
        .single();

      if (pageData?.page_url) {
        revalidatePath(`/${pageData.page_url}`);
      }
    }

    return { success: true, data: prayer };
  } catch (error) {
    console.error("Error updating prayer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deletePrayer(
  prayerId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: existingPrayer } = await supabaseAdmin
      .from("prayers")
      .select("user_id, page_id")
      .eq("id", prayerId)
      .single();

    if (!existingPrayer) {
      return { success: false, error: "Prayer not found" };
    }

    if (existingPrayer.user_id !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    const { error } = await supabaseAdmin
      .from("prayers")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", prayerId);

    if (error) {
      console.error("Error deleting prayer:", error);
      return { success: false, error: error.message };
    }

    if (existingPrayer.page_id) {
      const { data: pageData } = await supabaseAdmin
        .from("pages")
        .select("page_url")
        .eq("id", existingPrayer.page_id)
        .single();

      if (pageData?.page_url) {
        revalidatePath(`/${pageData.page_url}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting prayer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function togglePrayerReaction(
  prayerId: number
): Promise<{ success: boolean; data?: { has_reacted: boolean; amen_count: number }; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: existingReaction } = await supabaseAdmin
      .from("prayer_reactions")
      .select("id")
      .eq("prayer_id", prayerId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (existingReaction) {
      const { error: deleteError } = await supabaseAdmin
        .from("prayer_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      const { data: prayer } = await supabaseAdmin
        .from("prayers")
        .select("amen_count")
        .eq("id", prayerId)
        .single();

      const newCount = Math.max(0, (prayer?.amen_count || 0) - 1);

      await supabaseAdmin
        .from("prayers")
        .update({ amen_count: newCount })
        .eq("id", prayerId);

      return {
        success: true,
        data: { has_reacted: false, amen_count: newCount },
      };
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("prayer_reactions")
        .insert({
          prayer_id: prayerId,
          user_id: session.user.id,
          type: "amen",
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      const { data: prayer } = await supabaseAdmin
        .from("prayers")
        .select("amen_count")
        .eq("id", prayerId)
        .single();

      const newCount = (prayer?.amen_count || 0) + 1;

      await supabaseAdmin
        .from("prayers")
        .update({ amen_count: newCount })
        .eq("id", prayerId);

      return {
        success: true,
        data: { has_reacted: true, amen_count: newCount },
      };
    }
  } catch (error) {
    console.error("Error toggling prayer reaction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sharePrayer(
  prayerId: number
): Promise<{ success: boolean; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: prayer } = await supabaseAdmin
      .from("prayers")
      .select("share_count")
      .eq("id", prayerId)
      .single();

    if (!prayer) {
      return { success: false, error: "Prayer not found" };
    }

    const newCount = (prayer.share_count || 0) + 1;

    const { error } = await supabaseAdmin
      .from("prayers")
      .update({ share_count: newCount })
      .eq("id", prayerId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sharing prayer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type PrayerUpdate = {
  id: number;
  created_at: string;
  user_id: string;
  prayer_id: number;
  body: string;
};

export async function getPrayerUpdates(
  prayerId: number
): Promise<{ success: boolean; data?: PrayerUpdate[]; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: updates, error } = await supabaseAdmin
      .from("prayer_updates")
      .select("*")
      .eq("prayer_id", prayerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching prayer updates:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: updates || [] };
  } catch (error) {
    console.error("Error fetching prayer updates:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type PrayerUpdateWithPrayer = PrayerUpdate & {
  prayer: Prayer;
};

export type PrayerWallItem = {
  id: string;
  content: string;
  date: string;
  prayer: Prayer;
  isUpdate: boolean;
  updateId?: number;
};

export async function getPrayerUpdatesForPage(
  pageId: number,
  userId?: string | null
): Promise<{ success: boolean; data?: PrayerWallItem[]; error?: string }> {
  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: prayers, error: prayersError } = await supabaseAdmin
      .from("prayers")
      .select("*")
      .eq("page_id", pageId)
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (prayersError) {
      console.error("Error fetching prayers for page:", prayersError);
      return { success: false, error: prayersError.message };
    }

    if (!prayers || prayers.length === 0) {
      return { success: true, data: [] };
    }

    const prayerIds = prayers.map((p: Prayer) => p.id);

    const { data: updates, error: updatesError } = await supabaseAdmin
      .from("prayer_updates")
      .select("*")
      .in("prayer_id", prayerIds)
      .order("created_at", { ascending: false });

    if (updatesError) {
      console.error("Error fetching prayer updates for page:", updatesError);
      return { success: false, error: updatesError.message };
    }

    const updatesMap = new Map<number, PrayerUpdate[]>();
    (updates || []).forEach((update: PrayerUpdate) => {
      if (!updatesMap.has(update.prayer_id)) {
        updatesMap.set(update.prayer_id, []);
      }
      updatesMap.get(update.prayer_id)!.push(update);
    });

    const wallItems: PrayerWallItem[] = [];

    prayers.forEach((prayer: Prayer) => {
      const prayerUpdates = updatesMap.get(prayer.id) || [];
      
      if (prayerUpdates.length > 0) {
        const latestUpdate = prayerUpdates.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        wallItems.push({
          id: `update-${latestUpdate.id}`,
          content: latestUpdate.body,
          date: latestUpdate.created_at,
          prayer: prayer,
          isUpdate: true,
          updateId: latestUpdate.id,
        });
      } else {
        wallItems.push({
          id: `prayer-${prayer.id}`,
          content: prayer.body,
          date: prayer.created_at,
          prayer: prayer,
          isUpdate: false,
        });
      }
    });

    wallItems.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (userId) {
      const allPrayerIds = wallItems.map((item) => item.prayer.id);
      const { data: reactions } = await supabaseAdmin
        .from("prayer_reactions")
        .select("prayer_id")
        .eq("user_id", userId)
        .in("prayer_id", allPrayerIds);

      const reactedPrayerIds = new Set(
        reactions?.map((r: { prayer_id: number }) => r.prayer_id) || []
      );

      const itemsWithReaction = wallItems.map((item) => ({
        ...item,
        prayer: {
          ...item.prayer,
          has_user_reacted: reactedPrayerIds.has(item.prayer.id),
        },
      }));

      return { success: true, data: itemsWithReaction };
    }

    return { success: true, data: wallItems };
  } catch (error) {
    console.error("Error fetching prayer updates for page:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function createPrayerUpdate(
  prayerId: number,
  body: string
): Promise<{ success: boolean; data?: PrayerUpdate; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: update, error } = await supabaseAdmin
      .from("prayer_updates")
      .insert({
        prayer_id: prayerId,
        user_id: session.user.id,
        body: body.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating prayer update:", error);
      return { success: false, error: error.message };
    }

    const { data: prayer } = await supabaseAdmin
      .from("prayers")
      .select("page_id, update_count")
      .eq("id", prayerId)
      .single();

    if (prayer) {
      const newCount = (prayer.update_count || 0) + 1;
      await supabaseAdmin
        .from("prayers")
        .update({ update_count: newCount })
        .eq("id", prayerId);

      if (prayer.page_id) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url")
          .eq("id", prayer.page_id)
          .single();

        if (pageData?.page_url) {
          revalidatePath(`/${pageData.page_url}`);
        }
      }
    }

    return { success: true, data: update };
  } catch (error) {
    console.error("Error creating prayer update:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updatePrayerUpdate(
  updateId: number,
  body: string
): Promise<{ success: boolean; data?: PrayerUpdate; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: existingUpdate } = await supabaseAdmin
      .from("prayer_updates")
      .select("user_id")
      .eq("id", updateId)
      .single();

    if (!existingUpdate) {
      return { success: false, error: "Update not found" };
    }

    if (existingUpdate.user_id !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    const { data: update, error } = await supabaseAdmin
      .from("prayer_updates")
      .update({ body: body.trim() })
      .eq("id", updateId)
      .select()
      .single();

    if (error) {
      console.error("Error updating prayer update:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: update };
  } catch (error) {
    console.error("Error updating prayer update:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deletePrayerUpdate(
  updateId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseAdmin = await getSupabaseServer();

  try {
    const { data: existingUpdate } = await supabaseAdmin
      .from("prayer_updates")
      .select("user_id, prayer_id")
      .eq("id", updateId)
      .single();

    if (!existingUpdate) {
      return { success: false, error: "Update not found" };
    }

    if (existingUpdate.user_id !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    const { error } = await supabaseAdmin
      .from("prayer_updates")
      .delete()
      .eq("id", updateId);

    if (error) {
      console.error("Error deleting prayer update:", error);
      return { success: false, error: error.message };
    }

    const { data: prayer } = await supabaseAdmin
      .from("prayers")
      .select("page_id, update_count")
      .eq("id", existingUpdate.prayer_id)
      .single();

    if (prayer) {
      const newCount = Math.max(0, (prayer.update_count || 0) - 1);
      await supabaseAdmin
        .from("prayers")
        .update({ update_count: newCount })
        .eq("id", existingUpdate.prayer_id);

      if (prayer.page_id) {
        const { data: pageData } = await supabaseAdmin
          .from("pages")
          .select("page_url")
          .eq("id", prayer.page_id)
          .single();

        if (pageData?.page_url) {
          revalidatePath(`/${pageData.page_url}`);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting prayer update:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

