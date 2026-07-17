-- Create album_pages table
CREATE TABLE IF NOT EXISTS public.album_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  page_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create album_items table
CREATE TABLE IF NOT EXISTS public.album_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.album_pages(id) ON DELETE CASCADE,
  item_type text NOT NULL, -- 'sticker', 'polaroid', 'picture', 'note', 'text'
  content text,
  image_url text,
  color text,
  pos_x double precision NOT NULL,
  pos_y double precision NOT NULL,
  scale double precision NOT NULL DEFAULT 1.0,
  rotation double precision NOT NULL DEFAULT 0.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.album_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_items ENABLE ROW LEVEL SECURITY;

-- Setup policies
CREATE POLICY "Allow relationship members access to pages" ON public.album_pages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow relationship members access to items" ON public.album_items
  FOR ALL USING (true) WITH CHECK (true);

-- Enable real-time replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.album_pages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.album_items;
