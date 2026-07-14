-- Create stickers table
CREATE TABLE IF NOT EXISTS public.stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  image_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

-- RLS Policy for stickers access
CREATE POLICY "stickers rel access" ON public.stickers
  FOR ALL TO authenticated
  USING (relationship_id IN (
    SELECT id FROM public.relationships 
    WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
  ));

-- Create stickers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('stickers', 'stickers', true) ON CONFLICT DO NOTHING;

-- Storage policies for stickers bucket
CREATE POLICY "Stickers Storage Public Read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'stickers');

CREATE POLICY "Stickers Storage Auth Insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'stickers');

CREATE POLICY "Stickers Storage Auth Delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'stickers');
