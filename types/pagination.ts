export interface UserFollowerItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  note?: string | null;
}

export interface MissionaryFollowerItem {
  id: string;
  missionary_id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url: string | null;
  page_url: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  note?: string | null;
}

export interface MissionaryFollowingItem {
  id: string;
  /** @deprecated use entity_type + entity_id */
  missionary_id: number;
  missionary_name: string;
  page_url: string | null;
  profile_photo_url: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  /** When 'church', entity_id is church_id and unfollow uses church_followers */
  entity_type?: 'missionary' | 'church';
  /** Same as missionary_id when entity_type is missionary; church_id when entity_type is church */
  entity_id?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
}
