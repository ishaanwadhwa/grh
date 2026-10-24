-- Lock down reservations.status and reservations.source to the values the
-- application actually understands. Normalise the one known legacy mismatch
-- (walkin -> walk_in, see docs/RESERVATIONS-PLAN.md P0 task 4) before adding
-- the CHECK constraints so this migration applies cleanly against existing data.

UPDATE public.reservations
SET source = 'walk_in'
WHERE source = 'walkin';

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'confirmed', 'arrived', 'seated', 'completed', 'cancelled', 'no_show'));

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_source_check
  CHECK (source IN ('website', 'phone', 'walk_in', 'eazydiner', 'other'));
