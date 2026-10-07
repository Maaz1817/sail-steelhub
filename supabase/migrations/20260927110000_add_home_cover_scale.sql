-- Store an optional zoom level chosen by an admin for the small Home activity image.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS home_cover_scale numeric(3,2) NOT NULL DEFAULT 1;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_home_cover_scale_range;

ALTER TABLE public.events
  ADD CONSTRAINT events_home_cover_scale_range
    CHECK (home_cover_scale BETWEEN 1 AND 2.5);
