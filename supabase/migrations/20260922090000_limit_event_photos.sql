-- An L&D activity gallery is intentionally small and mobile-friendly.
-- The admin server function also applies this rule; the trigger protects the
-- database if photos are added through any other admin tool.

CREATE OR REPLACE FUNCTION public.enforce_event_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.event_photos
    WHERE event_id = NEW.event_id
  ) >= 5 THEN
    RAISE EXCEPTION 'An L&D activity can have a maximum of 5 photos.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_photo_limit_before_insert ON public.event_photos;

CREATE TRIGGER event_photo_limit_before_insert
  BEFORE INSERT ON public.event_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_photo_limit();
