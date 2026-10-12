-- Restaurant profile, opening rules, table layouts, and collision-safe reservations.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS service_id UUID,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

-- Backfill legacy clock values for reporting. Existing reservations remain
-- unassigned until an admin places them on the new floor plan.
UPDATE public.reservations
SET starts_at = ((date + time::time) AT TIME ZONE 'Asia/Kolkata'),
    ends_at = ((date + time::time) AT TIME ZONE 'Asia/Kolkata') + INTERVAL '90 minutes'
WHERE starts_at IS NULL
  AND time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$';

CREATE UNIQUE INDEX IF NOT EXISTS reservations_channel_external_ref_unique
  ON public.reservations (source, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.restaurant_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slot_interval_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 240),
  seating_duration_minutes SMALLINT NOT NULL DEFAULT 90 CHECK (seating_duration_minutes BETWEEN 15 AND 480),
  buffer_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 180),
  min_party_size SMALLINT NOT NULL DEFAULT 1 CHECK (min_party_size BETWEEN 1 AND 50),
  max_party_size SMALLINT NOT NULL DEFAULT 12 CHECK (max_party_size BETWEEN min_party_size AND 50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS public.restaurant_service_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.restaurant_services(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  CHECK (opens_at < closes_at),
  UNIQUE (service_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.restaurant_service_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.restaurant_services(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  opens_at TIME,
  closes_at TIME,
  note TEXT,
  CHECK ((opens_at IS NULL AND closes_at IS NULL) OR (opens_at < closes_at)),
  UNIQUE (service_id, service_date)
);

CREATE TABLE IF NOT EXISTS public.restaurant_floorplans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main floor',
  image_path TEXT NOT NULL,
  canvas_width INTEGER NOT NULL CHECK (canvas_width > 0),
  canvas_height INTEGER NOT NULL CHECK (canvas_height > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_one_active_floorplan
  ON public.restaurant_floorplans (restaurant_id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  floorplan_id UUID NOT NULL REFERENCES public.restaurant_floorplans(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  min_capacity SMALLINT NOT NULL DEFAULT 1 CHECK (min_capacity BETWEEN 1 AND 50),
  max_capacity SMALLINT NOT NULL DEFAULT 2 CHECK (max_capacity BETWEEN min_capacity AND 50),
  shape TEXT NOT NULL DEFAULT 'round' CHECK (shape IN ('round', 'square', 'rectangle')),
  x_percent NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (x_percent BETWEEN 0 AND 100),
  y_percent NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (y_percent BETWEEN 0 AND 100),
  width_percent NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (width_percent BETWEEN 2 AND 100),
  height_percent NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (height_percent BETWEEN 2 AND 100),
  rotation SMALLINT NOT NULL DEFAULT 0 CHECK (rotation BETWEEN 0 AND 359),
  zone TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (floorplan_id, label)
);

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.restaurant_services(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.reservation_table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS reservation_assignments_reservation_idx
  ON public.reservation_table_assignments (reservation_id)
  WHERE released_at IS NULL;

-- Prevent two active reservations from occupying the same table at overlapping times.
ALTER TABLE public.reservation_table_assignments
  ADD CONSTRAINT reservation_table_no_overlap
  EXCLUDE USING gist (
    table_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (released_at IS NULL);

CREATE OR REPLACE FUNCTION public.release_cancelled_reservation_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.reservation_table_assignments
      SET released_at = NOW()
      WHERE reservation_id = NEW.id AND released_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_release_tables_on_cancel
AFTER UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.release_cancelled_reservation_tables();

-- Safe public availability: returns only bookable service/time pairs, never the floor plan or guest data.
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

    IF v_open IS NULL OR v_close IS NULL OR v_open >= v_close THEN
      CONTINUE;
    END IF;

    v_start_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
    v_close_minute := EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER;
    v_duration := v_service.seating_duration_minutes + v_service.buffer_minutes;
    v_minutes := v_start_minute;

    WHILE v_minutes + v_duration <= v_close_minute LOOP
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

-- Public booking is transactional: lock the chosen table, insert reservation, and assignment together.
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
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_table_id UUID;
  v_reservation_id UUID;
  v_duration INTEGER;
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

  IF v_open IS NULL OR v_close IS NULL OR p_slot_time < v_open OR p_slot_time >= v_close THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_open_minute := EXTRACT(HOUR FROM v_open)::INTEGER * 60 + EXTRACT(MINUTE FROM v_open)::INTEGER;
  v_slot_offset := EXTRACT(HOUR FROM p_slot_time)::INTEGER * 60
                   + EXTRACT(MINUTE FROM p_slot_time)::INTEGER - v_open_minute;
  IF v_slot_offset < 0 OR MOD(v_slot_offset, v_service.slot_interval_minutes) <> 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'SLOT_UNAVAILABLE', ERRCODE = 'P0001';
  END IF;

  v_duration := v_service.seating_duration_minutes + v_service.buffer_minutes;
  IF (EXTRACT(HOUR FROM p_slot_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_slot_time)::INTEGER + v_duration)
       > (EXTRACT(HOUR FROM v_close)::INTEGER * 60 + EXTRACT(MINUTE FROM v_close)::INTEGER) THEN
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

  INSERT INTO public.reservations (
    restaurant_id, service_id, guest_name, guest_email, guest_phone,
    guest_phone_code, is_whatsapp, date, time, starts_at, ends_at,
    party_size, status, source, special_requests
  ) VALUES (
    v_restaurant.id, v_service.id, BTRIM(p_guest_name), BTRIM(p_guest_email),
    COALESCE(p_guest_phone, ''), COALESCE(p_guest_phone_code, '+91'),
    COALESCE(p_is_whatsapp, FALSE), p_service_date, TO_CHAR(p_slot_time, 'HH24:MI'),
    v_start, v_end, p_party_size, 'confirmed', 'website', NULLIF(BTRIM(p_special_requests), '')
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
  VALUES (v_reservation_id, v_table_id, v_start, v_end);

  RETURN v_reservation_id;
END;
$$;

-- Admin table reassignment is an all-or-nothing operation and checks the caller's admin profile.
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

-- Keep guest data private; public booking must go through the validated RPC above.
DROP POLICY IF EXISTS "Public insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users read reservations" ON public.reservations;
CREATE POLICY "Admins read reservations" ON public.reservations
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));

ALTER TABLE public.restaurant_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_service_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_service_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_floorplans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_table_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage restaurant services" ON public.restaurant_services
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
CREATE POLICY "Admins manage service hours" ON public.restaurant_service_hours
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
CREATE POLICY "Admins manage service overrides" ON public.restaurant_service_date_overrides
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
CREATE POLICY "Admins manage floorplans" ON public.restaurant_floorplans
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
CREATE POLICY "Admins manage restaurant tables" ON public.restaurant_tables
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
CREATE POLICY "Admins read table assignments" ON public.reservation_table_assignments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
CREATE POLICY "Admins update reservations" ON public.reservations
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.get_available_restaurant_slots(TEXT, DATE, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_reservation(TEXT, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_reservation_tables(UUID, UUID[]) TO authenticated;

-- Public restaurant photography stays in the existing restaurant-images bucket.
-- Operational floor plans are private and only available to authenticated admins.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('restaurant-floorplans', 'restaurant-floorplans', FALSE, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Admins read restaurant floorplans" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'restaurant-floorplans'
    AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid())
  );
CREATE POLICY "Admins upload restaurant floorplans" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'restaurant-floorplans'
    AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid())
  );
CREATE POLICY "Admins update restaurant floorplans" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'restaurant-floorplans'
    AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid())
  ) WITH CHECK (
    bucket_id = 'restaurant-floorplans'
    AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid())
  );
CREATE POLICY "Admins delete restaurant floorplans" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'restaurant-floorplans'
    AND EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid())
  );
