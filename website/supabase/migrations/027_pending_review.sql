-- Staff review of pending (large-party / auto_confirm=FALSE) requests
-- (docs/agent-briefs/P1B-public-hardening.md task 4).

CREATE OR REPLACE FUNCTION public.review_pending_reservation(
  p_reservation_id UUID,
  p_approve BOOLEAN,
  p_table_ids UUID[] DEFAULT '{}',
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
    FROM public.reservations WHERE id = p_reservation_id;
  IF v_reservation.restaurant_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVATION_NOT_FOUND', ERRCODE = 'P0002';
  END IF;
  IF v_reservation.status <> 'pending' THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVATION_NOT_PENDING', ERRCODE = '22023';
  END IF;

  PERFORM public._lock_restaurant_allocation(v_reservation.restaurant_id);

  IF NOT p_approve THEN
    UPDATE public.reservations SET status = 'cancelled' WHERE id = p_reservation_id;
    RETURN JSONB_BUILD_OBJECT('reservation_id', p_reservation_id, 'status', 'cancelled');
  END IF;

  -- Approve: same validation/override rules as set_reservation_tables
  -- (024) -- empty array leaves it unassigned.
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

  IF COALESCE(ARRAY_LENGTH(p_table_ids, 1), 0) > 0 THEN
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, assigned_by)
      VALUES (p_reservation_id, v_table_id, v_reservation.starts_at, v_reservation.ends_at, auth.uid());
    END LOOP;
  END IF;

  UPDATE public.reservations
    SET status = 'confirmed', needs_attention = v_needs_attention, attention_reason = v_attention_reason
    WHERE id = p_reservation_id;

  RETURN JSONB_BUILD_OBJECT(
    'reservation_id', p_reservation_id,
    'status', 'confirmed',
    'table_ids', TO_JSONB(p_table_ids),
    'needs_attention', v_needs_attention
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_pending_reservation(UUID, BOOLEAN, UUID[], BOOLEAN) TO authenticated;
