-- Homepage Featured Sections
-- Run this in Supabase SQL editor

CREATE TABLE public.homepage_featured_sections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- profile_id references pages(id) directly — cascades on page delete
-- profile_type is denormalized from pages.organization_type at insert time
CREATE TABLE public.homepage_section_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES public.homepage_featured_sections(id) ON DELETE CASCADE,
  profile_id BIGINT NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('missionary', 'church', 'agency')),
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(section_id, profile_id)
);
