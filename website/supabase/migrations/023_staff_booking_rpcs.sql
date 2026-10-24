-- Staff booking RPCs (docs/agent-briefs/P1A-booking-engine.md task 4):
-- suggest_tables, create_staff_reservation, set_reservation_tables. All
-- SECURITY DEFINER with an admin_profiles check first, and an explicit
-- GRANT EXECUTE ... TO authenticated (private by default since 019).
-- Two small private helpers (_service_window, _validate_table_selection) are
-- shared internal building blocks, same as 021 -- no grants on either.

-- Resolves a staff-entered (date, time) against a service's hours into a
-- concrete [starts_at, ends_at) window (duration = seating + buffer), plus
-- whether it falls outside the service's hours for that date (overnight
-- services supported, same "close <= open means next day" rule as 005/013).
-- Staff times don't need to land on the slot interval.
CREATE OR REPLACE FUNCTION public._service_window(
  p_restaurant_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_time TIME
)
RETURNS TABLE (starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, outside_hours BOOLEAN)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  v_duration INTEGER;
  v_open TIME;
  v_close TIME;
  v_override RECORD;
  v_open_minute INTEGER;
  v_close_minute INTEGER;
  v_time_minute INTEGER;
BEGIN
  SELECT COALESCE(r.timezone, 'Asia/Kolkata') INTO v_timezone
    FROM public.restaurants r WHERE r.id = p_restaurant_id;

  SELECT s.seating_duration_minutes + s.buffer_minutes INTO v_duration
    FROM public.restaurant_services s
    WHERE s.id = p_service_id AND s.restaurant_id = p_restaurant_id;

  SELECT o.is_closed, o.opens_at, o.closes_at INTO v_override
    FROM public.restaurant_service_date_overrides o
    WHERE o.service_id = p_service_id AND o.service_date = p_date;
  IF FOUND AND v_override.is_closed THEN
    v_open := NULL;
    v_close := NULL;
  ELSIF FOUND AND v_override.opens_at IS NOT NULL THEN
    v_open := v_override.opens_at;
    v_close := v_override.closes_at;
  ELSE
    SELECT h.opens_at, h.closes_at INTO v_open, v_close
      FROM public.restaurant_service_hours h
      WHERE h.service_id = p_service_id AND h.day_of_week = EXTRACT(DOW FROM p_date)::SMALLINT;
  END IF;

  starts_at := (p_date + p_time) AT TIME ZONE v_timezone;
  ends_at := starts_at + MAKE_INTERVAL(mins => COALESCE(v_duration, 0));
  outside_hours := TRUE;

  IF v_open IS NOT NULL AND v_close IS NOT NULL AND v_open <> v_close THEN
    v_open_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
    v_close_minute := EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER;
    IF v_close_minute <= v_open_minute THEN
      v_close_minute := v_close_minute + 1440;
    END IF;
    v_time_minute := EXTRACT(HOUR FROM p_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_time)::INTEGER;
    IF v_time_minute >= v_open_minute AND v_time_minute < 1440
       AND (v_time_minute + COALESCE(v_duration, 0)) <= v_close_minute THEN
      outside_hours := FALSE;
    END IF;
  END IF;

  RETURN NEXT;
END;
$$;

-- Shared validation for a staff-chosen table list: non-empty, no duplicates,
-- and every table active, on the restaurant's active floor plan.
CREATE OR REPLACE FUNCTION public._validate_table_selection(
  p_restaurant_id UUID,
  p_table_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF COALESCE(ARRAY_LENGTH(p_table_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'SELECT_AT_LEAST_ONE_TABLE', ERRCODE = '22023';
  END IF;
  IF (SELECT COUNT(*) FROM UNNEST(p_table_ids)) <> (SELECT COUNT(DISTINCT x) FROM UNNEST(p_table_ids) AS x) THEN
    RAISE EXCEPTION USING MESSAGE = 'DUPLICATE_TABLE', ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM UNNEST(p_table_ids) AS selected(table_id)
    LEFT JOIN public.restaurant_tables t ON t.id = selected.table_id
    WHERE t.id IS NULL OR t.restaurant_id <> p_restaurant_id OR t.is_active = FALSE
       OR t.floorplan_id <> (SELECT f.id FROM public.restaurant_floorplans f WHERE f.restaurant_id = p_restaurant_id AND f.is_active = TRUE)
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'TABLE_NOT_AVAILABLE', ERRCODE = '22023';
  END IF;
END;
$$;

-- Suggests table options for a staff booking. Never fails on "no table" or
-- "outside hours" -- those come back as warnings so the UI can offer manual
-- picking, booking with no table, or "book anyway".
CREATE OR REPLACE FUNCTION public.suggest_tables(
  p_restaurant_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_time TIME,
  p_party_size INTEGER,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window RECORD;
  v_warnings TEXT[] := '{}';
  v_options JSONB;
  v_unassigned_fits BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 OR p_date IS NULL OR p_time IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_SUGGESTION', ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = p_restaurant_id AND r.is_active = TRUE) THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurant_services s WHERE s.id = p_service_id AND s.restaurant_id = p_restaurant_id AND s.is_active = TRUE) THEN
    RAISE EXCEPTION USING MESSAGE = 'SERVICE_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_window FROM public._service_window(p_restaurant_id, p_service_id, p_date, p_time);
  IF v_window.outside_hours THEN
    v_warnings := ARRAY_APPEND(v_warnings, 'OUTSIDE_SERVICE_HOURS');
  END IF;

  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
      'table_ids', opt.table_ids,
      'labels', ARRAY(SELECT t.label FROM public.restaurant_tables t
                        WHERE t.id = ANY(opt.table_ids)
                        ORDER BY ARRAY_POSITION(opt.table_ids, t.id)),
      'total_capacity', opt.total_capacity,
      'fits_unassigned', opt.fits_unassigned
    ) ORDER BY opt.rank), '[]'::jsonb)
    INTO v_options
    FROM public._rank_table_options(p_restaurant_id, v_window.starts_at, v_window.ends_at, p_party_size, FALSE, p_exclude_reservation_id) opt;

  IF v_options = '[]'::jsonb THEN
    v_warnings := ARRAY_APPEND(v_warnings, 'NO_TABLE_FITS');
    -- No table fits at all, so the only question is whether leaving it
    -- unassigned is itself safe.
    v_unassigned_fits := public._fits_with_unassigned(p_restaurant_id, v_window.starts_at, v_window.ends_at, p_party_size, '{}', p_exclude_reservation_id);
  ELSE
    -- The top-ranked option is what the UI preselects; its fits_unassigned
    -- is what "accepting the suggestion" would actually do to the night.
    v_unassigned_fits := (v_options -> 0 ->> 'fits_unassigned')::BOOLEAN;
  END IF;

  IF NOT v_unassigned_fits THEN
    v_warnings := ARRAY_APPEND(v_warnings, 'UNASSIGNED_WOULD_NOT_FIT');
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'starts_at', v_window.starts_at,
    'ends_at', v_window.ends_at,
    'options', v_options,
    'unassigned_fits', v_unassigned_fits,
    'warnings', TO_JSONB(v_warnings)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_tables(UUID, UUID, DATE, TIME, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_tables(UUID, UUID, DATE, TIME, INTEGER, UUID) TO authenticated;

-- A future booking from any staff-entered source (phone / eazydiner / other),
-- with auto/manual/no table, and an auditable override when it doesn't
-- cleanly fit. Always confirmed -- staff bookings don't go through the
-- pending/large-party-approval flow (that's the public policy path, P1B).
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

  -- Whichever mode chose it, taking v_table_ids (or, if none, adding
  -- p_party_size as new unassigned demand) must still leave every other
  -- unassigned booking seatable.
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

REVOKE ALL ON FUNCTION public.create_staff_reservation(UUID, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[], TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_staff_reservation(UUID, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[], TEXT, TEXT, BOOLEAN) TO authenticated;

-- Assign, reassign, or (empty array) unassign a reservation's tables.
-- assign_reservation_tables (004) is left in place for compatibility but the
-- admin UI calls this instead from now on.
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
  v_total_capacity INTEGER;
  v_needs_attention BOOLEAN := FALSE;
  v_attention_reason TEXT;
  v_fits BOOLEAN;
  v_table_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()) THEN
    RAISE EXCEPTION USING MESSAGE = 'FORBIDDEN', ERRCODE = '42501';
  END IF;

  SELECT restaurant_id, starts_at, ends_at, party_size, status
    INTO v_reservation
    FROM public.reservations WHERE id = p_reservation_id AND status <> 'cancelled';
  IF v_reservation.restaurant_id IS NULL OR v_reservation.starts_at IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVATION_NOT_FOUND', ERRCODE = 'P0002';
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
      v_attention_reason := 'over_capacity';
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

REVOKE ALL ON FUNCTION public.set_reservation_tables(UUID, UUID[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_reservation_tables(UUID, UUID[], BOOLEAN) TO authenticated;

-- 'tables_released' is a new event type for set_reservation_tables unassigning.
ALTER TABLE public.reservation_events DROP CONSTRAINT reservation_events_event_type_check;
ALTER TABLE public.reservation_events
  ADD CONSTRAINT reservation_events_event_type_check
  CHECK (event_type IN ('created', 'status_changed', 'tables_assigned', 'tables_released', 'updated'));

-- Record override/attention info on the 'created' event too (harmless no-op
-- payload addition for the existing website/walk-in creation paths, which
-- never set these columns).
CREATE OR REPLACE FUNCTION public.log_reservation_created_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.reservation_events (reservation_id, event_type, to_status, actor_id, actor_source, payload)
  VALUES (
    NEW.id,
    'created',
    NEW.status,
    auth.uid(),
    CASE WHEN auth.uid() IS NOT NULL THEN 'staff' ELSE 'guest' END,
    JSONB_BUILD_OBJECT('source', NEW.source, 'needs_attention', NEW.needs_attention, 'attention_reason', NEW.attention_reason)
  );
  RETURN NEW;
END;
$$;
