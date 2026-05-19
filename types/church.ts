// Church Landing Page Types
// Based on EPIC: Church Landing Page requirements

export type ChurchFollowerStatus = 'none' | 'pending' | 'accepted' | 'rejected' | 'blocked' | 'unfollowed';

export type ChurchRelationshipType = 'sending' | 'supporting' | 'partner';

export interface Church {
  id: number;
  created_at?: string;
  name: string;
  contact_user_id?: string | null;
  email?: string | null;
  phone_number?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  description?: string | null; // Short tagline for hero banner
}

export interface ChurchListItem {
  id: string;
  name: string;
  location: string;
  accountStatus: "Active" | "Inactive" | "Pending";
  lastActivity: string;
  isManagedByHarvest21?: boolean;
}

export interface ChurchFollower {
  id: number;
  created_at?: string;
  updated_at?: string;
  church_id: number;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface ChurchMissionary {
  id: number;
  created_at?: string;
  church_id: number;
  missionary_id: number;
  relationship_type: ChurchRelationshipType;
  is_active: boolean;
}

export interface ChurchPage {
  id: number;
  organization_type: 'church';
  organization_id: number;
  page_url: string;
  name: string | null;
  profile_photo_url: string | null;
  banner_photo_url: string | null;
  short_quote: string | null;
  about_text: string | null;
  intro_text: string | null;
  template_content: string | null; // JSON with 7 fixed sections
  video_hashed_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at?: string;
  updated_at?: string;
}

// Fixed About Us sections for churches (CHLP-004)
export interface ChurchAboutUsContent {
  who_we_are: string;
  our_mission: string;
  our_vision: string;
  what_we_believe: string;
  our_ministries: string;
  join_us: string;
  contact_us: string;
}

export interface ChurchPublicViewData {
  church: Church;
  page: ChurchPage;
  media: Array<{
    id: number;
    media_type: 'image' | 'video';
    media_url: string;
    description?: string | null;
    thumbnail_url?: string | null;
    created_at: string;
  }>;
  missionaries?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    country_of_residence: string | null;
    page_url: string;
    profile_photo_url: string | null;
    page_name?: string | null;
  }>;
  followerStatus?: ChurchFollowerStatus;
  followerCount?: number;
}
