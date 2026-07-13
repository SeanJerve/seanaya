
DROP POLICY IF EXISTS "trips read own" ON storage.objects;
DROP POLICY IF EXISTS "trips write own" ON storage.objects;
DROP POLICY IF EXISTS "trips update own" ON storage.objects;
DROP POLICY IF EXISTS "trips delete own" ON storage.objects;

CREATE POLICY "trips read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'trips' AND public.is_relationship_member((storage.foldername(name))[1]::uuid));

CREATE POLICY "trips write own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trips' AND public.is_relationship_member((storage.foldername(name))[1]::uuid));

CREATE POLICY "trips update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'trips' AND public.is_relationship_member((storage.foldername(name))[1]::uuid));

CREATE POLICY "trips delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'trips' AND public.is_relationship_member((storage.foldername(name))[1]::uuid));
