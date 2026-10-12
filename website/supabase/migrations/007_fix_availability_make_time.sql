-- Fix PostgreSQL make_time argument types in the availability RPC.
-- This is a forward fix because migrations 004/005 may already be applied remotely.
CREATE OR REPLACE FUNCTION public.get_available_restaurant_slots(
  p_restaurant_slug TEXT,
  p_service_date DATE,
  p_party_size INTEGER
)
RETURNS TABLE (service_id UUID, service_name TEXT, slot_time TIME)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_timezone TEXT;
  v_service RECORD;
  v_open TIME;
  v_close TIME;
  v_override RECORD;
  v_start_minute INTEGER;
  v_close_minute INTEGER;
  v_minutes INTEGER;
  v_slot TIME;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_duration INTEGER;
BEGIN
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RETURN;
  END IF;

  SELECT r.id, COALESCE(r.timezone, 'Asia/Kolkata')
    INTO v_restaurant_id, v_timezone
    FROM public.restaurants r
    WHERE r.slug = p_restaurant_slug AND r.is_active = TRUE;

  IF v_restaurant_id IS NULL OR p_service_date < (NOW() AT TIME ZONE v_timezone)::DATE THEN
    RETURN;
  END IF;

  FOR v_service IN
    SELECT s.id, s.name, s.slot_interval_minutes, s.seating_duration_minutes,
           s.buffer_minutes, s.min_party_size, s.max_party_size
    FROM public.restaurant_services s
    WHERE s.restaurant_id = v_restaurant_id
      AND s.is_active = TRUE
      AND p_party_size BETWEEN s.min_party_size AND s.max_party_size
    ORDER BY s.name
  LOOP
    SELECT o.is_closed, o.opens_at, o.closes_at
      INTO v_override
      FROM public.restaurant_service_date_overrides o
      WHERE o.service_id = v_service.id AND o.service_date = p_service_date;

    IF FOUND AND v_override.is_closed THEN
      CONTINUE;
    END IF;
    IF FOUND AND v_override.opens_at IS NOT NULL THEN
      v_open := v_override.opens_at;
      v_close := v_override.closes_at;
    ELSE
      SELECT h.opens_at, h.closes_at
        INTO v_open, v_close
        FROM public.restaurant_service_hours h
        WHERE h.service_id = v_service.id
          AND h.day_of_week = EXTRACT(DOW FROM p_service_date)::SMALLINT;
    END IF;

    IF v_open IS NULL OR v_close IS NULL OR v_open = v_close THEN
      CONTINUE;
    END IF;

    v_start_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
    v_close_minute := EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER;
    IF v_close_minute <= v_start_minute THEN
      v_close_minute := v_close_minute + 1440;
    END IF;

    v_duration := v_service.seating_duration_minutes + v_service.buffer_minutes;
    v_minutes := v_start_minute;

    -- Slot starts remain on the selected service date; occupancy may end after midnight.
    WHILE v_minutes < 1440 AND v_minutes + v_duration <= v_close_minute LOOP
      v_slot := MAKE_TIME((v_minutes / 60)::INTEGER, (v_minutes % 60)::INTEGER, 0::DOUBLE PRECISION);
      v_start := ((p_service_date + v_slot) AT TIME ZONE v_timezone);
      v_end := v_start + MAKE_INTERVAL(mins => v_duration);

      IF EXISTS (
        SELECT 1
        FROM public.restaurant_floorplans f
        JOIN public.restaurant_tables t ON t.floorplan_id = f.id
        WHERE f.restaurant_id = v_restaurant_id
          AND f.is_active = TRUE
          AND t.restaurant_id = v_restaurant_id
          AND t.is_active = TRUE
          AND t.min_capacity <= p_party_size
          AND t.max_capacity >= p_party_size
          AND NOT EXISTS (
            SELECT 1
            FROM public.reservation_table_assignments a
            WHERE a.table_id = t.id
              AND a.released_at IS NULL
              AND a.starts_at < v_end
              AND a.ends_at > v_start
          )
      ) THEN
        service_id := v_service.id;
        service_name := v_service.name;
        slot_time := v_slot;
        RETURN NEXT;
      END IF;

      v_minutes := v_minutes + v_service.slot_interval_minutes;
    END LOOP;
  END LOOP;
END;
$$;
