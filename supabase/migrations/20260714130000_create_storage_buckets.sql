-- Create the storage buckets if they do not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('memories', 'memories', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('wall', 'wall', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('trips', 'trips', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the buckets
DROP POLICY IF EXISTS "Trips bucket select" ON storage.objects;
CREATE POLICY "Trips bucket select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trips');

DROP POLICY IF EXISTS "Trips bucket insert" ON storage.objects;
CREATE POLICY "Trips bucket insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trips');

DROP POLICY IF EXISTS "Trips bucket update" ON storage.objects;
CREATE POLICY "Trips bucket update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trips');

DROP POLICY IF EXISTS "Trips bucket delete" ON storage.objects;
CREATE POLICY "Trips bucket delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trips');
