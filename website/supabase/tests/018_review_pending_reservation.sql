-- review_pending_reservation: approve (with/without table), decline,
-- pending-only guard, privileges (027_pending_review.sql).
BEGIN;
SELECT plan(9);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('f1000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-018', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-018', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('f1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'f1000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('f1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES ('f1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004', 'T1', 1, 10);

INSERT INTO auth.users (id, email) VALUES ('f1000000-0000-0000-0000-00000000000a', 'admin-018@test.com');
INSERT INTO public.admin_profiles (id, email) VALUES ('f1000000-0000-0000-0000-00000000000a', 'admin-018@test.com');

-- Two pending reservations (non-overlapping times so they don't interfere).
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES
  ('f1000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', 'Decline Me', CURRENT_DATE + 1, '19:00', 8, 'pending', 'website',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata'),
  ('f1000000-0000-0000-0000-0000000000a2', 'f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', 'Approve With Table', CURRENT_DATE + 1, '20:00', 8, 'pending', 'website',
    ((CURRENT_DATE + 1) + TIME '20:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '21:45') AT TIME ZONE 'Asia/Kolkata'),
  ('f1000000-0000-0000-0000-0000000000a3', 'f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', 'Approve No Table', CURRENT_DATE + 1, '09:00', 2, 'pending', 'website',
    ((CURRENT_DATE + 1) + TIME '09:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '10:45') AT TIME ZONE 'Asia/Kolkata');

-- Non-admin is forbidden.
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.review_pending_reservation('f1000000-0000-0000-0000-0000000000a1', FALSE) $$,
  '42501', 'FORBIDDEN', 'a non-admin authenticated caller is rejected with FORBIDDEN'
);
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'f1000000-0000-0000-0000-00000000000a')::text, true);

-- Decline.
SELECT public.review_pending_reservation('f1000000-0000-0000-0000-0000000000a1', FALSE);
SELECT is(
  (SELECT status FROM public.reservations WHERE id = 'f1000000-0000-0000-0000-0000000000a1'),
  'cancelled',
  'declining sets status to cancelled'
);

-- Approve with a table.
SELECT public.review_pending_reservation('f1000000-0000-0000-0000-0000000000a2', TRUE, ARRAY['f1000000-0000-0000-0000-000000000005']::uuid[], FALSE);
SELECT is(
  (SELECT status FROM public.reservations WHERE id = 'f1000000-0000-0000-0000-0000000000a2'),
  'confirmed',
  'approving with a table confirms the reservation'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_table_assignments WHERE reservation_id = 'f1000000-0000-0000-0000-0000000000a2' AND released_at IS NULL),
  1,
  'the chosen table is assigned'
);

-- Approve without a table.
SELECT public.review_pending_reservation('f1000000-0000-0000-0000-0000000000a3', TRUE, '{}', FALSE);
SELECT is(
  (SELECT status FROM public.reservations WHERE id = 'f1000000-0000-0000-0000-0000000000a3'),
  'confirmed',
  'approving with no table also confirms the reservation'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_table_assignments WHERE reservation_id = 'f1000000-0000-0000-0000-0000000000a3' AND released_at IS NULL),
  0,
  'no table is assigned when approving with an empty array'
);

-- Only pending reservations can be reviewed.
SELECT throws_ok(
  $$ SELECT public.review_pending_reservation('f1000000-0000-0000-0000-0000000000a1', TRUE) $$,
  '22023', 'RESERVATION_NOT_PENDING', 'reviewing an already-cancelled reservation fails with RESERVATION_NOT_PENDING'
);

-- Privileges.
SELECT ok(
  NOT has_function_privilege('anon', 'public.review_pending_reservation(uuid,boolean,uuid[],boolean)', 'EXECUTE'),
  'anon cannot execute review_pending_reservation'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.review_pending_reservation(uuid,boolean,uuid[],boolean)', 'EXECUTE'),
  'authenticated can execute review_pending_reservation'
);

SELECT * FROM finish();
ROLLBACK;
