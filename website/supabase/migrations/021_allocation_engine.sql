-- Internal allocation engine (docs/agent-briefs/P1A-booking-engine.md task 2).
-- No GRANTs here: these are building blocks for the public/staff RPCs in
-- 022/023, never called directly over PostgREST. 019 made new functions
-- private by default, so this is enough to keep them that way.

-- The active tables on the active floor plan with no overlapping active
-- assignment. Assignments belonging to p_exclude_reservation_id are ignored,
-- so re-checking a reservation that already holds a table sees that table as
-- free again (for "what if I moved it" / re-suggestion purposes).
CREATE OR REPLACE FUNCTION public._free_tables(
  p_restaurant_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS TABLE (table_id UUID, label TEXT, min_capacity SMALLINT, max_capacity SMALLINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT t.id, t.label, t.min_capacity, t.max_capacity
  FROM public.restaurant_floorplans f
  JOIN public.restaurant_tables t ON t.floorplan_id = f.id
  WHERE f.restaurant_id = p_restaurant_id
    AND f.is_active = TRUE
    AND t.restaurant_id = p_restaurant_id
    AND t.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.reservation_table_assignments a
      WHERE a.table_id = t.id
        AND a.released_at IS NULL
        AND a.starts_at < p_ends_at
        AND a.ends_at > p_starts_at
        AND (p_exclude_reservation_id IS NULL OR a.reservation_id <> p_exclude_reservation_id)
    );
$$;

-- Active reservations (pending/confirmed/arrived/seated) overlapping the
-- window that currently have no active table assignment at all -- i.e. a
-- booking the hostess promised a seat to but hasn't placed on the floor yet.
-- This is the demand that online booking must not resell.
CREATE OR REPLACE FUNCTION public._unassigned_demand(
  p_restaurant_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS TABLE (reservation_id UUID, party_size INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.id, r.party_size
  FROM public.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.status IN ('pending', 'confirmed', 'arrived', 'seated')
    AND r.starts_at < p_ends_at
    AND r.ends_at > p_starts_at
    AND (p_exclude_reservation_id IS NULL OR r.id <> p_exclude_reservation_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.reservation_table_assignments a
      WHERE a.reservation_id = r.id AND a.released_at IS NULL
    );
$$;

-- Can every unassigned booking in this window -- plus p_new_party, if it's
-- given and would itself have no table (p_new_table_ids empty) -- still get
-- its own table, after p_new_table_ids are taken out of the free pool?
--
-- Greedy, largest party first: give each the smallest free table that fits
-- it (max_capacity >= party; min_capacity is ignored here, since an
-- unassigned *staff* booking can be seated at a table too big for it).
-- Infeasible (FALSE) if any party is left without a table.
--
-- Deliberately conservative: a booking's whole [starts_at, ends_at) window
-- counts as demand even though two unassigned parties might not actually
-- overlap *each other* within that window (e.g. one ends right as the other
-- begins). We don't try to time-slice tables between unassigned bookings --
-- only confirmed assignments get an exact slot. This can under-count
-- available capacity on a packed night, never over-count it, which is the
-- safe direction to be wrong in (see docs/RESERVATIONS.md "Allocation engine").
CREATE OR REPLACE FUNCTION public._fits_with_unassigned(
  p_restaurant_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_new_party INTEGER DEFAULT NULL,
  p_new_table_ids UUID[] DEFAULT '{}',
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_free_capacities INTEGER[];
  v_demand_sizes INTEGER[];
  v_party INTEGER;
  v_idx INTEGER;
  v_best_idx INTEGER;
  v_best_cap INTEGER;
BEGIN
  SELECT COALESCE(ARRAY_AGG(ft.max_capacity ORDER BY ft.max_capacity), '{}')
    INTO v_free_capacities
    FROM public._free_tables(p_restaurant_id, p_starts_at, p_ends_at, p_exclude_reservation_id) ft
    WHERE ft.table_id <> ALL(COALESCE(p_new_table_ids, '{}'));

  SELECT COALESCE(ARRAY_AGG(ud.party_size ORDER BY ud.party_size DESC), '{}')
    INTO v_demand_sizes
    FROM public._unassigned_demand(p_restaurant_id, p_starts_at, p_ends_at, p_exclude_reservation_id) ud;

  IF p_new_party IS NOT NULL AND COALESCE(ARRAY_LENGTH(p_new_table_ids, 1), 0) = 0 THEN
    v_demand_sizes := ARRAY(SELECT UNNEST(v_demand_sizes || p_new_party) ORDER BY 1 DESC);
  END IF;

  FOREACH v_party IN ARRAY v_demand_sizes LOOP
    v_best_idx := NULL;
    v_best_cap := NULL;
    FOR v_idx IN 1 .. COALESCE(ARRAY_LENGTH(v_free_capacities, 1), 0) LOOP
      IF v_free_capacities[v_idx] >= v_party AND (v_best_cap IS NULL OR v_free_capacities[v_idx] < v_best_cap) THEN
        v_best_idx := v_idx;
        v_best_cap := v_free_capacities[v_idx];
      END IF;
    END LOOP;

    IF v_best_idx IS NULL THEN
      RETURN FALSE;
    END IF;

    v_free_capacities := v_free_capacities[1 : v_best_idx - 1] || v_free_capacities[v_best_idx + 1 : COALESCE(ARRAY_LENGTH(v_free_capacities, 1), 0)];
  END LOOP;

  RETURN TRUE;
END;
$$;

-- Ranked table options for a party. Single tables only in P1A -- combinations
-- are P3 -- but the return shape (table_ids as an array, total_capacity
-- separate from any one table's max_capacity) is designed so combinations
-- can be added later without changing callers.
-- p_strict_min: TRUE for online booking (must fit the table's own min/max
-- range); FALSE for staff, who can seat a couple at a 4-top.
CREATE OR REPLACE FUNCTION public._rank_table_options(
  p_restaurant_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_party INTEGER,
  p_strict_min BOOLEAN,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS TABLE (rank INTEGER, table_ids UUID[], total_capacity INTEGER, fits_unassigned BOOLEAN)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY f.fits DESC, (ft.max_capacity - p_party), ft.max_capacity, ft.label)::INTEGER AS rank,
    ARRAY[ft.table_id] AS table_ids,
    ft.max_capacity::INTEGER AS total_capacity,
    f.fits AS fits_unassigned
  FROM public._free_tables(p_restaurant_id, p_starts_at, p_ends_at, p_exclude_reservation_id) ft
  CROSS JOIN LATERAL (
    SELECT public._fits_with_unassigned(p_restaurant_id, p_starts_at, p_ends_at, p_party, ARRAY[ft.table_id], p_exclude_reservation_id) AS fits
  ) f
  WHERE ft.max_capacity >= p_party
    AND (NOT p_strict_min OR ft.min_capacity <= p_party)
  ORDER BY f.fits DESC, (ft.max_capacity - p_party), ft.max_capacity, ft.label;
$$;
