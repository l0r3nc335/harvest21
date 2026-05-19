import "server-only";
import { getSupabaseServer } from "@/lib/supabaseServer";

type JsonMetadata = Record<string, unknown> | object;

export interface CreateNotificationInput {
  targetUserId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  contentMetadata?: JsonMetadata | null;
}

export interface BroadcastFollowersInput {
  missionaryId: number;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  contentMetadata?: JsonMetadata | null;
}

export interface BroadcastStaffInput {
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  contentMetadata?: JsonMetadata | null;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<{ id: number | null; error: string | null }> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("create_notification", {
    p_target_user_id: input.targetUserId,
    p_type: input.type,
    p_title: input.title,
    p_message: input.message,
    p_related_entity_type: input.relatedEntityType ?? null,
    p_related_entity_id: input.relatedEntityId ?? null,
    p_content_metadata: input.contentMetadata ?? null,
  });
  if (error) {
    return { id: null, error: error.message };
  }
  return { id: (data as number) ?? null, error: null };
}

export async function broadcastMissionaryFollowersNotification(
  input: BroadcastFollowersInput
): Promise<{ inserted: number; error: string | null }> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc(
    "broadcast_missionary_followers_notification",
    {
      p_missionary_id: input.missionaryId,
      p_type: input.type,
      p_title: input.title,
      p_message: input.message,
      p_related_entity_type: input.relatedEntityType ?? null,
      p_related_entity_id: input.relatedEntityId ?? null,
      p_content_metadata: input.contentMetadata ?? null,
    }
  );
  if (error) {
    return { inserted: 0, error: error.message };
  }
  return { inserted: (data as number) ?? 0, error: null };
}

export async function broadcastStaffNotification(
  input: BroadcastStaffInput
): Promise<{ inserted: number; error: string | null }> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("broadcast_staff_notification", {
    p_type: input.type,
    p_title: input.title,
    p_message: input.message,
    p_related_entity_type: input.relatedEntityType ?? null,
    p_related_entity_id: input.relatedEntityId ?? null,
    p_content_metadata: input.contentMetadata ?? null,
  });
  if (error) {
    return { inserted: 0, error: error.message };
  }
  return { inserted: (data as number) ?? 0, error: null };
}
