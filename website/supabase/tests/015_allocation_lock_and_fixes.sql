-- Allocation lock exists and is called everywhere it should be; a completed
-- reservation can't be reassigned; outside_hours survives a reassignment
-- (024_allocation_lock_and_fixes.sql, fixes carried from the P1A review).
BEGIN;
SELECT plan(8);

SELECT ok(
  pg_get_functiondef('public._lock_restaurant_allocation(uuid)'::regprocedure) LIKE '%pg_advisory_xact_lock%',
  '_lock_restaurant_allocation takes a pg_advisory_xact_lock'
);

SELECT ok(
  pg_get_functiondef('public.create_staff_reservation(uuid,uuid,date,time,integer,text,text,text,text,text,text,uuid[],text,text,boolean)'::regprocedure) LIKE '%_lock_restaurant_allocation%',
  'create_staff_reservation calls the allocation lock'
);
SELECT ok(
  pg_get_functiondef('public.set_reservation_tables(uuid,uuid[],boolean)'::regprocedure) LIKE '%_lock_restaurant_allocation%',
  'set_reservation_tables calls the allocation lock'
);
SELECT ok(
  pg_get_functiondef('public.create_walkin_reservation(uuid,uuid,date,time,integer,uuid[],text,text,text,text)'::regprocedure) LIKE '%_lock_restaurant_allocation%',
  'create_walkin_reservation calls the allocation lock'
);
SELECT ok(
  pg_get_functiondef('public.assign_reservation_tables(uuid,uuid[])'::regprocedure) LIKE '%_lock_restaurant_allocation%',
  'assign_reservation_tables calls the allocation lock'
);

-- Fixtures for the behavioural fixes.
INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('b1000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-015', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-015', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('b1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'b1000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('b1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES ('b1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'T1', 2, 4);
INSERT INTO auth.users (id, email) VALUES ('b1000000-0000-0000-0000-00000000000a', 'admin-015@test.com');
INSERT INTO public.admin_profiles (id, email) VALUES ('b1000000-0000-0000-0000-00000000000a', 'admin-015@test.com');
SELECT set_config('request.jwt.claims', json_build_object('sub', 'b1000000-0000-0000-0000-00000000000a')::text, true);

-- Outside service hours (09:00, hours are 18:00-23:00), saved with override.
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at, needs_attention, attention_reason)
VALUES ('b1000000-0000-0000-0000-0000000000b1', 'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'Outside Hours Guest', CURRENT_DATE + 1, '09:00', 2, 'confirmed', 'phone',
  ((CURRENT_DATE + 1) + TIME '09:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '10:45') AT TIME ZONE 'Asia/Kolkata', TRUE, 'outside_hours');

SELECT public.set_reservation_tables('b1000000-0000-0000-0000-0000000000b1', ARRAY['b1000000-0000-0000-0000-000000000005']::uuid[], TRUE);

SELECT is(
  (SELECT needs_attention FROM public.reservations WHERE id = 'b1000000-0000-0000-0000-0000000000b1'),
  TRUE,
  'needs_attention survives a reassignment when still outside hours'
);
SELECT is(
  (SELECT attention_reason FROM public.reservations WHERE id = 'b1000000-0000-0000-0000-0000000000b1'),
  'outside_hours',
  'attention_reason stays outside_hours instead of being cleared'
);

-- A completed reservation can't be reassigned.
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('b1000000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'Completed Guest', CURRENT_DATE + 1, '19:00', 2, 'completed', 'phone',
  ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

SELECT throws_ok(
  $$ SELECT public.set_reservation_tables('b1000000-0000-0000-0000-0000000000c1', '{}', FALSE) $$,
  '22023', 'RESERVATION_NOT_ACTIVE', 'a completed reservation cannot be reassigned'
);

SELECT * FROM finish();
ROLLBACK;
