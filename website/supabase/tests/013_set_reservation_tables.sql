-- set_reservation_tables: assign, reassign, unassign, and the events each writes.
BEGIN;
SELECT plan(7);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('a1000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-013', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-013', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'a1000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 'T1', 2, 4),
  ('a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 'T2', 2, 4);

INSERT INTO auth.users (id, email) VALUES ('a1000000-0000-0000-0000-00000000000a', 'admin-013@test.com');
INSERT INTO public.admin_profiles (id, email) VALUES ('a1000000-0000-0000-0000-00000000000a', 'admin-013@test.com');

-- Unassigned booking.
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('a1000000-0000-0000-0000-0000000000b1', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'Test Guest', CURRENT_DATE + 1, '19:00', 2, 'confirmed', 'phone',
  ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

-- Authenticated but not an admin (no matching admin_profiles row) is forbidden.
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.set_reservation_tables('a1000000-0000-0000-0000-0000000000b1', ARRAY['a1000000-0000-0000-0000-000000000005']::uuid[], FALSE) $$,
  '42501', 'FORBIDDEN', 'a non-admin authenticated caller is rejected with FORBIDDEN'
);
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-00000000000a')::text, true);

-- Assign.
SELECT public.set_reservation_tables('a1000000-0000-0000-0000-0000000000b1', ARRAY['a1000000-0000-0000-0000-000000000005']::uuid[], FALSE);
SELECT is(
  (SELECT ARRAY_AGG(table_id) FROM public.reservation_table_assignments WHERE reservation_id = 'a1000000-0000-0000-0000-0000000000b1' AND released_at IS NULL),
  ARRAY['a1000000-0000-0000-0000-000000000005']::uuid[],
  'assign creates an active table assignment'
);

-- Reassign to the other table.
SELECT public.set_reservation_tables('a1000000-0000-0000-0000-0000000000b1', ARRAY['a1000000-0000-0000-0000-000000000006']::uuid[], FALSE);
SELECT is(
  (SELECT ARRAY_AGG(table_id) FROM public.reservation_table_assignments WHERE reservation_id = 'a1000000-0000-0000-0000-0000000000b1' AND released_at IS NULL),
  ARRAY['a1000000-0000-0000-0000-000000000006']::uuid[],
  'reassign releases the old table and assigns the new one'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_table_assignments WHERE reservation_id = 'a1000000-0000-0000-0000-0000000000b1' AND table_id = 'a1000000-0000-0000-0000-000000000005' AND released_at IS NOT NULL),
  1,
  'the previous assignment is released (not deleted)'
);

-- Unassign.
SELECT public.set_reservation_tables('a1000000-0000-0000-0000-0000000000b1', '{}', FALSE);
SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_table_assignments WHERE reservation_id = 'a1000000-0000-0000-0000-0000000000b1' AND released_at IS NULL),
  0,
  'unassign releases the active assignment and creates no new one'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_events WHERE reservation_id = 'a1000000-0000-0000-0000-0000000000b1' AND event_type = 'tables_released'),
  1,
  'unassigning logs a tables_released event'
);

SELECT ok(
  (SELECT COUNT(*)::int FROM public.reservation_events WHERE reservation_id = 'a1000000-0000-0000-0000-0000000000b1' AND event_type = 'tables_assigned') >= 2,
  'both the assign and the reassign logged tables_assigned events'
);

SELECT * FROM finish();
ROLLBACK;
