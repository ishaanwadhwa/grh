-- Guest self-service manage-token RPCs (docs/agent-briefs/P1B-public-hardening.md
-- task 7): view, cancel, modify. All looked up by manage_token_hash, all
-- service_role only -- the route hashes the raw token before calling these.

-- Guest-facing updates (cancel/modify) run via the service-role client, so
-- auth.uid() is NULL just like a background job -- log_reservation_update_event
-- would otherwise label them 'system'. A transaction-local setting lets the
-- two token RPCs below mark themselves as the guest explicitly; anything that
-- doesn't set it keeps the old auth.uid()-based 'staff'/'system' behaviour.
CREATE OR REPLACE FUNCTION public.log_reservation_update_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_source TEXT;
BEGIN
  v_actor_source := COALESCE(
    NULLIF(current_setting('app.actor_source', true), ''),
    CASE WHEN auth.uid() IS NOT NULL THEN 'staff' ELSE 'system' END
  );

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, from_status, to_status, actor_id, actor_source)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid(), v_actor_source);
  ELSIF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor_id, actor_source)
    VALUES (NEW.id, 'updated', auth.uid(), v_actor_source);
  END IF;

  RETURN NEW;
END;
$$;

-- Guest-safe summary only: no table, no internal flags, no phone/email.
CREATE OR REPLACE FUNCTION public.get_reservation_by_token(p_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_policy public.restaurant_booking_policies%ROWTYPE;
  v_can_change BOOLEAN;
BEGIN
  SELECT r.id, r.restaurant_id, r.status, r.date, r.time, r.party_size, r.guest_name,
         r.special_requests, r.starts_at, res.name AS restaurant_name, res.slug AS restaurant_slug
    INTO v_reservation
    FROM public.reservations r
    JOIN public.restaurants res ON res.id = r.restaurant_id
    WHERE r.manage_token_hash = p_hash;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_TOKEN', ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_policy FROM public.restaurant_booking_policies WHERE restaurant_id = v_reservation.restaurant_id;

  v_can_change := v_reservation.status IN ('pending', 'confirmed')
    AND v_reservation.starts_at > (NOW() + MAKE_INTERVAL(mins => COALESCE(v_policy.cancellation_cutoff_minutes, 0)));

  RETURN JSONB_BUILD_OBJECT(
    'id', v_reservation.id,
    'restaurantName', v_reservation.restaurant_name,
    'restaurantSlug', v_reservation.restaurant_slug,
    'status', v_reservation.status,
    'date', v_reservation.date,
    'time', v_reservation.time,
    'partySize', v_reservation.party_size,
    'guestName', v_reservation.guest_name,
    'specialRequests', v_reservation.special_requests,
    'canCancel', v_can_change,
    'canModify', v_can_change
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_by_token(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_reservation_by_token(p_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_policy public.restaurant_booking_policies%ROWTYPE;
BEGIN
  SELECT id, restaurant_id, status, starts_at INTO v_reservation
    FROM public.reservations WHERE manage_token_hash = p_hash;
  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_TOKEN', ERRCODE = 'P0002';
  END IF;
  -- Not pending/confirmed any more (already cancelled, or already seated and
  -- past the point of cancelling) is the same guest-facing outcome as being
  -- inside the cutoff: "you can't cancel this any more".
  IF v_reservation.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION USING MESSAGE = 'CANCELLATION_CUTOFF_PASSED', ERRCODE = '22023';
  END IF;

  SELECT * INTO v_policy FROM public.restaurant_booking_policies WHERE restaurant_id = v_reservation.restaurant_id;
  IF v_reservation.starts_at <= (NOW() + MAKE_INTERVAL(mins => COALESCE(v_policy.cancellation_cutoff_minutes, 0))) THEN
    RAISE EXCEPTION USING MESSAGE = 'CANCELLATION_CUTOFF_PASSED', ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.actor_source', 'guest', true);
  UPDATE public.reservations SET status = 'cancelled' WHERE id = v_reservation.id;

  RETURN JSONB_BUILD_OBJECT('reservation_id', v_reservation.id, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_reservation_by_token(TEXT) TO service_role;

-- Atomic: every check below runs before any write, so a failure leaves the
-- booking completely unchanged (SLOT_UNAVAILABLE / OUTSIDE_BOOKING_WINDOW /
-- CANCELLATION_CUTOFF_PASSED) rather than partially moved.
CREATE OR REPLACE FUNCTION public.modify_reservation_by_token(
  p_hash TEXT,
  p_date DATE,
  p_time TIME,
  p_party_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
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
  v_duration INTEGER;
  v_today DATE;
  v_existing_covers INTEGER;
  v_status TEXT;
  v_fits BOOLEAN;
  v_table_id UUID;
BEGIN
  IF p_date IS NULL OR p_time IS NULL OR p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_RESERVATION', ERRCODE = '22023';
  END IF;

  SELECT id, restaurant_id, service_id, status, starts_at
    INTO v_reservation
    FROM public.reservations WHERE manage_token_hash = p_hash;
  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_TOKEN', ERRCODE = 'P0002';
  END IF;
  IF v_reservation.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION USING MESSAGE = 'CANCELLATION_CUTOFF_PASSED', ERRCODE = '22023';
  END IF;

  SELECT id, timezone INTO v_restaurant FROM public.restaurants WHERE id = v_reservation.restaurant_id AND is_active = TRUE;
  IF v_restaurant.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESTAURANT_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  -- Lock before any availability/capacity read for this restaurant.
  PERFORM public._lock_restaurant_allocation(v_restaurant.id);

  SELECT * INTO v_policy FROM public.restaurant_booking_policies WHERE restaurant_id = v_restaurant.id;
  IF NOT FOUND THEN
    v_policy.auto_confirm := TRUE;
    v_policy.large_party_threshold := NULL;
    v_policy.min_lead_minutes := 0;
    v_policy.max_advance_days := NULL;
    v_policy.last_seating_offset_minutes := NULL;
    v_policy.cancellation_cutoff_minutes := 0;
  END IF;

  -- Same cutoff as cancelling: too close to the *current* booking time to change it.
  IF v_reservation.starts_at <= (NOW() + MAKE_INTERVAL(mins => COALESCE(v_policy.cancellation_cutoff_minutes, 0))) THEN
    RAISE EXCEPTION USING MESSAGE = 'CANCELLATION_CUTOFF_PASSED', ERRCODE = '22023';
  END IF;

  SELECT s.* INTO v_service
    FROM public.restaurant_services s
    WHERE s.id = v_reservation.service_id AND s.restaurant_id = v_restaurant.id AND s.is_active = TRUE;
  IF v_service.id IS NULL OR p_party_size NOT BETWEEN v_service.min_party_size AND v_service.max_party_size THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_today := (NOW() AT TIME ZONE v_restaurant.timezone)::DATE;
  IF p_date < v_today THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  SELECT o.is_closed, o.opens_at, o.closes_at INTO v_override
    FROM public.restaurant_service_date_overrides o
    WHERE o.service_id = v_service.id AND o.service_date = p_date;
  IF FOUND AND v_override.is_closed THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;
  IF FOUND AND v_override.opens_at IS NOT NULL THEN
    v_open := v_override.opens_at;
    v_close := v_override.closes_at;
  ELSE
    SELECT h.opens_at, h.closes_at INTO v_open, v_close
      FROM public.restaurant_service_hours h
      WHERE h.service_id = v_service.id AND h.day_of_week = EXTRACT(DOW FROM p_date)::SMALLINT;
  END IF;
  IF v_open IS NULL OR v_close IS NULL OR v_open = v_close THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_open_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
  v_close_minute := EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER;
  IF v_close_minute <= v_open_minute THEN
    v_close_minute := v_close_minute + 1440;
  END IF;
  v_slot_minute := EXTRACT(HOUR FROM p_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_time)::INTEGER;
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

  v_start := ((p_date + p_time) AT TIME ZONE v_restaurant.timezone);
  v_end := v_start + MAKE_INTERVAL(mins => v_duration);

  IF v_policy.min_lead_minutes > 0 AND v_start < (NOW() + MAKE_INTERVAL(mins => v_policy.min_lead_minutes)) THEN
    RAISE EXCEPTION USING MESSAGE = 'OUTSIDE_BOOKING_WINDOW', ERRCODE = '22023';
  END IF;
  IF v_policy.max_advance_days IS NOT NULL AND p_date > (v_today + v_policy.max_advance_days) THEN
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
        AND r.date = p_date
        AND r.time = TO_CHAR(p_time, 'HH24:MI')
        AND r.status IN ('pending', 'confirmed', 'arrived', 'seated')
        AND r.id <> v_reservation.id;
    IF v_existing_covers + p_party_size > v_service.max_covers_per_slot THEN
      RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_policy.large_party_threshold IS NOT NULL AND p_party_size >= v_policy.large_party_threshold THEN
    v_status := 'pending';
  ELSIF NOT v_policy.auto_confirm THEN
    v_status := 'pending';
  ELSE
    v_status := 'confirmed';
  END IF;

  IF v_status = 'pending' THEN
    v_fits := public._fits_with_unassigned(v_restaurant.id, v_start, v_end, p_party_size, '{}', v_reservation.id);
    IF NOT v_fits THEN
      RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
    END IF;
    v_table_id := NULL;
  ELSE
    SELECT t.id INTO v_table_id
      FROM public._rank_table_options(v_restaurant.id, v_start, v_end, p_party_size, TRUE, v_reservation.id) opt
      JOIN public.restaurant_tables t ON t.id = opt.table_ids[1]
      WHERE opt.fits_unassigned
      ORDER BY opt.rank
      LIMIT 1
      FOR UPDATE OF t SKIP LOCKED;
    IF v_table_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM set_config('app.actor_source', 'guest', true);

  UPDATE public.reservation_table_assignments
    SET released_at = NOW()
    WHERE reservation_id = v_reservation.id AND released_at IS NULL;

  UPDATE public.reservations
    SET date = p_date,
        time = TO_CHAR(p_time, 'HH24:MI'),
        starts_at = v_start,
        ends_at = v_end,
        party_size = p_party_size,
        status = v_status
    WHERE id = v_reservation.id;

  IF v_table_id IS NOT NULL THEN
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
    VALUES (v_reservation.id, v_table_id, v_start, v_end);
  END IF;

  RETURN JSONB_BUILD_OBJECT('reservation_id', v_reservation.id, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.modify_reservation_by_token(TEXT, DATE, TIME, INTEGER) TO service_role;
