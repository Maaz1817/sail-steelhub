-- The Home gallery can use a deliberately selected crop-friendly image without
-- changing the cover used on the activity detail page.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS home_cover_image_url text;

UPDATE public.events
SET home_cover_image_url = cover_image_url
WHERE home_cover_image_url IS NULL
  AND cover_image_url IS NOT NULL;
