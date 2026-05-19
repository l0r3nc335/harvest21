// Mission Agency Landing Page Types
// Based on MA-LP requirements (Mission Agency Landing Page)

export interface Agency {
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
}

export interface AgencyListItem {
  id: string;
  name: string;
  location: string;
  accountStatus: "Active" | "Inactive" | "Pending";
  lastActivity: string;
  missionaryCount?: number;
  isManagedByHarvest21?: boolean;
}

export interface AgencyPage {
  id: number;
  organization_type: 'agency';
  organization_id: number;
  page_url: string;
  name: string | null;
  banner_photo_url: string | null;
  short_quote: string | null;
  template_content: string | null; // JSON with 7 fixed sections
  video_hashed_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at?: string;
  updated_at?: string;
}

// Fixed About Us sections for agencies (MA-LP-006)
// All 7 sections are REQUIRED
export interface AgencyAboutUsContent {
  who_we_are: string;              // Who We Are
  mission_vision: string;           // Mission / Vision
  what_we_do: string;              // What We Do
  where_we_serve: string;          // Where We Serve
  how_we_operate: string;          // How We Operate
  values: string;                   // Values
  contact_information: string;      // Contact Information
}

export interface AgencyPublicViewData {
  agency: Agency;
  page: AgencyPage;
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
}
