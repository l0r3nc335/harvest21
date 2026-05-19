export interface MissionaryFollowItem {
  id: number;
  followed_missionary_id: number;
  missionary_name: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  page_url?: string | null;
  profile_photo_url?: string | null;
  entity_type?: 'missionary' | 'church';
}

export interface MissionaryFollows {
  following: MissionaryFollowItem[];
  pending: MissionaryFollowItem[];
  rejected: MissionaryFollowItem[];
}

export interface MissionaryFollowerWithMissionary {
  id: number;
  follower_missionary_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  created_at: string;
  note?: string | null;
  missionary: {
    id?: number;
    first_name: string;
    last_name: string;
    email: string;
    user_id?: string | null;
    profile_photo_url?: string | null;
  };
}

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}
