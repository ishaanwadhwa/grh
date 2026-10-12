-- Save a booking service and replace its weekly schedule as one idempotent transaction.
CREATE OR REPLACE FUNCTION public.save_restaurant_service(
  p_service_id UUID,
  p_restaurant_id UUID,
  p_name TEXT,
  p_slot_interval_minutes SMALLINT,
  p_seating_duration_minutes SMALLINT,
  p_buffer_minutes SMALLINT,
  p_min_party_size SMALLINT,
  p_max_party_size SMALLINT,
  p_days SMALLINT[],
  p_opens_at TIME,
  p_closes_at TIME
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_name), '') IS NULL
     OR p_restaurant_id IS NULL
     OR p_slot_interval_minutes NOT BETWEEN 5 AND 240
     OR p_seating_duration_minutes NOT BETWEEN 15 AND 480
     OR p_buffer_minutes NOT BETWEEN 0 AND 180
     OR p_min_party_size NOT BETWEEN 1 AND 50
     OR p_max_party_size NOT BETWEEN p_min_party_size AND 50
     OR p_opens_at IS NULL OR p_closes_at IS NULL OR p_opens_at = p_closes_at
     OR COALESCE(CARDINALITY(p_days), 0) = 0
     OR EXISTS (SELECT 1 FROM UNNEST(p_days) AS selected_day(day_of_week) WHERE day_of_week NOT BETWEEN 0 AND 6)
     OR (SELECT COUNT(*) FROM UNNEST(p_days)) <> (SELECT COUNT(DISTINCT day_of_week) FROM UNNEST(p_days) AS selected_day(day_of_week)) THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_SERVICE_SETTINGS', ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = p_restaurant_id) THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  IF p_service_id IS NULL THEN
    -- Retrying an add with the same restaurant/name updates the same row,
    -- rather than creating duplicate services after a network timeout.
    INSERT INTO public.restaurant_services (
      restaurant_id, name, slot_interval_minutes, seating_duration_minutes,
      buffer_minutes, min_party_size, max_party_size, is_active, updated_at
    ) VALUES (
      p_restaurant_id, BTRIM(p_name), p_slot_interval_minutes, p_seating_duration_minutes,
      p_buffer_minutes, p_min_party_size, p_max_party_size, TRUE, NOW()
    )
    ON CONFLICT (restaurant_id, name) DO UPDATE SET
      slot_interval_minutes = EXCLUDED.slot_interval_minutes,
      seating_duration_minutes = EXCLUDED.seating_duration_minutes,
      buffer_minutes = EXCLUDED.buffer_minutes,
      min_party_size = EXCLUDED.min_party_size,
      max_party_size = EXCLUDED.max_party_size,
      is_active = TRUE,
      updated_at = NOW()
    RETURNING id INTO v_service_id;
  ELSE
    UPDATE public.restaurant_services
      SET name = BTRIM(p_name),
          slot_interval_minutes = p_slot_interval_minutes,
          seating_duration_minutes = p_seating_duration_minutes,
          buffer_minutes = p_buffer_minutes,
          min_party_size = p_min_party_size,
          max_party_size = p_max_party_size,
          is_active = TRUE,
          updated_at = NOW()
      WHERE id = p_service_id AND restaurant_id = p_restaurant_id
      RETURNING id INTO v_service_id;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'SERVICE_NOT_FOUND', ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.restaurant_service_hours WHERE service_id = v_service_id;

  INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
  SELECT v_service_id, selected_day.day_of_week, p_opens_at, p_closes_at
  FROM (SELECT DISTINCT UNNEST(p_days)::SMALLINT AS day_of_week) AS selected_day;

  RETURN v_service_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_restaurant_service(UUID, UUID, TEXT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT[], TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_restaurant_service(UUID, UUID, TEXT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT[], TIME, TIME) TO authenticated;
