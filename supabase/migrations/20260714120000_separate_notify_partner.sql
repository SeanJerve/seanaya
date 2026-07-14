-- Create the shared notification function
CREATE OR REPLACE FUNCTION public.notify_partner_shared(_rel_id uuid, _actor_id uuid, _kind text, _entity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  partner UUID; rel RECORD; pref RECORD; allow boolean;
BEGIN
  SELECT * INTO rel FROM public.relationships WHERE id = _rel_id;
  IF rel IS NULL THEN RETURN; END IF;
  partner := CASE WHEN rel.user_a_id = _actor_id THEN rel.user_b_id ELSE rel.user_a_id END;
  IF partner IS NULL THEN RETURN; END IF;

  SELECT * INTO pref FROM public.notification_preferences WHERE user_id = partner;
  allow := CASE _kind
    WHEN 'memory'  THEN COALESCE(pref.memory,  true)
    WHEN 'event'   THEN COALESCE(pref.event,   true)
    WHEN 'trip'    THEN COALESCE(pref.trip,    true)
    WHEN 'note'    THEN COALESCE(pref.note,    true)
    WHEN 'song'    THEN COALESCE(pref.song,    true)
    WHEN 'hug'     THEN COALESCE(pref.hug,     true)
    WHEN 'capsule' THEN COALESCE(pref.capsule, true)
    ELSE true
  END;

  IF NOT allow THEN RETURN; END IF;

  INSERT INTO public.notifications (relationship_id, user_id, kind, ref_id, read)
  VALUES (_rel_id, partner, _kind::public.notification_kind, _entity_id, false);
END; $$;

-- Separate trigger functions for each table
CREATE OR REPLACE FUNCTION public.notify_partner_memory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_partner_shared(NEW.relationship_id, NEW.created_by, 'memory', NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_partner_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_partner_shared(NEW.relationship_id, NEW.created_by, 'event', NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_partner_trip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_partner_shared(NEW.relationship_id, NEW.created_by, 'trip', NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_partner_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_partner_shared(NEW.relationship_id, NEW.author_id, 'note', NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_partner_song()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_partner_shared(NEW.relationship_id, auth.uid(), 'song', NEW.id);
  RETURN NEW;
END; $$;

-- Recreate triggers to point to new functions
DROP TRIGGER IF EXISTS trg_notify_memory ON public.memories;
CREATE TRIGGER trg_notify_memory AFTER INSERT ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_memory();

DROP TRIGGER IF EXISTS trg_notify_event ON public.events;
CREATE TRIGGER trg_notify_event AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_event();

DROP TRIGGER IF EXISTS trg_notify_note ON public.notes;
CREATE TRIGGER trg_notify_note AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_note();

DROP TRIGGER IF EXISTS trg_notify_trip ON public.trips;
CREATE TRIGGER trg_notify_trip AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_trip();

DROP TRIGGER IF EXISTS trg_notify_song ON public.songs;
CREATE TRIGGER trg_notify_song AFTER INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_song();
