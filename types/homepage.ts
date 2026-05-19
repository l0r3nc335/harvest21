import type { FollowerStatus } from "@/types/follow";

export type BannerType = 'carousel' | 'static' | 'video';

export interface HomepageBanner {
  id: number;
  created_at?: string;
  updated_at?: string;
  banner_type: BannerType;
  is_active: boolean;
  display_order: number;
  location: string;
  description: string;
  image_url: string;
  scroll_duration: number;
}

export interface HomepageSettings {
  id: number;
  created_at?: string;
  updated_at?: string;
  banner_type: BannerType;
  auto_scroll: boolean;
  scroll_timing: number;
  show_navigation_arrows: boolean;
  show_pagination_dots: boolean;
}

export interface BannerFormData {
  location: string;
  description: string;
  image_url: string;
  is_active: boolean;
  display_order: number;
  scroll_duration?: number;
}

// Footer types
export interface FooterLink {
  id: number;
  created_at?: string;
  updated_at?: string;
  label: string;
  href: string;
  column_position: number;
  display_order: number;
  is_active: boolean;
}

export type FooterPageType = 
  | 'about_us' 
  | 'statement_of_faith' 
  | 'donate' 
  | 'faq' 
  | 'contact_us' 
  | 'privacy_policy' 
  | 'terms_of_use';

export interface FooterContent {
  id: number;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  page_type: FooterPageType;
  title: string;
  content: string;
}

export interface FooterLinkFormData {
  label: string;
  href: string;
  column_position: number;
  display_order: number;
  is_active: boolean;
}

// Featured Sections
export interface HomepageFeaturedSection {
  id: number;
  title: string;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface HomepageSectionProfile {
  id: number;
  section_id: number;
  profile_id: number;
  profile_type: 'missionary' | 'church' | 'agency';
  display_order: number;
}

export interface FeaturedProfileCard {
  section_profile_id: number;
  profile_id: number;
  profile_type: 'missionary' | 'church' | 'agency';
  page_url: string;
  profile_photo_url: string | null;
  name: string;
  display_order: number;
  country?: string | null;
  church_name?: string | null;
  is_managed_by_harvest21?: boolean;
  missionary_id?: number | null;
  follower_status?: FollowerStatus;
}

export interface FeaturedSectionWithProfiles {
  section: HomepageFeaturedSection;
  profiles: FeaturedProfileCard[];
}

