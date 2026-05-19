export type MediaItem = {
  id: number;
  media_type: "image" | "video";
  media_url: string;
  description?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
};

