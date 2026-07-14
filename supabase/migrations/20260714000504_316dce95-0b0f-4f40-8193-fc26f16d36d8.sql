
-- 1) Per-user PIN slots + display names on relationships
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS pin_hash_a text,
  ADD COLUMN IF NOT EXISTS pin_hash_b text,
  ADD COLUMN IF NOT EXISTS name_a text,
  ADD COLUMN IF NOT EXISTS name_b text;

UPDATE public.relationships
   SET pin_hash_a = COALESCE(pin_hash_a, pin_hash),
       pin_hash_b = COALESCE(pin_hash_b, pin_hash),
       name_a     = COALESCE(name_a, name);

-- 2) Notification preferences per user
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  memory  boolean NOT NULL DEFAULT true,
  event   boolean NOT NULL DEFAULT true,
  trip    boolean NOT NULL DEFAULT true,
  note    boolean NOT NULL DEFAULT true,
  song    boolean NOT NULL DEFAULT true,
  hug     boolean NOT NULL DEFAULT true,
  capsule boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own prefs" ON public.notification_preferences;
CREATE POLICY "own prefs" ON public.notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Space state / claim / set / reset RPCs
CREATE OR REPLACE FUNCTION public.get_space_state()
RETURNS TABLE(id uuid, name text, name_a text, name_b text, has_a boolean, has_b boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, name_a, name_b, pin_hash_a IS NOT NULL, pin_hash_b IS NOT NULL
    FROM public.relationships
   ORDER BY created_at ASC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_space_state() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_slot(_rel_id uuid, _pin_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF r.pin_hash_a IS NOT NULL AND r.pin_hash_a = _pin_hash THEN
    UPDATE public.relationships SET user_a_id = auth.uid() WHERE id = _rel_id;
    RETURN 'a';
  ELSIF r.pin_hash_b IS NOT NULL AND r.pin_hash_b = _pin_hash THEN
    UPDATE public.relationships SET user_b_id = auth.uid() WHERE id = _rel_id;
    RETURN 'b';
  ELSE
    RAISE EXCEPTION 'invalid pin';
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_slot(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_partner_pin(_rel_id uuid, _pin_hash text, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF r.pin_hash_b IS NOT NULL THEN RAISE EXCEPTION 'partner slot already filled'; END IF;
  IF r.pin_hash_a = _pin_hash THEN RAISE EXCEPTION 'pick a different pin than your partner'; END IF;
  UPDATE public.relationships
     SET pin_hash_b = _pin_hash,
         name_b = COALESCE(NULLIF(_name,''), name_b),
         user_b_id = auth.uid()
   WHERE id = _rel_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_partner_pin(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_slot_pin(_rel_id uuid, _slot text, _new_hash text, _anniversary date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL OR r.anniversary <> _anniversary THEN RAISE EXCEPTION 'no'; END IF;
  IF _slot = 'a' THEN UPDATE public.relationships SET pin_hash_a = _new_hash WHERE id = _rel_id;
  ELSIF _slot = 'b' THEN UPDATE public.relationships SET pin_hash_b = _new_hash WHERE id = _rel_id;
  ELSE RAISE EXCEPTION 'bad slot'; END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.reset_slot_pin(uuid, text, text, date) TO authenticated;

-- 4) notify_partner respects prefs
CREATE OR REPLACE FUNCTION public.notify_partner()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  partner UUID; rel RECORD; actor UUID;
  kind_txt TEXT := TG_ARGV[0];
  pref RECORD; allow boolean;
BEGIN
  actor := COALESCE(
    CASE WHEN TG_TABLE_NAME IN ('memories','events','trips') THEN NEW.created_by END,
    CASE WHEN TG_TABLE_NAME = 'notes' THEN NEW.author_id END,
    CASE WHEN TG_TABLE_NAME = 'songs' THEN NEW.added_by END
  );
  SELECT * INTO rel FROM public.relationships WHERE id = NEW.relationship_id;
  IF rel IS NULL THEN RETURN NEW; END IF;
  partner := CASE WHEN rel.user_a_id = actor THEN rel.user_b_id ELSE rel.user_a_id END;
  IF partner IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO pref FROM public.notification_preferences WHERE user_id = partner;
  allow := CASE kind_txt
    WHEN 'memory'  THEN COALESCE(pref.memory,  true)
    WHEN 'event'   THEN COALESCE(pref.event,   true)
    WHEN 'trip'    THEN COALESCE(pref.trip,    true)
    WHEN 'note'    THEN COALESCE(pref.note,    true)
    WHEN 'song'    THEN COALESCE(pref.song,    true)
    WHEN 'hug'     THEN COALESCE(pref.hug,     true)
    WHEN 'capsule' THEN COALESCE(pref.capsule, true)
    ELSE true END;
  IF NOT allow THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (relationship_id, user_id, kind, ref_id, read)
  VALUES (NEW.relationship_id, partner, kind_txt::public.notification_kind, NEW.id, false);
  RETURN NEW;
END; $$;
