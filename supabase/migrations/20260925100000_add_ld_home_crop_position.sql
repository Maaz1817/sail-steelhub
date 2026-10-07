-- Store the focal point an admin chooses for the fixed-size L&D Home thumbnail.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS home_cover_position_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS home_cover_position_y smallint NOT NULL DEFAULT 50;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_home_cover_position_x_range,
  DROP CONSTRAINT IF EXISTS events_home_cover_position_y_range;

ALTER TABLE public.events
  ADD CONSTRAINT events_home_cover_position_x_range
    CHECK (home_cover_position_x BETWEEN 0 AND 100),
  ADD CONSTRAINT events_home_cover_position_y_range
    CHECK (home_cover_position_y BETWEEN 0 AND 100);
