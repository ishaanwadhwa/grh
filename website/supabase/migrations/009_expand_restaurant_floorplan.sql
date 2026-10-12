-- Expand the drawing workspace without moving existing tables on the plan.
CREATE OR REPLACE FUNCTION public.expand_restaurant_floorplan(
  p_floorplan_id UUID,
  p_canvas_width INTEGER,
  p_canvas_height INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_old_width INTEGER;
  v_old_height INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  SELECT restaurant_id, canvas_width, canvas_height
    INTO v_restaurant_id, v_old_width, v_old_height
    FROM public.restaurant_floorplans
    WHERE id = p_floorplan_id
    FOR UPDATE;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'FLOORPLAN_NOT_FOUND', ERRCODE = 'P0002';
  END IF;
  IF p_canvas_width < v_old_width OR p_canvas_height < v_old_height
     OR p_canvas_width > 6000 OR p_canvas_height > 6000 THEN
    RAISE EXCEPTION USING MESSAGE = 'CANVAS_MUST_ONLY_EXPAND_UP_TO_6000', ERRCODE = '22023';
  END IF;

  UPDATE public.restaurant_tables
    SET x_percent = ROUND(x_percent * v_old_width::NUMERIC / p_canvas_width, 2),
        y_percent = ROUND(y_percent * v_old_height::NUMERIC / p_canvas_height, 2),
        width_percent = GREATEST(2, ROUND(width_percent * v_old_width::NUMERIC / p_canvas_width, 2)),
        height_percent = GREATEST(2, ROUND(height_percent * v_old_height::NUMERIC / p_canvas_height, 2)),
        updated_at = NOW()
    WHERE floorplan_id = p_floorplan_id;

  UPDATE public.restaurant_floorplans
    SET canvas_width = p_canvas_width,
        canvas_height = p_canvas_height,
        updated_at = NOW()
    WHERE id = p_floorplan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.expand_restaurant_floorplan(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expand_restaurant_floorplan(UUID, INTEGER, INTEGER) TO authenticated;
