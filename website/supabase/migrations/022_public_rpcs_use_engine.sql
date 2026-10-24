-- Wire the public RPCs into the allocation engine (021), so online
-- availability and booking respect unassigned demand (docs/agent-briefs/
-- P1A-booking-engine.md task 3). Signatures, return types, and grants are
-- unchanged from the latest versions (007/016) -- only the table-selection
-- logic changes.

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

      -- A slot is available only if some single-table option still leaves
      -- every unassigned booking seatable (021 _rank_table_options/_fits_with_unassigned).
      IF EXISTS (
        SELECT 1 FROM public._rank_table_options(v_restaurant_id, v_start, v_end, p_party_size, TRUE)
        WHERE fits_unassigned
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

CREATE OR REPLACE FUNCTION public.create_restaurant_reservation(
  p_restaurant_slug TEXT,
  p_service_id UUID,
  p_service_date DATE,
  p_slot_time TIME,
  p_party_size INTEGER,
  p_guest_name TEXT,
  p_guest_email TEXT,
  p_guest_phone TEXT DEFAULT '',
  p_guest_phone_code TEXT DEFAULT '+91',
  p_is_whatsapp BOOLEAN DEFAULT FALSE,
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
  v_open TIME;
  v_close TIME;
  v_override RECORD;
  v_slot_offset INTEGER;
  v_open_minute INTEGER;
  v_close_minute INTEGER;
  v_slot_minute INTEGER;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_table_id UUID;
  v_reservation_id UUID;
  v_duration INTEGER;
  v_guest_id UUID;
BEGIN
  IF NULLIF(BTRIM(p_guest_name), '') IS NULL
     OR NULLIF(BTRIM(p_guest_email), '') IS NULL
     OR p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50
     OR p_slot_time IS NULL OR p_service_date IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_RESERVATION', ERRCODE = '22023';
  END IF;

  SELECT r.id, r.timezone INTO v_restaurant
    FROM public.restaurants r
    WHERE r.slug = p_restaurant_slug AND r.is_active = TRUE;
  IF v_restaurant.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  IF p_service_date < (NOW() AT TIME ZONE v_restaurant.timezone)::DATE THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  SELECT s.* INTO v_service
    FROM public.restaurant_services s
    WHERE s.id = p_service_id AND s.restaurant_id = v_restaurant.id AND s.is_active = TRUE;
  IF v_service.id IS NULL OR p_party_size NOT BETWEEN v_service.min_party_size AND v_service.max_party_size THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  SELECT o.is_closed, o.opens_at, o.closes_at INTO v_override
    FROM public.restaurant_service_date_overrides o
    WHERE o.service_id = v_service.id AND o.service_date = p_service_date;
  IF FOUND AND v_override.is_closed THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;
  IF FOUND AND v_override.opens_at IS NOT NULL THEN
    v_open := v_override.opens_at;
    v_close := v_override.closes_at;
  ELSE
    SELECT h.opens_at, h.closes_at INTO v_open, v_close
      FROM public.restaurant_service_hours h
      WHERE h.service_id = v_service.id
        AND h.day_of_week = EXTRACT(DOW FROM p_service_date)::SMALLINT;
  END IF;

  IF v_open IS NULL OR v_close IS NULL OR v_open = v_close THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_open_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
  v_close_minute := EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER;
  IF v_close_minute <= v_open_minute THEN
    v_close_minute := v_close_minute + 1440;
  END IF;
  v_slot_minute := EXTRACT(HOUR FROM p_slot_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_slot_time)::INTEGER;

  IF v_slot_minute < v_open_minute OR v_slot_minute >= 1440 THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_slot_offset := v_slot_minute - v_open_minute;
  IF MOD(v_slot_offset, v_service.slot_interval_minutes) <> 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_duration := v_service.seating_duration_minutes + v_service.buffer_minutes;
  IF v_slot_minute + v_duration > v_close_minute THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_start := ((p_service_date + p_slot_time) AT TIME ZONE v_restaurant.timezone);
  v_end := v_start + MAKE_INTERVAL(mins => v_duration);

  -- Best-fitting single table among the options that still leave every
  -- unassigned booking seatable, same ordering as before, now sourced from
  -- the shared engine (021). FOR UPDATE ... SKIP LOCKED is kept on the same
  -- single SELECT as the fits_unassigned filter, exactly as it was on the
  -- inline overlap check before, so the serialisation behaviour this relies
  -- on against a concurrent racing call to this same function is unchanged.
  SELECT t.id INTO v_table_id
    FROM public._rank_table_options(v_restaurant.id, v_start, v_end, p_party_size, TRUE) opt
    JOIN public.restaurant_tables t ON t.id = opt.table_ids[1]
    WHERE opt.fits_unassigned
    ORDER BY opt.rank
    LIMIT 1
    FOR UPDATE OF t SKIP LOCKED;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_guest_id := public.upsert_guest(p_guest_phone_code, p_guest_phone, p_guest_name, p_guest_email, p_is_whatsapp);

  INSERT INTO public.reservations (
    restaurant_id, service_id, guest_name, guest_email, guest_phone,
    guest_phone_code, is_whatsapp, date, time, starts_at, ends_at,
    party_size, status, source, special_requests, guest_id
  ) VALUES (
    v_restaurant.id, v_service.id, BTRIM(p_guest_name), BTRIM(p_guest_email),
    COALESCE(p_guest_phone, ''), COALESCE(p_guest_phone_code, '+91'),
    COALESCE(p_is_whatsapp, FALSE), p_service_date, TO_CHAR(p_slot_time, 'HH24:MI'),
    v_start, v_end, p_party_size, 'confirmed', 'website', NULLIF(BTRIM(p_special_requests), ''), v_guest_id
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
  VALUES (v_reservation_id, v_table_id, v_start, v_end);

  RETURN v_reservation_id;
END;
$$;
