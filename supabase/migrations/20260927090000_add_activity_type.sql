-- Activities share the same photo-gallery feature, while showing separately as L&D or Other.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'ld';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_activity_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_activity_type_check
    CHECK (activity_type IN ('ld', 'other'));

UPDATE public.events
SET activity_type = 'ld'
WHERE activity_type IS NULL OR activity_type NOT IN ('ld', 'other');
