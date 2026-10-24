-- Append-only change history for reservations (docs/RESERVATIONS-PLAN.md P0 task 4).
-- Rows are only ever written by SECURITY DEFINER triggers below; nobody can
-- insert/update/delete directly, even admins.

CREATE TABLE public.reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed', 'tables_assigned', 'updated')),
  from_status TEXT NULL,
  to_status TEXT NULL,
  actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_source TEXT NOT NULL DEFAULT 'system' CHECK (actor_source IN ('staff', 'guest', 'system', 'import')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reservation_events_reservation_id_idx ON public.reservation_events (reservation_id, created_at);

-- A brand-new reservation always gets a 'created' event. At P0 the only two
-- creation paths are the public website RPC (no authenticated caller ->
-- 'guest') and the admin walk-in RPC (authenticated admin -> 'staff').
-- Later import/staff-create paths (P1+) will pass through the same trigger.
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
    jsonb_build_object('source', NEW.source)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_log_created_event
  AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_created_event();

-- Any later change: a status transition gets 'status_changed' with
-- from/to; any other column change gets a plain 'updated' event. A single
-- statement that changes both only logs 'status_changed', to avoid a
-- redundant duplicate event for the same UPDATE.
CREATE OR REPLACE FUNCTION public.log_reservation_update_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_source TEXT;
BEGIN
  v_actor_source := CASE WHEN auth.uid() IS NOT NULL THEN 'staff' ELSE 'system' END;

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

CREATE TRIGGER reservations_log_update_event
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_update_event();

-- Every table assignment (initial booking, admin reassignment, walk-in seating).
CREATE OR REPLACE FUNCTION public.log_reservation_tables_assigned_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
BEGIN
  v_actor_id := COALESCE(NEW.assigned_by, auth.uid());
  INSERT INTO public.reservation_events (reservation_id, event_type, actor_id, actor_source, payload)
  VALUES (
    NEW.reservation_id,
    'tables_assigned',
    v_actor_id,
    CASE WHEN v_actor_id IS NOT NULL THEN 'staff' ELSE 'guest' END,
    jsonb_build_object('table_id', NEW.table_id, 'starts_at', NEW.starts_at, 'ends_at', NEW.ends_at)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservation_table_assignments_log_event
  AFTER INSERT ON public.reservation_table_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_tables_assigned_event();

ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reservation events" ON public.reservation_events
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()));
