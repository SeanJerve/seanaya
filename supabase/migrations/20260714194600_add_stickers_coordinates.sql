-- Add coordinates, rotation to stickers table
ALTER TABLE public.stickers 
  ADD COLUMN IF NOT EXISTS pos_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pos_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rotation DOUBLE PRECISION;

-- Add sticker_pad_bg to relationships table
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS sticker_pad_bg TEXT DEFAULT 'white';
