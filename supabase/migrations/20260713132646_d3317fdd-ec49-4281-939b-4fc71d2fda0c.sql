
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_path TEXT;

DROP POLICY IF EXISTS "rel claim as user_b" ON public.relationships;
CREATE POLICY "rel claim as user_b" ON public.relationships
  FOR UPDATE TO authenticated
  USING (user_b_id IS NULL AND user_a_id <> auth.uid())
  WITH CHECK (user_b_id = auth.uid());
