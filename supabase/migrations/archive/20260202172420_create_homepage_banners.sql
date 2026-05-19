-- Create homepage_banners table
CREATE TABLE IF NOT EXISTS public.homepage_banners (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  banner_type text DEFAULT 'carousel' CHECK (banner_type = ANY (ARRAY['carousel'::text, 'static'::text, 'video'::text])),
  is_active boolean DEFAULT true,
  display_order integer NOT NULL,
  
  location text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL,
  scroll_duration integer DEFAULT 5000,
  
  CONSTRAINT homepage_banners_pkey PRIMARY KEY (id)
);

-- Create homepage_settings table
CREATE TABLE IF NOT EXISTS public.homepage_settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  banner_type text DEFAULT 'carousel' CHECK (banner_type = ANY (ARRAY['carousel'::text, 'static'::text, 'video'::text])),
  auto_scroll boolean DEFAULT true,
  scroll_timing integer DEFAULT 5000,
  show_navigation_arrows boolean DEFAULT true,
  show_pagination_dots boolean DEFAULT true,
  
  CONSTRAINT homepage_settings_pkey PRIMARY KEY (id)
);

-- Insert default settings
INSERT INTO public.homepage_settings (banner_type, auto_scroll, scroll_timing) 
VALUES ('carousel', true, 5000)
ON CONFLICT DO NOTHING;

-- Insert default banner data
INSERT INTO public.homepage_banners (location, description, image_url, display_order, is_active) VALUES
  ('Chile', 'Only about 17% of Chileans identify as evangelical—leaving the vast majority still unreached with the true gospel.', '/Images/Carousel/Chile.png', 1, true),
  ('South America', 'With over 435 million people, 56 missionaries are raising support to share the Gospel across this diverse continent.', '/Images/Carousel/Brazil.png', 2, true),
  ('Africa', 'Africa is a diverse continent where many regions are still waiting to hear the gospel message.', '/Images/Carousel/Africa.png', 3, true),
  ('Asia', 'Asia is home to billions, with countless communities yet to be reached with the good news.', '/Images/Carousel/Asia.png', 4, true),
  ('Australia', 'Australia''s multicultural society presents unique opportunities and challenges for gospel outreach.', '/Images/Carousel/Australia.png', 5, true),
  ('Brazil', 'Brazil is home to the largest evangelical population in South America, but millions remain unreached.', '/Images/Carousel/Brazil.png', 6, true),
  ('Germany', 'Germany, with its rich history, still has many who have not encountered the transforming power of the gospel.', '/Images/Carousel/Germany.png', 7, true),
  ('Thailand', 'Thailand presents unique opportunities for sharing the gospel in Southeast Asia.', '/Images/Carousel/Thailand.png', 8, true)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.homepage_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for homepage_banners (public read, admin write)
CREATE POLICY "Anyone can view active banners"
  ON public.homepage_banners FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all banners"
  ON public.homepage_banners FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert banners"
  ON public.homepage_banners FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update banners"
  ON public.homepage_banners FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete banners"
  ON public.homepage_banners FOR DELETE
  USING (public.is_admin());

-- RLS Policies for homepage_settings (public read, admin write)
CREATE POLICY "Anyone can view homepage settings"
  ON public.homepage_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update homepage settings"
  ON public.homepage_settings FOR UPDATE
  USING (public.is_admin());