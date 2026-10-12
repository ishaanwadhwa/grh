-- Native, image-optional SVG layouts. Existing uploaded plans remain usable as optional references.
ALTER TABLE public.restaurant_floorplans
  ALTER COLUMN image_path DROP NOT NULL,
  ALTER COLUMN canvas_width SET DEFAULT 1000,
  ALTER COLUMN canvas_height SET DEFAULT 1400,
  ADD COLUMN IF NOT EXISTS layout_data JSONB NOT NULL DEFAULT '[]'::JSONB;
