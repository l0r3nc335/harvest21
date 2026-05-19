import type { NotificationContentMetadata } from "@/types/missionaryContent";

export type FollowerStatus = 'none' | 'pending' | 'accepted' | 'rejected' | 'unfollowed';

export interface MissionaryFollower {
  id: number;
  missionary_id: number;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
}

export interface ChurchFollower {
  id: number;
  church_id: number;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  created_at: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_entity_type?: 'missionary' | 'church' | 'user' | 'follower' | 'missionary_follower' | 'church_follower' | 'page' | null;
  related_entity_id?: number | null;
  is_read: boolean;
  read_at?: string | null;
  page_url?: string | null;
  content_metadata?: NotificationContentMetadata | null;
}

export interface FollowerWithUser {
  id: number;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  created_at: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
    role?: number;
    profile_photo_url?: string | null;
  };
}
