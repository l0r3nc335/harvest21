-- Remove font customization fields from homepage_banners
ALTER TABLE public.homepage_banners 
  DROP COLUMN IF EXISTS title_font_family,
  DROP COLUMN IF EXISTS title_font_size,
  DROP COLUMN IF EXISTS description_font_family,
  DROP COLUMN IF EXISTS description_font_size;

-- Remove font fields from homepage_settings
ALTER TABLE public.homepage_settings 
  DROP COLUMN IF EXISTS default_title_font,
  DROP COLUMN IF EXISTS default_description_font;

