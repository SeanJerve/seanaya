
-- 1) Shared PIN on relationship
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- 2) Memory cover photo
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_path TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

-- 3) Notes: image support + board position + kind expansion
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS pos_x REAL,
  ADD COLUMN IF NOT EXISTS pos_y REAL,
  ADD COLUMN IF NOT EXISTS rotation REAL;

-- 4) Notifications helper: notify the OTHER partner when content is created
CREATE OR REPLACE FUNCTION public.notify_partner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  partner UUID;
  rel RECORD;
  actor UUID := NEW.created_by;
  kind TEXT := TG_ARGV[0];
  title TEXT;
BEGIN
  SELECT * INTO rel FROM public.relationships WHERE id = NEW.relationship_id;
  IF rel IS NULL THEN RETURN NEW; END IF;
  partner := CASE WHEN rel.user_a_id = actor THEN rel.user_b_id ELSE rel.user_a_id END;
  IF partner IS NULL THEN RETURN NEW; END IF;
  title := COALESCE(NEW.title, kind);
  INSERT INTO public.notifications (relationship_id, user_id, kind, title, entity_id, read)
  VALUES (NEW.relationship_id, partner, kind, title, NEW.id, false);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_memory ON public.memories;
CREATE TRIGGER trg_notify_memory AFTER INSERT ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner('memory');

DROP TRIGGER IF EXISTS trg_notify_event ON public.events;
CREATE TRIGGER trg_notify_event AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner('event');

DROP TRIGGER IF EXISTS trg_notify_note ON public.notes;
CREATE TRIGGER trg_notify_note AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner('note');

DROP TRIGGER IF EXISTS trg_notify_trip ON public.trips;
CREATE TRIGGER trg_notify_trip AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner('trip');

DROP TRIGGER IF EXISTS trg_notify_song ON public.songs;
CREATE TRIGGER trg_notify_song AFTER INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner('song');

-- 5) Storage policies (buckets are created via the storage tool)
--    Path convention: {relationship_id}/... — first path segment must match a relationship the user belongs to.
DROP POLICY IF EXISTS "Members read own bucket files" ON storage.objects;
CREATE POLICY "Members read own bucket files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('memories','wall')
    AND public.is_relationship_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Members write own bucket files" ON storage.objects;
CREATE POLICY "Members write own bucket files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('memories','wall')
    AND public.is_relationship_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Members update own bucket files" ON storage.objects;
CREATE POLICY "Members update own bucket files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('memories','wall')
    AND public.is_relationship_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Members delete own bucket files" ON storage.objects;
CREATE POLICY "Members delete own bucket files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('memories','wall')
    AND public.is_relationship_member((storage.foldername(name))[1]::uuid)
  );
