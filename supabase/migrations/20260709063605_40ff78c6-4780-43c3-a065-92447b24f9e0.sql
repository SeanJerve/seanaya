
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.event_category AS ENUM ('relationship','travel','family','pets','personal','health','study','custom');
CREATE TYPE public.memory_category AS ENUM ('firsts','campus','travel','random','family','future');
CREATE TYPE public.song_category AS ENUM ('favorite','study','travel','comfort','future');
CREATE TYPE public.lily_stage AS ENUM ('seed','sprout','bud','bloom','full');
CREATE TYPE public.notification_kind AS ENUM ('memory','note','hug','event','capsule','trip','song');

-- =========================================================
-- SHARED updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- RELATIONSHIPS (exactly two users)
-- =========================================================
CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE,
  name TEXT DEFAULT 'Seanaya',
  anniversary DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT diff_users CHECK (user_a_id <> user_b_id OR user_b_id IS NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.relationships TO authenticated;
GRANT ALL ON public.relationships TO service_role;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_relationship_member(_rel UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.id = _rel AND (r.user_a_id = auth.uid() OR r.user_b_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.current_relationship_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.relationships
   WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
   LIMIT 1;
$$;

CREATE POLICY "rel members read" ON public.relationships FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid() OR invite_code IS NOT NULL);
CREATE POLICY "rel create self" ON public.relationships FOR INSERT TO authenticated
  WITH CHECK (user_a_id = auth.uid());
CREATE POLICY "rel update members" ON public.relationships FOR UPDATE TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid())
  WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());
CREATE TRIGGER trg_rel_updated BEFORE UPDATE ON public.relationships FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Generic relationship-scoped tables
-- =========================================================

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category public.event_category NOT NULL DEFAULT 'relationship',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  recurrence TEXT, -- RRULE-ish string, e.g. 'MONTHLY:19'
  countdown BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events rel access" ON public.events FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE INDEX idx_events_rel_start ON public.events (relationship_id, starts_at);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- MEMORIES
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  memory_date DATE,
  location TEXT,
  category public.memory_category NOT NULL DEFAULT 'random',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories rel access" ON public.memories FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE INDEX idx_memories_rel_date ON public.memories (relationship_id, memory_date DESC);
CREATE TRIGGER trg_memories_updated BEFORE UPDATE ON public.memories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- MEMORY MEDIA
CREATE TABLE public.memory_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo','video')),
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_media TO authenticated;
GRANT ALL ON public.memory_media TO service_role;
ALTER TABLE public.memory_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_media rel access" ON public.memory_media FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_memedia_updated BEFORE UPDATE ON public.memory_media FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- TRIPS
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  trip_date DATE,
  status TEXT NOT NULL DEFAULT 'visited' CHECK (status IN ('visited','dream','planned')),
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips rel access" ON public.trips FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PETS
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'cat',
  variant TEXT, -- e.g. white / gray-black / ginger
  birthday DATE,
  description TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;
GRANT ALL ON public.pets TO service_role;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pets rel access" ON public.pets FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PLAYLISTS
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.song_category NOT NULL DEFAULT 'favorite',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists rel access" ON public.playlists FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_playlists_updated BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- SONGS
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  category public.song_category NOT NULL DEFAULT 'favorite',
  spotify_uri TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "songs rel access" ON public.songs FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_songs_updated BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- HUGS
CREATE TABLE public.hugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hugs TO authenticated;
GRANT ALL ON public.hugs TO service_role;
ALTER TABLE public.hugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hugs rel access" ON public.hugs FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE INDEX idx_hugs_rel_created ON public.hugs (relationship_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.hugs;
ALTER TABLE public.hugs REPLICA IDENTITY FULL;
CREATE TRIGGER trg_hugs_updated BEFORE UPDATE ON public.hugs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- NOTES (Forever Wall)
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','compliment','promise','gratitude')),
  pinned BOOLEAN NOT NULL DEFAULT false,
  favorite BOOLEAN NOT NULL DEFAULT false,
  permanent BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes rel access" ON public.notes FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- LILIES
CREATE TABLE public.lilies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES public.memories(id) ON DELETE SET NULL,
  stage public.lily_stage NOT NULL DEFAULT 'seed',
  position_x NUMERIC NOT NULL DEFAULT 0.5,
  position_y NUMERIC NOT NULL DEFAULT 0.5,
  planted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lilies TO authenticated;
GRANT ALL ON public.lilies TO service_role;
ALTER TABLE public.lilies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lilies rel access" ON public.lilies FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_lilies_updated BEFORE UPDATE ON public.lilies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- TIME CAPSULES
CREATE TABLE public.time_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  unlock_at TIMESTAMPTZ NOT NULL,
  opened BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_capsules TO authenticated;
GRANT ALL ON public.time_capsules TO service_role;
ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capsules rel access" ON public.time_capsules FOR ALL TO authenticated
  USING (public.is_relationship_member(relationship_id))
  WITH CHECK (public.is_relationship_member(relationship_id));
CREATE TRIGGER trg_caps_updated BEFORE UPDATE ON public.time_capsules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- NOTIFICATIONS (red-dot)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  ref_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifs self read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifs self update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifs rel insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_relationship_member(relationship_id));
CREATE INDEX idx_notifs_user_read ON public.notifications (user_id, read, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
CREATE TRIGGER trg_notifs_updated BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
