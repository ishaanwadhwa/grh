-- Enforce restaurant_booking_policies on the public booking path
-- (docs/agent-briefs/P1B-public-hardening.md task 3). The old
-- create_restaurant_reservation stays in place (revoked in 025) for
-- compatibility/rollback; create_public_reservation is the new entry point,
-- service_role only, called from POST /api/reservations.

-- Same shape as create_restaurant_reservation, plus p_manage_token_hash
-- (required, no default -- see note in 018 and docs/RESERVATIONS-API.md: only
-- the sha256 hex of the manage token is ever stored).
CREATE OR REPLACE FUNCTION public.create_public_reservation(
  p_restaurant_slug TEXT,
  p_service_id UUID,
  p_service_date DATE,
  p_slot_time TIME,
  p_party_size INTEGER,
  p_guest_name TEXT,
  p_guest_email TEXT,
  p_manage_token_hash TEXT,
  p_guest_phone TEXT DEFAULT '',
  p_guest_phone_code TEXT DEFAULT '+91',
  p_is_whatsapp BOOLEAN DEFAULT FALSE,
  p_special_requests TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant RECORD;
  v_service RECORD;
  v_policy public.restaurant_booking_policies%ROWTYPE;
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
  v_phone_e164 TEXT;
  v_today DATE;
  v_existing_covers INTEGER;
  v_status TEXT;
  v_fits BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_guest_name), '') IS NULL
     OR p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50
     OR p_slot_time IS NULL OR p_service_date IS NULL
     OR NULLIF(BTRIM(p_manage_token_hash), '') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_RESERVATION', ERRCODE = '22023';
  END IF;

  SELECT r.id, r.timezone INTO v_restaurant
    FROM public.restaurants r
    WHERE r.slug = p_restaurant_slug AND r.is_active = TRUE;
  IF v_restaurant.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  -- Lock before any availability/capacity read for this restaurant.
  PERFORM public._lock_restaurant_allocation(v_restaurant.id);

  v_today := (NOW() AT TIME ZONE v_restaurant.timezone)::DATE;
  IF p_service_date < v_today THEN
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

  -- Every restaurant gets a policy row automatically (015's trigger); fall
  -- back to the same defaults if one is somehow missing, so booking never
  -- breaks just because policy data is absent.
  SELECT * INTO v_policy FROM public.restaurant_booking_policies WHERE restaurant_id = v_restaurant.id;
  IF NOT FOUND THEN
    v_policy.auto_confirm := TRUE;
    v_policy.require_phone := FALSE;
    v_policy.require_email := TRUE;
    v_policy.large_party_threshold := NULL;
    v_policy.min_lead_minutes := 0;
    v_policy.max_advance_days := NULL;
    v_policy.last_seating_offset_minutes := NULL;
  END IF;

  v_phone_e164 := public.normalize_phone_e164(p_guest_phone_code, p_guest_phone);
  IF (v_policy.require_phone AND v_phone_e164 IS NULL)
     OR (v_policy.require_email AND NULLIF(BTRIM(p_guest_email), '') IS NULL) THEN
    RAISE EXCEPTION USING MESSAGE = 'CONTACT_REQUIRED', ERRCODE = '22023';
  END IF;

  IF v_policy.min_lead_minutes > 0 AND v_start < (NOW() + MAKE_INTERVAL(mins => v_policy.min_lead_minutes)) THEN
    RAISE EXCEPTION USING MESSAGE = 'OUTSIDE_BOOKING_WINDOW', ERRCODE = '22023';
  END IF;
  IF v_policy.max_advance_days IS NOT NULL AND p_service_date > (v_today + v_policy.max_advance_days) THEN
    RAISE EXCEPTION USING MESSAGE = 'OUTSIDE_BOOKING_WINDOW', ERRCODE = '22023';
  END IF;

  IF v_policy.last_seating_offset_minutes IS NOT NULL
     AND v_slot_minute > (v_close_minute - v_policy.last_seating_offset_minutes) THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  IF v_service.max_covers_per_slot IS NOT NULL THEN
    SELECT COALESCE(SUM(r.party_size), 0) INTO v_existing_covers
      FROM public.reservations r
      WHERE r.service_id = v_service.id
        AND r.date = p_service_date
        AND r.time = TO_CHAR(p_slot_time, 'HH24:MI')
        AND r.status IN ('pending', 'confirmed', 'arrived', 'seated');
    IF v_existing_covers + p_party_size > v_service.max_covers_per_slot THEN
      RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
    END IF;
  END IF;

  -- online_holdback_pct is not enforced here: per-table hold-back for
  -- walk-ins/EazyDiner is P3 (restaurant_table_combinations, online_bookable).

  IF v_policy.large_party_threshold IS NOT NULL AND p_party_size >= v_policy.large_party_threshold THEN
    v_status := 'pending';
  ELSIF NOT v_policy.auto_confirm THEN
    v_status := 'pending';
  ELSE
    v_status := 'confirmed';
  END IF;

  IF v_status = 'pending' THEN
    -- No table yet, but it still counts as unassigned demand -- a request
    -- that could never be seated must not silently oversell the night.
    v_fits := public._fits_with_unassigned(v_restaurant.id, v_start, v_end, p_party_size, '{}', NULL);
    IF NOT v_fits THEN
      RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
    END IF;
    v_table_id := NULL;
  ELSE
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
  END IF;

  v_guest_id := public.upsert_guest(p_guest_phone_code, p_guest_phone, p_guest_name, p_guest_email, p_is_whatsapp);

  INSERT INTO public.reservations (
    restaurant_id, service_id, guest_name, guest_email, guest_phone,
    guest_phone_code, is_whatsapp, date, time, starts_at, ends_at,
    party_size, status, source, special_requests, guest_id, manage_token_hash
  ) VALUES (
    v_restaurant.id, v_service.id, BTRIM(p_guest_name), NULLIF(BTRIM(p_guest_email), ''),
    COALESCE(p_guest_phone, ''), COALESCE(p_guest_phone_code, '+91'),
    COALESCE(p_is_whatsapp, FALSE), p_service_date, TO_CHAR(p_slot_time, 'HH24:MI'),
    v_start, v_end, p_party_size, v_status, 'website', NULLIF(BTRIM(p_special_requests), ''),
    v_guest_id, BTRIM(p_manage_token_hash)
  ) RETURNING id INTO v_reservation_id;

  IF v_table_id IS NOT NULL THEN
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
    VALUES (v_reservation_id, v_table_id, v_start, v_end);
  END IF;

  RETURN JSONB_BUILD_OBJECT('reservation_id', v_reservation_id, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_reservation(TEXT, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

-- get_available_restaurant_slots v2: same window/last-seating/covers rules,
-- plus requires_approval. The return type is changing (new column), so this
-- needs DROP + CREATE (not OR REPLACE) and a fresh GRANT.
DROP FUNCTION IF EXISTS public.get_available_restaurant_slots(TEXT, DATE, INTEGER);

CREATE FUNCTION public.get_available_restaurant_slots(
  p_restaurant_slug TEXT,
  p_service_date DATE,
  p_party_size INTEGER
)
RETURNS TABLE (service_id UUID, service_name TEXT, slot_time TIME, requires_approval BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_timezone TEXT;
  v_policy public.restaurant_booking_policies%ROWTYPE;
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
  v_today DATE;
  v_existing_covers INTEGER;
  v_requires_approval BOOLEAN;
BEGIN
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RETURN;
  END IF;

  SELECT r.id, COALESCE(r.timezone, 'Asia/Kolkata')
    INTO v_restaurant_id, v_timezone
    FROM public.restaurants r
    WHERE r.slug = p_restaurant_slug AND r.is_active = TRUE;

  IF v_restaurant_id IS NULL THEN
    RETURN;
  END IF;

  v_today := (NOW() AT TIME ZONE v_timezone)::DATE;
  IF p_service_date < v_today THEN
    RETURN;
  END IF;

  SELECT * INTO v_policy FROM public.restaurant_booking_policies WHERE restaurant_id = v_restaurant_id;
  IF NOT FOUND THEN
    v_policy.auto_confirm := TRUE;
    v_policy.min_lead_minutes := 0;
    v_policy.max_advance_days := NULL;
    v_policy.last_seating_offset_minutes := NULL;
    v_policy.large_party_threshold := NULL;
  END IF;

  IF v_policy.max_advance_days IS NOT NULL AND p_service_date > (v_today + v_policy.max_advance_days) THEN
    RETURN;
  END IF;

  v_requires_approval := (NOT v_policy.auto_confirm)
    OR (v_policy.large_party_threshold IS NOT NULL AND p_party_size >= v_policy.large_party_threshold);

  FOR v_service IN
    SELECT s.id, s.name, s.slot_interval_minutes, s.seating_duration_minutes,
           s.buffer_minutes, s.min_party_size, s.max_party_size, s.max_covers_per_slot
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
      -- last_seating_offset_minutes: the slot *start* must leave this much
      -- room before closing, on top of the duration already fitting.
      IF v_policy.last_seating_offset_minutes IS NOT NULL
         AND v_minutes > (v_close_minute - v_policy.last_seating_offset_minutes) THEN
        v_minutes := v_minutes + v_service.slot_interval_minutes;
        CONTINUE;
      END IF;

      v_slot := MAKE_TIME((v_minutes / 60)::INTEGER, (v_minutes % 60)::INTEGER, 0::DOUBLE PRECISION);
      v_start := ((p_service_date + v_slot) AT TIME ZONE v_timezone);
      v_end := v_start + MAKE_INTERVAL(mins => v_duration);

      IF v_policy.min_lead_minutes > 0 AND v_start < (NOW() + MAKE_INTERVAL(mins => v_policy.min_lead_minutes)) THEN
        v_minutes := v_minutes + v_service.slot_interval_minutes;
        CONTINUE;
      END IF;

      IF v_service.max_covers_per_slot IS NOT NULL THEN
        SELECT COALESCE(SUM(r.party_size), 0) INTO v_existing_covers
          FROM public.reservations r
          WHERE r.service_id = v_service.id
            AND r.date = p_service_date
            AND r.time = TO_CHAR(v_slot, 'HH24:MI')
            AND r.status IN ('pending', 'confirmed', 'arrived', 'seated');
        IF v_existing_covers + p_party_size > v_service.max_covers_per_slot THEN
          v_minutes := v_minutes + v_service.slot_interval_minutes;
          CONTINUE;
        END IF;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public._rank_table_options(v_restaurant_id, v_start, v_end, p_party_size, TRUE)
        WHERE fits_unassigned
      ) THEN
        service_id := v_service.id;
        service_name := v_service.name;
        slot_time := v_slot;
        requires_approval := v_requires_approval;
        RETURN NEXT;
      END IF;

      v_minutes := v_minutes + v_service.slot_interval_minutes;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_restaurant_slots(TEXT, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_restaurant_slots(TEXT, DATE, INTEGER) TO service_role;
