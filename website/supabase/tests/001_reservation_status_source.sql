-- Status/source CHECK constraints (014_reservation_status_source_constraints.sql).
BEGIN;
SELECT plan(5);

-- restaurant_id/guest_email are nullable, so no fixture restaurant is needed.

SELECT throws_ok(
  $$ INSERT INTO public.reservations (guest_name, date, time, status) VALUES ('Test Guest', CURRENT_DATE, '19:00', 'bogus') $$,
  '23514',
  NULL,
  'an unknown status value is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO public.reservations (guest_name, date, time, source) VALUES ('Test Guest', CURRENT_DATE, '19:00', 'bogus') $$,
  '23514',
  NULL,
  'an unknown source value is rejected'
);

SELECT lives_ok(
  $$ INSERT INTO public.reservations (guest_name, date, time, status, source) VALUES ('Test Guest', CURRENT_DATE, '19:00', 'no_show', 'eazydiner') $$,
  'every allowed status/source combination can be inserted (no_show/eazydiner)'
);

SELECT lives_ok(
  $$ INSERT INTO public.reservations (guest_name, date, time, status, source) VALUES ('Test Guest', CURRENT_DATE, '19:00', 'arrived', 'phone') $$,
  'every allowed status/source combination can be inserted (arrived/phone)'
);

SELECT throws_ok(
  $$ UPDATE public.reservations SET status = 'walkin' WHERE guest_name = 'Test Guest' $$,
  '23514',
  NULL,
  'the legacy walkin (not walk_in) value is rejected on update too'
);

SELECT * FROM finish();
ROLLBACK;
