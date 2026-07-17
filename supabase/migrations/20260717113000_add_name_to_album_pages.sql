-- Add name column to album_pages table
ALTER TABLE public.album_pages ADD COLUMN IF NOT EXISTS name TEXT;
