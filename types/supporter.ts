export interface SupporterProfile {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  country_of_residence: string;
  profile_photo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupporterProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  countryOfResidence: string;
}

export interface SignUpSupporterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  countryOfResidence: string;
}

export interface SupporterFollows {
  following: FollowItem[];
  pending: FollowItem[];
  rejected: FollowItem[];
}

export interface FollowItem {
  id: number;
  entity_type: 'missionary' | 'church';
  entity_id: number;
  follow_id: number;
  entity_name: string;
  profile_photo_url?: string | null;
  page_url?: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

