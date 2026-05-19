"use client";

import { MissionaryPublicView } from "@/components/missionary/MissionaryPublicView";

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: number;
  profile_photo_url: string | null;
  page_url: string | null;
  page_name?: string | null;
};

type MissionaryInlinePreviewProps = {
  missionary: {
    id: number;
    first_name: string;
    last_name: string;
    destination_country: string | null;
    user_id?: string | null;
    is_managed_by_harvest21?: boolean;
    agency?: {
      id: number;
      name: string;
    } | null;
    church?: {
      id: number;
      name: string;
    } | null;
  };
  page: {
    id: number;
    page_url: string;
    name: string | null;
    profile_photo_url: string | null;
    banner_photo_url: string | null;
    short_quote: string | null;
    about_text: string | null;
    intro_text: string | null;
    page_template: string | null;
    template_content: string | null;
    video_hashed_id: string | null;
    donation_percentage: number | null;
    is_published: boolean;
    published_at: string | null;
  };
  media: Array<{
    id: number;
    media_type: "image" | "video";
    media_url: string;
    description?: string | null;
    thumbnail_url?: string | null;
    created_at: string;
  }>;
  widgets: Array<{
    id: number;
    widget_type: string;
    widget_title: string;
    widget_data: Record<string, unknown>;
    created_at: string;
  }>;
  donations?: {
    totalPledged: number;
    totalReceived: number;
  };
  onBack: () => void;
  readOnly?: boolean;
  initialUserProfile?: UserProfile | null;
};


export function MissionaryInlinePreview({
  missionary,
  page,
  media,
  widgets,
  donations,
  onBack,
  readOnly = false,
  initialUserProfile = null,
}: MissionaryInlinePreviewProps) {
  return (
    <MissionaryPublicView
      missionary={missionary}
      page={page}
      media={media}
      widgets={widgets}
      donations={donations}
      isAdminPreview={true}
      onBack={onBack}
      readOnly={readOnly}
      initialUserProfile={initialUserProfile}
    />
  );
}

