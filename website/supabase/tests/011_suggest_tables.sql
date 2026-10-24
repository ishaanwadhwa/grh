-- suggest_tables: best fit first, off-interval times OK, OUTSIDE_SERVICE_HOURS
-- warning, and p_exclude_reservation_id excludes the reservation's own
-- current table from counting as unassigned demand against itself.
BEGIN;
SELECT plan(6);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('e0000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-011', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-011', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size, slot_interval_minutes)
VALUES ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'Dinner', 1, 12, 30);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'e0000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'T-small', 1, 2),
  ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'T-big', 1, 6);

INSERT INTO auth.users (id, email) VALUES ('e0000000-0000-0000-0000-00000000000a', 'admin-011@test.com');
INSERT INTO public.admin_profiles (id, email) VALUES ('e0000000-0000-0000-0000-00000000000a', 'admin-011@test.com');
SELECT set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-00000000000a')::text, true);

-- Off-interval time (20:17, not a multiple of the 30-minute slot interval).
SELECT lives_ok(
  $$ SELECT public.suggest_tables('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:17', 2) $$,
  'an off-interval staff time does not raise an error'
);

SELECT is(
  (public.suggest_tables('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:17', 2) -> 'options' -> 0 ->> 'table_ids')::jsonb,
  JSONB_BUILD_ARRAY('e0000000-0000-0000-0000-000000000005'),
  'the best (tightest) fit for a party of 2 is the small table, ranked first'
);

SELECT ok(
  (public.suggest_tables('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '09:00', 2) -> 'warnings' ? 'OUTSIDE_SERVICE_HOURS'),
  'a time before opening hours gets the OUTSIDE_SERVICE_HOURS warning, not an error'
);

SELECT ok(
  NOT (public.suggest_tables('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '09:00', 2) -> 'options') = '[]'::jsonb,
  'options are still returned even when outside hours (a warning, not a hard failure)'
);

-- Give the small table to another booking so the only option left is the big table.
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('e0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'Holder', CURRENT_DATE + 1, '20:17', 2, 'confirmed', 'phone',
  ((CURRENT_DATE + 1) + TIME '20:17') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '21:52') AT TIME ZONE 'Asia/Kolkata');
INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
VALUES ('e0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000005',
  ((CURRENT_DATE + 1) + TIME '20:17') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '21:52') AT TIME ZONE 'Asia/Kolkata');

SELECT is(
  (public.suggest_tables('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:17', 2) -> 'options' -> 0 ->> 'table_ids')::jsonb,
  JSONB_BUILD_ARRAY('e0000000-0000-0000-0000-000000000006'),
  'once the small table is taken, the big table is suggested instead'
);

-- p_exclude_reservation_id: suggesting for the "Holder" reservation itself
-- (as if re-suggesting after opening it) must not see its own assignment as
-- a conflict, so the small table should be offered again as the best fit.
SELECT is(
  (public.suggest_tables('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:17', 2, 'e0000000-0000-0000-0000-0000000000b1') -> 'options' -> 0 ->> 'table_ids')::jsonb,
  JSONB_BUILD_ARRAY('e0000000-0000-0000-0000-000000000005'),
  'p_exclude_reservation_id ignores the reservation''s own current table, offering it again'
);

SELECT * FROM finish();
ROLLBACK;
