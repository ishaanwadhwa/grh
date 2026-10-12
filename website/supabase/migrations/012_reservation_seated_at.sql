-- Track the actual moment a waiter seats a party so the floor screen can show elapsed time.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS seated_at TIMESTAMPTZ;

UPDATE public.reservations
SET seated_at = created_at
WHERE status = 'seated' AND seated_at IS NULL;

CREATE OR REPLACE FUNCTION public.track_reservation_seated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'seated' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.seated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_set_seated_at
BEFORE UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.track_reservation_seated_at();
