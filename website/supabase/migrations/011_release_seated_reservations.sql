-- Waiter service flow releases table assignments after a guest is completed or marked no-show.
CREATE OR REPLACE FUNCTION public.release_cancelled_reservation_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'completed', 'no_show')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.reservation_table_assignments
      SET released_at = NOW()
      WHERE reservation_id = NEW.id AND released_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
