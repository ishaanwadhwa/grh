-- Guest upsert/dedupe, phone-less walk-ins, and visit/no-show counters
-- (016_guests.sql).
BEGIN;
SELECT plan(5);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('30000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-003', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-003', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT '30000000-0000-0000-0000-000000000003', d, '10:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 'T1', 1, 4),
  ('30000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 'T2', 1, 4);

INSERT INTO auth.users (id, email) VALUES ('30000000-0000-0000-0000-00000000000a', 'admin-003@test.com');
INSERT INTO public.admin_profiles (id, email) VALUES ('30000000-0000-0000-0000-00000000000a', 'admin-003@test.com');

-- Two bookings, same phone in different formats (spacing/dashes), non-overlapping times.
SELECT public.create_restaurant_reservation('test-resto-003', '30000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '11:00', 2, 'Asha', 'asha@example.com', '98765 43210', '+91');
SELECT public.create_restaurant_reservation('test-resto-003', '30000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '14:00', 2, 'Asha Rao', 'asha@example.com', '(98765) 43210', '+91');

SELECT is(
  (SELECT COUNT(*)::int FROM public.guests WHERE phone_e164 = '+919876543210'),
  1,
  'two bookings with the same phone in different formats dedupe to one guest'
);

SELECT is(
  (SELECT COUNT(DISTINCT guest_id)::int FROM public.reservations WHERE guest_email = 'asha@example.com'),
  1,
  'both reservations are linked to the same guest_id'
);

-- A third booking, different phone, to exercise the no_show counter in isolation.
SELECT public.create_restaurant_reservation('test-resto-003', '30000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '18:00', 2, 'Bala', 'bala@example.com', '99887 66554', '+91');

-- Walk-in with no phone at all: guest_id must stay NULL.
SELECT set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-00000000000a')::text, true);
-- "Today" per the restaurant's own timezone, not the session's -- avoids a
-- false WALKIN_TIME_INVALID when the test runs close to midnight IST while
-- the server session is still on the previous UTC calendar day.
SELECT public.create_walkin_reservation(
  '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003',
  (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE, '15:00', 2, ARRAY['30000000-0000-0000-0000-000000000006']::uuid[],
  'Walk-in Party', '', '+91'
);

SELECT is(
  (SELECT guest_id FROM public.reservations WHERE source = 'walk_in' AND guest_name = 'Walk-in Party'),
  NULL::uuid,
  'a walk-in with no phone number keeps guest_id NULL'
);

UPDATE public.reservations SET status = 'completed' WHERE guest_email = 'asha@example.com' AND time = '11:00';
UPDATE public.reservations SET status = 'no_show' WHERE guest_email = 'bala@example.com';

SELECT is(
  (SELECT visit_count FROM public.guests WHERE phone_e164 = '+919876543210'),
  1,
  'moving a reservation to completed bumps its guest''s visit_count'
);

SELECT is(
  (SELECT no_show_count FROM public.guests WHERE phone_e164 = '+919988766554'),
  1,
  'moving a reservation to no_show bumps its guest''s no_show_count'
);

SELECT * FROM finish();
ROLLBACK;
