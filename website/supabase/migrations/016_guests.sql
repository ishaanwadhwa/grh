-- Guest directory, linked from reservations by normalised phone number
-- (docs/RESERVATIONS-PLAN.md P0 task 3). Admin-only; never exposed publicly.

CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT UNIQUE NULL,
  email TEXT NULL,
  name TEXT NOT NULL DEFAULT '',
  notes TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  visit_count INTEGER NOT NULL DEFAULT 0,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_id UUID NULL REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reservations_guest_id_idx ON public.reservations (guest_id) WHERE guest_id IS NOT NULL;

-- Strips everything but digits and returns a '+'-prefixed E.164-ish number.
-- Returns NULL for an empty/whitespace-only phone so phone-less guests
-- (e.g. walk-ins) never get a bogus key. Defaults the country code to 91
-- (India) when one isn't supplied, matching the booking form's default.
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(p_code TEXT, p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
  v_code_digits TEXT;
BEGIN
  v_digits := REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  v_code_digits := REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(p_code), ''), '91'), '\D', '', 'g');
  IF v_code_digits = '' THEN
    v_code_digits := '91';
  END IF;

  RETURN '+' || v_code_digits || v_digits;
END;
$$;

-- Backfill: one guest per distinct E.164 phone found on existing reservations,
-- linked back to every reservation sharing that number. Reservations without
-- a usable phone (most walk-ins) are left with guest_id = NULL.
WITH phoned AS (
  SELECT
    r.id AS reservation_id,
    public.normalize_phone_e164(r.guest_phone_code, r.guest_phone) AS phone_e164,
    r.guest_name,
    r.guest_email,
    r.is_whatsapp,
    r.created_at
  FROM public.reservations r
  WHERE public.normalize_phone_e164(r.guest_phone_code, r.guest_phone) IS NOT NULL
),
first_per_phone AS (
  -- The earliest reservation for a phone number supplies the guest's
  -- initial name/email; later ones just link to the same guest row.
  SELECT DISTINCT ON (phone_e164) phone_e164, guest_name, guest_email, is_whatsapp
  FROM phoned
  ORDER BY phone_e164, created_at ASC
)
INSERT INTO public.guests (phone_e164, name, email, whatsapp_opt_in)
SELECT
  phone_e164,
  COALESCE(NULLIF(BTRIM(guest_name), ''), ''),
  NULLIF(BTRIM(guest_email), ''),
  COALESCE(is_whatsapp, FALSE)
FROM first_per_phone
ON CONFLICT (phone_e164) DO NOTHING;

UPDATE public.reservations r
SET guest_id = g.id
FROM public.guests g
WHERE r.guest_id IS NULL
  AND g.phone_e164 = public.normalize_phone_e164(r.guest_phone_code, r.guest_phone);

-- Keeps visit/no-show history even if a reservation's own phone is edited later.
UPDATE public.guests g
SET visit_count = counts.visits, no_show_count = counts.no_shows
FROM (
  SELECT guest_id,
         COUNT(*) FILTER (WHERE status = 'completed') AS visits,
         COUNT(*) FILTER (WHERE status = 'no_show') AS no_shows
  FROM public.reservations
  WHERE guest_id IS NOT NULL
  GROUP BY guest_id
) counts
WHERE g.id = counts.guest_id;

-- Upserts a guest by normalised phone and returns its id, or NULL when no
-- usable phone number is supplied. Existing name/email are only overwritten
-- when the new value is non-blank; whatsapp_opt_in is sticky (never
-- auto-revoked here -- that's for the guest-facing opt-out flow, P4).
CREATE OR REPLACE FUNCTION public.upsert_guest(
  p_phone_code TEXT,
  p_phone TEXT,
  p_name TEXT,
  p_email TEXT,
  p_is_whatsapp BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_e164 TEXT;
  v_guest_id UUID;
BEGIN
  v_phone_e164 := public.normalize_phone_e164(p_phone_code, p_phone);
  IF v_phone_e164 IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.guests (phone_e164, name, email, whatsapp_opt_in)
  VALUES (v_phone_e164, COALESCE(NULLIF(BTRIM(p_name), ''), ''), NULLIF(BTRIM(p_email), ''), COALESCE(p_is_whatsapp, FALSE))
  ON CONFLICT (phone_e164) DO UPDATE SET
    name = COALESCE(NULLIF(BTRIM(EXCLUDED.name), ''), public.guests.name),
    email = COALESCE(EXCLUDED.email, public.guests.email),
    whatsapp_opt_in = public.guests.whatsapp_opt_in OR EXCLUDED.whatsapp_opt_in,
    updated_at = NOW()
  RETURNING id INTO v_guest_id;

  RETURN v_guest_id;
END;
$$;

-- Internal helper only: it bypasses RLS on guests (SECURITY DEFINER) and must
-- only ever be invoked from other SECURITY DEFINER reservation RPCs below.
REVOKE ALL ON FUNCTION public.upsert_guest(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;

-- Keep guest visit/no-show history in sync as reservations move through their lifecycle.
CREATE OR REPLACE FUNCTION public.track_guest_visit_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.guests SET visit_count = visit_count + 1 WHERE id = NEW.guest_id;
    ELSIF NEW.status = 'no_show' THEN
      UPDATE public.guests SET no_show_count = no_show_count + 1 WHERE id = NEW.guest_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_track_guest_counters
  AFTER UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.track_guest_visit_counters();

-- Re-create create_restaurant_reservation (unchanged signature/return type)
-- to upsert the guest and stamp guest_id on the new reservation.
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

  SELECT t.id INTO v_table_id
    FROM public.restaurant_floorplans f
    JOIN public.restaurant_tables t ON t.floorplan_id = f.id
    WHERE f.restaurant_id = v_restaurant.id AND f.is_active = TRUE
      AND t.restaurant_id = v_restaurant.id AND t.is_active = TRUE
      AND t.min_capacity <= p_party_size AND t.max_capacity >= p_party_size
      AND NOT EXISTS (
        SELECT 1 FROM public.reservation_table_assignments a
        WHERE a.table_id = t.id AND a.released_at IS NULL
          AND a.starts_at < v_end AND a.ends_at > v_start
      )
    ORDER BY (t.max_capacity - p_party_size), t.max_capacity, t.label
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

-- Re-create create_walkin_reservation (unchanged signature/return type) to
-- upsert the guest and stamp guest_id. Walk-ins without a phone keep guest_id NULL.
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

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage guests" ON public.guests
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
