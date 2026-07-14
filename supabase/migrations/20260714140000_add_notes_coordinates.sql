ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS pos_x NUMERIC,
  ADD COLUMN IF NOT EXISTS pos_y NUMERIC;

-- Set a random default position for existing notes so they aren't all stacked on top of each other
UPDATE public.notes
   SET pos_x = COALESCE(pos_x, random() * 0.7 + 0.05),
       pos_y = COALESCE(pos_y, random() * 0.6 + 0.05)
 WHERE pos_x IS NULL OR pos_y IS NULL;
