-- Each of you can be signed in on several devices at once (safe to run more than once).
-- Before: entering a PIN replaced that person's device, signing the old one out.
-- Now: every device that enters the right PIN is remembered for that person.

CREATE TABLE IF NOT EXISTS public.relationship_devices (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('a', 'b')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.relationship_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relationship_devices FROM anon, authenticated;

-- Remember the devices already in use.
INSERT INTO public.relationship_devices (user_id, relationship_id, slot)
  SELECT user_a_id, id, 'a' FROM public.relationships WHERE user_a_id IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.relationship_devices (user_id, relationship_id, slot)
  SELECT user_b_id, id, 'b' FROM public.relationships WHERE user_b_id IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;

-- Which of you (a / b) a signed-in device belongs to in a space, or NULL.
CREATE OR REPLACE FUNCTION public.slot_of(_rel uuid, _uid uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN r.user_a_id = _uid THEN 'a' WHEN r.user_b_id = _uid THEN 'b' END
       FROM public.relationships r WHERE r.id = _rel),
    (SELECT d.slot FROM public.relationship_devices d WHERE d.relationship_id = _rel AND d.user_id = _uid)
  );
$$;
GRANT EXECUTE ON FUNCTION public.slot_of(uuid, uuid) TO authenticated;

-- Membership now includes every remembered device. Most access rules already use these.
CREATE OR REPLACE FUNCTION public.is_relationship_member(_rel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.slot_of(_rel) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.current_relationship_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT id FROM public.relationships WHERE user_a_id = auth.uid() OR user_b_id = auth.uid() LIMIT 1),
    (SELECT relationship_id FROM public.relationship_devices WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

-- True when _uid is the same person as the signed-in device (any of their devices).
CREATE OR REPLACE FUNCTION public.is_same_person(_rel uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid = auth.uid()
      OR (public.slot_of(_rel) IS NOT NULL AND public.slot_of(_rel) = public.slot_of(_rel, _uid));
$$;
GRANT EXECUTE ON FUNCTION public.is_same_person(uuid, uuid) TO authenticated;

-- ── Rules that checked the two device columns directly ───────────────────────
DROP POLICY IF EXISTS "rel members read" ON public.relationships;
CREATE POLICY "rel members read" ON public.relationships FOR SELECT TO authenticated
  USING (public.is_relationship_member(id));
DROP POLICY IF EXISTS "rel update members" ON public.relationships;
CREATE POLICY "rel update members" ON public.relationships FOR UPDATE TO authenticated
  USING (public.is_relationship_member(id)) WITH CHECK (public.is_relationship_member(id));

DROP POLICY IF EXISTS "stickers rel access" ON public.stickers;
CREATE POLICY "stickers rel access" ON public.stickers FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));

DROP POLICY IF EXISTS "sticker_pages rel access" ON public.sticker_pages;
CREATE POLICY "sticker_pages rel access" ON public.sticker_pages FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));

DROP POLICY IF EXISTS "members read locations" ON public.member_locations;
CREATE POLICY "members read locations" ON public.member_locations FOR SELECT
  USING (public.is_relationship_member(relationship_id));
DROP POLICY IF EXISTS "member writes own slot" ON public.member_locations;
CREATE POLICY "member writes own slot" ON public.member_locations FOR INSERT
  WITH CHECK (public.slot_of(relationship_id) = slot);
DROP POLICY IF EXISTS "member updates own slot" ON public.member_locations;
CREATE POLICY "member updates own slot" ON public.member_locations FOR UPDATE
  USING (public.slot_of(relationship_id) = slot);

DROP POLICY IF EXISTS "members manage album pages" ON public.album_pages;
CREATE POLICY "members manage album pages" ON public.album_pages FOR ALL
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
DROP POLICY IF EXISTS "members manage album items" ON public.album_items;
CREATE POLICY "members manage album items" ON public.album_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.album_pages p
                  WHERE p.id = album_items.page_id AND public.is_relationship_member(p.relationship_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.album_pages p
                  WHERE p.id = album_items.page_id AND public.is_relationship_member(p.relationship_id)));

-- Notifications belong to a person, so every one of their devices can see them.
DROP POLICY IF EXISTS "notifs self read" ON public.notifications;
CREATE POLICY "notifs self read" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_same_person(relationship_id, user_id));
DROP POLICY IF EXISTS "notifs self update" ON public.notifications;
CREATE POLICY "notifs self update" ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_same_person(relationship_id, user_id))
  WITH CHECK (public.is_same_person(relationship_id, user_id));

-- Notify the partner, whichever device did the thing.
CREATE OR REPLACE FUNCTION public.notify_partner_shared(_rel_id uuid, _actor_id uuid, _kind text, _entity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  partner uuid; rel RECORD; pref RECORD; allow boolean; actor_slot text;
BEGIN
  SELECT * INTO rel FROM public.relationships WHERE id = _rel_id;
  IF rel IS NULL THEN RETURN; END IF;
  actor_slot := public.slot_of(_rel_id, _actor_id);
  IF actor_slot IS NULL THEN RETURN; END IF;
  partner := CASE WHEN actor_slot = 'a' THEN rel.user_b_id ELSE rel.user_a_id END;
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

-- ── PIN functions: add this device instead of replacing the old one ──────────
CREATE OR REPLACE FUNCTION public.claim_slot(_rel_id uuid, _pin_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; recent int; daily int; s text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'invalid'; END IF;
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL THEN RETURN 'invalid'; END IF;

  SELECT count(*) FILTER (WHERE at > now() - interval '15 minutes'),
         count(*) FILTER (WHERE at > now() - interval '1 day')
    INTO recent, daily
    FROM public.pin_attempts WHERE relationship_id = _rel_id;
  IF recent >= 8 OR daily >= 30 THEN RETURN 'locked'; END IF;

  IF r.pin_hash_a IS NOT NULL AND r.pin_hash_a = extensions.crypt(_pin_hash, r.pin_hash_a) THEN
    s := 'a';
  ELSIF r.pin_hash_b IS NOT NULL AND r.pin_hash_b = extensions.crypt(_pin_hash, r.pin_hash_b) THEN
    s := 'b';
  END IF;

  IF s IS NULL THEN
    INSERT INTO public.pin_attempts (relationship_id, user_id) VALUES (_rel_id, auth.uid());
    DELETE FROM public.pin_attempts WHERE at < now() - interval '2 days';
    RETURN 'invalid';
  END IF;

  INSERT INTO public.relationship_devices (user_id, relationship_id, slot)
    VALUES (auth.uid(), _rel_id, s)
    ON CONFLICT (user_id) DO UPDATE SET relationship_id = EXCLUDED.relationship_id, slot = EXCLUDED.slot;
  -- The first device stays the main one; only fill the column if it's empty.
  IF s = 'a' AND r.user_a_id IS NULL THEN UPDATE public.relationships SET user_a_id = auth.uid() WHERE id = _rel_id; END IF;
  IF s = 'b' AND r.user_b_id IS NULL THEN UPDATE public.relationships SET user_b_id = auth.uid() WHERE id = _rel_id; END IF;
  RETURN s;
END; $$;
REVOKE ALL ON FUNCTION public.claim_slot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_slot(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_pin(_rel_id uuid, _new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; s text;
BEGIN
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  s := public.slot_of(_rel_id);
  IF r IS NULL OR s IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF s = 'a' THEN
    IF r.pin_hash_b IS NOT NULL AND r.pin_hash_b = extensions.crypt(_new_hash, r.pin_hash_b) THEN
      RAISE EXCEPTION 'pick a different pin than your partner';
    END IF;
    UPDATE public.relationships SET pin_hash_a = extensions.crypt(_new_hash, extensions.gen_salt('bf', 8)) WHERE id = _rel_id;
  ELSE
    IF r.pin_hash_a IS NOT NULL AND r.pin_hash_a = extensions.crypt(_new_hash, r.pin_hash_a) THEN
      RAISE EXCEPTION 'pick a different pin than your partner';
    END IF;
    UPDATE public.relationships SET pin_hash_b = extensions.crypt(_new_hash, extensions.gen_salt('bf', 8)) WHERE id = _rel_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_partner_pin(_rel_id uuid, _new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; h text;
BEGIN
  s := public.slot_of(_rel_id);
  IF s IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  h := extensions.crypt(_new_hash, extensions.gen_salt('bf', 8));
  IF s = 'a' THEN UPDATE public.relationships SET pin_hash_b = h WHERE id = _rel_id;
  ELSE UPDATE public.relationships SET pin_hash_a = h WHERE id = _rel_id; END IF;
  DELETE FROM public.pin_attempts WHERE relationship_id = _rel_id;
END; $$;
