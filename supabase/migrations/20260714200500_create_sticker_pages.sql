-- Create sticker_pages table
CREATE TABLE IF NOT EXISTS public.sticker_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bg_theme TEXT NOT NULL DEFAULT 'white',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Enable RLS for sticker_pages
ALTER TABLE public.sticker_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sticker_pages rel access" ON public.sticker_pages
  FOR ALL TO authenticated
  USING (relationship_id IN (
    SELECT id FROM public.relationships 
    WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
  ));

-- Add page_id column to stickers table
ALTER TABLE public.stickers 
  ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.sticker_pages(id) ON DELETE CASCADE;
