-- Fixes carried over from the P1A review (docs/agent-briefs/P1A-questions.md
-- "Reviewer notes"): a per-restaurant allocation lock so two bookings arriving
-- at once can't both pass the unassigned-capacity check, a reservation that's
-- no longer active can't be reassigned, and reassigning no longer silently
-- clears an outside_hours flag. No grants change on any of these -- all four
-- functions already carry their grants from earlier migrations.

-- Serialises allocation decisions (reads of free tables / unassigned demand,
-- and the writes that follow) per restaurant. Held for the rest of the
-- current transaction (pg_advisory_xact_lock), so two callers racing for the
-- same restaurant's capacity can't both see "it fits" before either commits.
-- hashtextextended(..., 0) turns the restaurant id into a stable bigint key;
-- the 'alloc:' prefix keeps this lock namespace separate from any other
-- advisory lock use in the future.
CREATE OR REPLACE FUNCTION public._lock_restaurant_allocation(p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('alloc:' || p_restaurant_id::text, 0));
END;
$$;

-- create_staff_reservation: take the lock right after validating the
-- restaurant/service exist, before the engine does any capacity read.
CREATE OR REPLACE FUNCTION public.create_staff_reservation(
  p_restaurant_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_time TIME,
  p_party_size INTEGER,
  p_guest_name TEXT,
  p_guest_phone TEXT,
  p_guest_phone_code TEXT DEFAULT '+91',
  p_guest_email TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'phone',
  p_table_mode TEXT DEFAULT 'none',
  p_table_ids UUID[] DEFAULT '{}',
  p_special_requests TEXT DEFAULT NULL,
  p_external_reference TEXT DEFAULT NULL,
  p_allow_override BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window RECORD;
  v_existing_id UUID;
  v_table_ids UUID[] := '{}';
  v_total_capacity INTEGER;
  v_needs_attention BOOLEAN := FALSE;
  v_attention_reason TEXT;
  v_fits BOOLEAN;
  v_guest_id UUID;
  v_reservation_id UUID;
  v_table_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_guest_name), '') IS NULL
     OR p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50
     OR p_date IS NULL OR p_time IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_STAFF_RESERVATION', ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('phone', 'eazydiner', 'other') THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_SOURCE', ERRCODE = '22023';
  END IF;
  IF p_table_mode NOT IN ('auto', 'manual', 'none') THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_TABLE_MODE', ERRCODE = '22023';
  END IF;
  IF p_source = 'eazydiner' AND NULLIF(BTRIM(p_external_reference), '') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'EXTERNAL_REFERENCE_REQUIRED', ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = p_restaurant_id AND r.is_active = TRUE) THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurant_services s WHERE s.id = p_service_id AND s.restaurant_id = p_restaurant_id AND s.is_active = TRUE) THEN
    RAISE EXCEPTION USING MESSAGE = 'SERVICE_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  PERFORM public._lock_restaurant_allocation(p_restaurant_id);

  -- Idempotent on (source, external_reference) -- a duplicate import/entry
  -- returns the existing booking instead of erroring (prepares for P5).
  IF NULLIF(BTRIM(p_external_reference), '') IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.reservations
      WHERE source = p_source AND external_reference = BTRIM(p_external_reference);
    IF v_existing_id IS NOT NULL THEN
      RETURN JSONB_BUILD_OBJECT(
        'reservation_id', v_existing_id,
        'table_ids', COALESCE((SELECT JSONB_AGG(a.table_id) FROM public.reservation_table_assignments a WHERE a.reservation_id = v_existing_id AND a.released_at IS NULL), '[]'::jsonb),
        'needs_attention', (SELECT r.needs_attention FROM public.reservations r WHERE r.id = v_existing_id),
        'warnings', JSONB_BUILD_ARRAY('DUPLICATE_EXTERNAL_REFERENCE')
      );
    END IF;
  END IF;

  SELECT * INTO v_window FROM public._service_window(p_restaurant_id, p_service_id, p_date, p_time);
  IF v_window.outside_hours THEN
    IF NOT p_allow_override THEN
      RAISE EXCEPTION USING MESSAGE = 'OUTSIDE_SERVICE_HOURS', ERRCODE = '22023';
    END IF;
    v_needs_attention := TRUE;
    v_attention_reason := 'outside_hours';
  END IF;

  IF p_table_mode = 'none' THEN
    v_table_ids := '{}';

  ELSIF p_table_mode = 'auto' THEN
    SELECT opt.table_ids INTO v_table_ids
      FROM public._rank_table_options(p_restaurant_id, v_window.starts_at, v_window.ends_at, p_party_size, FALSE, NULL) opt
      ORDER BY opt.rank
      LIMIT 1;
    IF v_table_ids IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'NO_TABLE_AVAILABLE', ERRCODE = 'P0001';
    END IF;

  ELSE -- manual
    PERFORM public._validate_table_selection(p_restaurant_id, p_table_ids);
    IF EXISTS (
      SELECT 1 FROM UNNEST(p_table_ids) AS chosen(table_id)
      WHERE chosen.table_id NOT IN (
        SELECT ft.table_id FROM public._free_tables(p_restaurant_id, v_window.starts_at, v_window.ends_at, NULL) ft
      )
    ) THEN
      RAISE EXCEPTION USING MESSAGE = 'TABLE_ALREADY_RESERVED', ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(t.max_capacity), 0) INTO v_total_capacity
      FROM public.restaurant_tables t WHERE t.id = ANY(p_table_ids);
    IF v_total_capacity < p_party_size THEN
      IF NOT p_allow_override THEN
        RAISE EXCEPTION USING MESSAGE = 'OVER_CAPACITY', ERRCODE = '22023';
      END IF;
      v_needs_attention := TRUE;
      v_attention_reason := COALESCE(v_attention_reason, 'over_capacity');
    END IF;

    v_table_ids := p_table_ids;
  END IF;

  v_fits := public._fits_with_unassigned(p_restaurant_id, v_window.starts_at, v_window.ends_at, p_party_size, v_table_ids, NULL);
  IF NOT v_fits THEN
    IF NOT p_allow_override THEN
      RAISE EXCEPTION USING MESSAGE = 'CAPACITY_EXCEEDED', ERRCODE = '22023';
    END IF;
    v_needs_attention := TRUE;
    v_attention_reason := COALESCE(v_attention_reason, 'overbooked');
  END IF;

  v_guest_id := public.upsert_guest(p_guest_phone_code, p_guest_phone, p_guest_name, p_guest_email, FALSE);

  INSERT INTO public.reservations (
    restaurant_id, service_id, guest_name, guest_email, guest_phone, guest_phone_code,
    is_whatsapp, date, time, starts_at, ends_at, party_size, status, source,
    special_requests, external_reference, guest_id, needs_attention, attention_reason
  ) VALUES (
    p_restaurant_id, p_service_id, BTRIM(p_guest_name), NULLIF(BTRIM(p_guest_email), ''),
    COALESCE(p_guest_phone, ''), COALESCE(p_guest_phone_code, '+91'), FALSE,
    p_date, TO_CHAR(p_time, 'HH24:MI'), v_window.starts_at, v_window.ends_at, p_party_size,
    'confirmed', p_source, NULLIF(BTRIM(p_special_requests), ''), NULLIF(BTRIM(p_external_reference), ''),
    v_guest_id, v_needs_attention, v_attention_reason
  ) RETURNING id INTO v_reservation_id;

  IF COALESCE(ARRAY_LENGTH(v_table_ids, 1), 0) > 0 THEN
    FOREACH v_table_id IN ARRAY v_table_ids LOOP
      INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, assigned_by)
      VALUES (v_reservation_id, v_table_id, v_window.starts_at, v_window.ends_at, auth.uid());
    END LOOP;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'reservation_id', v_reservation_id,
    'table_ids', TO_JSONB(v_table_ids),
    'needs_attention', v_needs_attention,
    'warnings', CASE WHEN v_attention_reason IS NOT NULL THEN JSONB_BUILD_ARRAY(v_attention_reason) ELSE '[]'::jsonb END
  );
END;
$$;

-- set_reservation_tables: lock before any capacity read; only active
-- reservations can be reassigned; outside_hours survives a reassignment
-- instead of being silently cleared.
CREATE OR REPLACE FUNCTION public.set_reservation_tables(
  p_reservation_id UUID,
  p_table_ids UUID[],
  p_allow_override BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_window RECORD;
  v_total_capacity INTEGER;
  v_needs_attention BOOLEAN := FALSE;
  v_attention_reason TEXT;
  v_fits BOOLEAN;
  v_table_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  SELECT restaurant_id, service_id, date, time, starts_at, ends_at, party_size, status
    INTO v_reservation
    FROM public.reservations WHERE id = p_reservation_id;
  IF v_reservation.restaurant_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVATION_NOT_FOUND', ERRCODE = 'P0002';
  END IF;
  IF v_reservation.status NOT IN ('pending', 'confirmed', 'arrived', 'seated') THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVATION_NOT_ACTIVE', ERRCODE = '22023';
  END IF;

  PERFORM public._lock_restaurant_allocation(v_reservation.restaurant_id);

  -- Preserve (never silently clear) an outside_hours flag: the time isn't
  -- changing here, so if it was outside hours before, it still is.
  IF v_reservation.service_id IS NOT NULL THEN
    SELECT * INTO v_window FROM public._service_window(v_reservation.restaurant_id, v_reservation.service_id, v_reservation.date, v_reservation.time::TIME);
    IF v_window.outside_hours THEN
      v_needs_attention := TRUE;
      v_attention_reason := 'outside_hours';
    END IF;
  END IF;

  IF COALESCE(ARRAY_LENGTH(p_table_ids, 1), 0) > 0 THEN
    PERFORM public._validate_table_selection(v_reservation.restaurant_id, p_table_ids);
    IF EXISTS (
      SELECT 1 FROM UNNEST(p_table_ids) AS chosen(table_id)
      WHERE chosen.table_id NOT IN (
        SELECT ft.table_id FROM public._free_tables(v_reservation.restaurant_id, v_reservation.starts_at, v_reservation.ends_at, p_reservation_id) ft
      )
    ) THEN
      RAISE EXCEPTION USING MESSAGE = 'TABLE_ALREADY_RESERVED', ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(t.max_capacity), 0) INTO v_total_capacity
      FROM public.restaurant_tables t WHERE t.id = ANY(p_table_ids);
    IF v_total_capacity < v_reservation.party_size THEN
      IF NOT p_allow_override THEN
        RAISE EXCEPTION USING MESSAGE = 'OVER_CAPACITY', ERRCODE = '22023';
      END IF;
      v_needs_attention := TRUE;
      v_attention_reason := COALESCE(v_attention_reason, 'over_capacity');
    END IF;
  END IF;

  v_fits := public._fits_with_unassigned(v_reservation.restaurant_id, v_reservation.starts_at, v_reservation.ends_at, v_reservation.party_size, p_table_ids, p_reservation_id);
  IF NOT v_fits THEN
    IF NOT p_allow_override THEN
      RAISE EXCEPTION USING MESSAGE = 'CAPACITY_EXCEEDED', ERRCODE = '22023';
    END IF;
    v_needs_attention := TRUE;
    v_attention_reason := COALESCE(v_attention_reason, 'overbooked');
  END IF;

  UPDATE public.reservation_table_assignments
    SET released_at = NOW()
    WHERE reservation_id = p_reservation_id AND released_at IS NULL;

  IF COALESCE(ARRAY_LENGTH(p_table_ids, 1), 0) = 0 THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor_id, actor_source)
    VALUES (p_reservation_id, 'tables_released', auth.uid(), 'staff');
  ELSE
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, assigned_by)
      VALUES (p_reservation_id, v_table_id, v_reservation.starts_at, v_reservation.ends_at, auth.uid());
    END LOOP;
  END IF;

  UPDATE public.reservations
    SET needs_attention = v_needs_attention,
        attention_reason = v_attention_reason
    WHERE id = p_reservation_id;

  RETURN JSONB_BUILD_OBJECT(
    'reservation_id', p_reservation_id,
    'table_ids', TO_JSONB(p_table_ids),
    'needs_attention', v_needs_attention
  );
END;
$$;

-- create_walkin_reservation: lock right after the restaurant/service checks,
-- before the table-overlap (capacity) check.
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
  v_guest_name TEXT;
  v_guest_id UUID;
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

  PERFORM public._lock_restaurant_allocation(p_restaurant_id);

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

  v_guest_name := COALESCE(NULLIF(BTRIM(p_guest_name), ''), 'Walk-in');
  v_guest_id := public.upsert_guest(p_guest_phone_code, p_guest_phone, v_guest_name, NULL, FALSE);

  INSERT INTO public.reservations (
    restaurant_id, service_id, guest_name, guest_email, guest_phone, guest_phone_code,
    is_whatsapp, date, time, starts_at, ends_at, party_size, status, source,
    special_requests, seated_at, guest_id
  ) VALUES (
    p_restaurant_id, p_service_id, v_guest_name,
    NULL, COALESCE(p_guest_phone, ''), COALESCE(p_guest_phone_code, '+91'), FALSE,
    p_service_date, TO_CHAR(p_start_time, 'HH24:MI'), v_starts_at, v_ends_at,
    p_party_size, 'seated', 'walk_in', NULLIF(BTRIM(p_special_requests), ''), NOW(), v_guest_id
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, assigned_by)
  SELECT v_reservation_id, selected.table_id, v_starts_at, v_ends_at, auth.uid()
  FROM UNNEST(p_table_ids) AS selected(table_id);

  RETURN v_reservation_id;
END;
$$;

-- assign_reservation_tables: lock right after finding the reservation's
-- restaurant, before the capacity check. Kept for compatibility (004); no
-- admin UI calls it since P1A, but it's still reachable directly.
CREATE OR REPLACE FUNCTION public.assign_reservation_tables(
  p_reservation_id UUID,
  p_table_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_party_size INTEGER;
  v_table_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  SELECT restaurant_id, starts_at, ends_at, party_size
    INTO v_restaurant_id, v_start, v_end, v_party_size
    FROM public.reservations WHERE id = p_reservation_id AND status <> 'cancelled';
  IF v_restaurant_id IS NULL OR v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVATION_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  PERFORM public._lock_restaurant_allocation(v_restaurant_id);

  IF COALESCE(CARDINALITY(p_table_ids), 0) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'SELECT_AT_LEAST_ONE_TABLE', ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM UNNEST(p_table_ids) AS chosen(id)
    LEFT JOIN public.restaurant_tables t ON t.id = chosen.id
    WHERE t.id IS NULL OR t.restaurant_id <> v_restaurant_id OR t.is_active = FALSE
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_TABLE', ERRCODE = '22023';
  END IF;

  IF (SELECT COUNT(DISTINCT chosen.id) FROM UNNEST(p_table_ids) AS chosen(id)) <> CARDINALITY(p_table_ids) THEN
    RAISE EXCEPTION USING MESSAGE = 'DUPLICATE_TABLE', ERRCODE = '22023';
  END IF;
  IF (SELECT COALESCE(SUM(t.max_capacity), 0)
      FROM UNNEST(p_table_ids) AS chosen(id)
      JOIN public.restaurant_tables t ON t.id = chosen.id) < v_party_size THEN
    RAISE EXCEPTION USING MESSAGE = 'INSUFFICIENT_TABLE_CAPACITY', ERRCODE = '22023';
  END IF;

  UPDATE public.reservation_table_assignments
    SET released_at = NOW()
    WHERE reservation_id = p_reservation_id AND released_at IS NULL;

  FOREACH v_table_id IN ARRAY p_table_ids LOOP
    INSERT INTO public.reservation_table_assignments (
      reservation_id, table_id, starts_at, ends_at, assigned_by
    ) VALUES (p_reservation_id, v_table_id, v_start, v_end, auth.uid());
  END LOOP;
END;
$$;
