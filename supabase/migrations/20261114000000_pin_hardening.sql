-- PIN hardening (safe to run more than once).
--  1. PIN hashes can no longer be read or written by the app directly.
--  2. Stored PINs are salted with bcrypt on the server.
--  3. Unlock attempts are rate-limited (8 per 15 min, 30 per day per space).
--  4. A forgotten PIN is reset by your partner from their signed-in phone,
--     never by knowing the anniversary date.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Who can see what ─────────────────────────────────────────────────────────
-- The old read rule matched every row ("OR invite_code IS NOT NULL").
DROP POLICY IF EXISTS "rel members read" ON public.relationships;
CREATE POLICY "rel members read" ON public.relationships FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Anyone signed in could take over the partner slot while it was empty.
DROP POLICY IF EXISTS "rel claim as user_b" ON public.relationships;

-- Columns the app may read: everything except the PIN hashes.
REVOKE SELECT ON public.relationships FROM anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'relationships'
     AND column_name NOT IN ('pin_hash', 'pin_hash_a', 'pin_hash_b');
  EXECUTE format('GRANT SELECT (%s) ON public.relationships TO authenticated', cols);
END $$;

-- Columns the app may change: names, anniversary, sticker pad look.
REVOKE UPDATE ON public.relationships FROM anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'relationships'
     AND column_name IN ('name', 'name_a', 'name_b', 'anniversary', 'sticker_pad_bg', 'updated_at');
  EXECUTE format('GRANT UPDATE (%s) ON public.relationships TO authenticated', cols);
END $$;

-- ── Salt the stored PINs ─────────────────────────────────────────────────────
UPDATE public.relationships
   SET pin_hash_a = extensions.crypt(pin_hash_a, extensions.gen_salt('bf', 8))
 WHERE pin_hash_a IS NOT NULL AND pin_hash_a NOT LIKE '$2%';
UPDATE public.relationships
   SET pin_hash_b = extensions.crypt(pin_hash_b, extensions.gen_salt('bf', 8))
 WHERE pin_hash_b IS NOT NULL AND pin_hash_b NOT LIKE '$2%';
-- Legacy shared PIN column, unsalted and unused by the app.
UPDATE public.relationships SET pin_hash = NULL WHERE pin_hash IS NOT NULL;

-- New spaces: salt whatever the app inserts.
CREATE OR REPLACE FUNCTION public.salt_new_pins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pin_hash_a IS NOT NULL AND NEW.pin_hash_a NOT LIKE '$2%' THEN
    NEW.pin_hash_a := extensions.crypt(NEW.pin_hash_a, extensions.gen_salt('bf', 8));
  END IF;
  IF NEW.pin_hash_b IS NOT NULL AND NEW.pin_hash_b NOT LIKE '$2%' THEN
    NEW.pin_hash_b := extensions.crypt(NEW.pin_hash_b, extensions.gen_salt('bf', 8));
  END IF;
  NEW.pin_hash := NULL;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS salt_new_pins ON public.relationships;
CREATE TRIGGER salt_new_pins BEFORE INSERT ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.salt_new_pins();

-- ── Unlock attempts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id bigserial PRIMARY KEY,
  relationship_id uuid NOT NULL,
  user_id uuid,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pin_attempts_rel_at ON public.pin_attempts (relationship_id, at DESC);
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pin_attempts FROM anon, authenticated;

-- Returns 'a' or 'b' on success, 'invalid' for a wrong PIN, 'locked' when rate-limited.
-- (Returns instead of raising, so the failed attempt is still recorded.)
CREATE OR REPLACE FUNCTION public.claim_slot(_rel_id uuid, _pin_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; recent int; daily int;
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
    UPDATE public.relationships SET user_a_id = auth.uid() WHERE id = _rel_id;
    RETURN 'a';
  ELSIF r.pin_hash_b IS NOT NULL AND r.pin_hash_b = extensions.crypt(_pin_hash, r.pin_hash_b) THEN
    UPDATE public.relationships SET user_b_id = auth.uid() WHERE id = _rel_id;
    RETURN 'b';
  END IF;

  INSERT INTO public.pin_attempts (relationship_id, user_id) VALUES (_rel_id, auth.uid());
  DELETE FROM public.pin_attempts WHERE at < now() - interval '2 days';
  RETURN 'invalid';
END; $$;
REVOKE ALL ON FUNCTION public.claim_slot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_slot(uuid, text) TO authenticated;

-- Partner joins with the invite code from the link.
DROP FUNCTION IF EXISTS public.set_partner_pin(uuid, text, text);
CREATE OR REPLACE FUNCTION public.set_partner_pin(_rel_id uuid, _pin_hash text, _name text, _invite text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL OR r.invite_code IS NULL OR upper(r.invite_code) <> upper(coalesce(_invite, '')) THEN
    RAISE EXCEPTION 'invalid invite';
  END IF;
  IF r.pin_hash_b IS NOT NULL THEN RAISE EXCEPTION 'partner slot already filled'; END IF;
  IF r.pin_hash_a IS NOT NULL AND r.pin_hash_a = extensions.crypt(_pin_hash, r.pin_hash_a) THEN
    RAISE EXCEPTION 'pick a different pin than your partner';
  END IF;
  UPDATE public.relationships
     SET pin_hash_b = extensions.crypt(_pin_hash, extensions.gen_salt('bf', 8)),
         name_b = COALESCE(NULLIF(_name, ''), name_b),
         user_b_id = auth.uid()
   WHERE id = _rel_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_partner_pin(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_partner_pin(uuid, text, text, text) TO authenticated;

-- Change your own PIN. Your slot comes from who you're signed in as, not from the app.
CREATE OR REPLACE FUNCTION public.set_my_pin(_rel_id uuid, _new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; h text;
BEGIN
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  h := extensions.crypt(_new_hash, extensions.gen_salt('bf', 8));
  IF r.user_a_id = auth.uid() THEN
    IF r.pin_hash_b IS NOT NULL AND r.pin_hash_b = extensions.crypt(_new_hash, r.pin_hash_b) THEN
      RAISE EXCEPTION 'pick a different pin than your partner';
    END IF;
    UPDATE public.relationships SET pin_hash_a = h WHERE id = _rel_id;
  ELSIF r.user_b_id = auth.uid() THEN
    IF r.pin_hash_a IS NOT NULL AND r.pin_hash_a = extensions.crypt(_new_hash, r.pin_hash_a) THEN
      RAISE EXCEPTION 'pick a different pin than your partner';
    END IF;
    UPDATE public.relationships SET pin_hash_b = h WHERE id = _rel_id;
  ELSE
    RAISE EXCEPTION 'not allowed';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_my_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_pin(uuid, text) TO authenticated;

-- Forgot your PIN: your partner sets a new one for you from their phone.
CREATE OR REPLACE FUNCTION public.reset_partner_pin(_rel_id uuid, _new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; h text;
BEGIN
  SELECT * INTO r FROM public.relationships WHERE id = _rel_id;
  IF r IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  h := extensions.crypt(_new_hash, extensions.gen_salt('bf', 8));
  IF r.user_a_id = auth.uid() THEN
    UPDATE public.relationships SET pin_hash_b = h WHERE id = _rel_id;
  ELSIF r.user_b_id = auth.uid() THEN
    UPDATE public.relationships SET pin_hash_a = h WHERE id = _rel_id;
  ELSE
    RAISE EXCEPTION 'not allowed';
  END IF;
  -- A fresh PIN gets a fresh set of tries.
  DELETE FROM public.pin_attempts WHERE relationship_id = _rel_id;
END; $$;
REVOKE ALL ON FUNCTION public.reset_partner_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_partner_pin(uuid, text) TO authenticated;

-- The anniversary-date reset is gone.
DROP FUNCTION IF EXISTS public.reset_slot_pin(uuid, text, text, date);
