-- Walk-ins need no guest email; seating is recorded against real tables immediately.
ALTER TABLE public.reservations
  ALTER COLUMN guest_email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_walkin_reservation(
  p_restaurant_id UUID,
  p_service_id UUID,
  p_service_date DATE,
  p_start_time TIME,
  p_party_size INTEGER,
  p_table_ids UUID[],
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT '',
  p_guest_phone_code TEXT DEFAULT '+91',
  p_special_requests TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant RECORD;
  v_service RECORD;
  v_override RECORD;
  v_open TIME;
  v_close TIME;
  v_open_minute INTEGER;
  v_close_minute INTEGER;
  v_start_minute INTEGER;
  v_duration INTEGER;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_reservation_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  IF p_service_date IS NULL OR p_start_time IS NULL
     OR p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50
     OR COALESCE(CARDINALITY(p_table_ids), 0) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_WALKIN', ERRCODE = '22023';
  END IF;

  SELECT r.id, COALESCE(r.timezone, 'Asia/Kolkata') AS timezone
    INTO v_restaurant
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND r.is_active = TRUE;
  IF v_restaurant.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;
  IF p_service_date < (NOW() AT TIME ZONE v_restaurant.timezone)::DATE THEN
    RAISE EXCEPTION USING MESSAGE = 'WALKIN_TIME_INVALID', ERRCODE = '22023';
  END IF;

  SELECT s.* INTO v_service
    FROM public.restaurant_services s
    WHERE s.id = p_service_id AND s.restaurant_id = p_restaurant_id AND s.is_active = TRUE;
  IF v_service.id IS NULL OR p_party_size NOT BETWEEN v_service.min_party_size AND v_service.max_party_size THEN
    RAISE EXCEPTION USING MESSAGE = 'SERVICE_NOT_AVAILABLE', ERRCODE = '22023';
  END IF;

  SELECT o.is_closed, o.opens_at, o.closes_at INTO v_override
    FROM public.restaurant_service_date_overrides o
    WHERE o.service_id = p_service_id AND o.service_date = p_service_date;
  IF FOUND AND v_override.is_closed THEN
    RAISE EXCEPTION USING MESSAGE = 'SERVICE_CLOSED', ERRCODE = '22023';
  END IF;
  IF FOUND AND v_override.opens_at IS NOT NULL THEN
    v_open := v_override.opens_at;
    v_close := v_override.closes_at;
  ELSE
    SELECT h.opens_at, h.closes_at INTO v_open, v_close
      FROM public.restaurant_service_hours h
      WHERE h.service_id = p_service_id
        AND h.day_of_week = EXTRACT(DOW FROM p_service_date)::SMALLINT;
  END IF;
  IF v_open IS NULL OR v_close IS NULL OR v_open = v_close THEN
    RAISE EXCEPTION USING MESSAGE = 'SERVICE_CLOSED', ERRCODE = '22023';
  END IF;

  v_open_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
  v_close_minute := EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER;
  v_start_minute := EXTRACT(HOUR FROM p_start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_start_time)::INTEGER;
  IF v_close_minute <= v_open_minute THEN v_close_minute := v_close_minute + 1440; END IF;
  IF v_start_minute < v_open_minute OR v_start_minute >= 1440 THEN
    RAISE EXCEPTION USING MESSAGE = 'WALKIN_TIME_INVALID', ERRCODE = '22023';
  END IF;

  v_duration := v_service.seating_duration_minutes + v_service.buffer_minutes;
  IF v_start_minute + v_duration > v_close_minute THEN
    RAISE EXCEPTION USING MESSAGE = 'WALKIN_TOO_CLOSE_TO_CLOSING', ERRCODE = '22023';
  END IF;

  IF (SELECT COUNT(*) FROM UNNEST(p_table_ids)) <> (SELECT COUNT(DISTINCT table_id) FROM UNNEST(p_table_ids) AS selected(table_id)) THEN
    RAISE EXCEPTION USING MESSAGE = 'DUPLICATE_TABLE', ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM UNNEST(p_table_ids) AS selected(table_id)
    LEFT JOIN public.restaurant_tables t ON t.id = selected.table_id
    WHERE t.id IS NULL OR t.restaurant_id <> p_restaurant_id OR t.is_active = FALSE
       OR t.floorplan_id <> (SELECT f.id FROM public.restaurant_floorplans f WHERE f.restaurant_id = p_restaurant_id AND f.is_active = TRUE)
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'TABLE_NOT_AVAILABLE', ERRCODE = '22023';
  END IF;
  IF (SELECT COALESCE(SUM(t.max_capacity), 0)
      FROM UNNEST(p_table_ids) AS selected(table_id)
      JOIN public.restaurant_tables t ON t.id = selected.table_id) < p_party_size THEN
    RAISE EXCEPTION USING MESSAGE = 'INSUFFICIENT_TABLE_CAPACITY', ERRCODE = '22023';
  END IF;

  v_starts_at := ((p_service_date + p_start_time) AT TIME ZONE v_restaurant.timezone);
  v_ends_at := v_starts_at + MAKE_INTERVAL(mins => v_duration);
  IF EXISTS (
    SELECT 1 FROM public.reservation_table_assignments a
    WHERE a.table_id = ANY(p_table_ids)
      AND a.released_at IS NULL
      AND a.starts_at < v_ends_at
      AND a.ends_at > v_starts_at
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'TABLE_ALREADY_RESERVED', ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reservations (
    restaurant_id, service_id, guest_name, guest_email, guest_phone, guest_phone_code,
    is_whatsapp, date, time, starts_at, ends_at, party_size, status, source,
    special_requests, seated_at
  ) VALUES (
    p_restaurant_id, p_service_id, COALESCE(NULLIF(BTRIM(p_guest_name), ''), 'Walk-in'),
    NULL, COALESCE(p_guest_phone, ''), COALESCE(p_guest_phone_code, '+91'), FALSE,
    p_service_date, TO_CHAR(p_start_time, 'HH24:MI'), v_starts_at, v_ends_at,
    p_party_size, 'seated', 'walk_in', NULLIF(BTRIM(p_special_requests), ''), NOW()
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, assigned_by)
  SELECT v_reservation_id, selected.table_id, v_starts_at, v_ends_at, auth.uid()
  FROM UNNEST(p_table_ids) AS selected(table_id);

  RETURN v_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_walkin_reservation(UUID, UUID, DATE, TIME, INTEGER, UUID[], TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_walkin_reservation(UUID, UUID, DATE, TIME, INTEGER, UUID[], TEXT, TEXT, TEXT, TEXT) TO authenticated;
