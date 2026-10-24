-- create_staff_reservation: auto/manual/none modes, override behaviour,
-- physical overlap never overridable, EazyDiner idempotency, FORBIDDEN.
BEGIN;
SELECT plan(11);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('f0000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-012', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-012', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'f0000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('f0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004', 'T1', 2, 4),
  ('f0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004', 'T2', 2, 4);

INSERT INTO auth.users (id, email) VALUES ('f0000000-0000-0000-0000-00000000000a', 'admin-012@test.com');
INSERT INTO public.admin_profiles (id, email) VALUES ('f0000000-0000-0000-0000-00000000000a', 'admin-012@test.com');

-- Non-admin (no jwt claim set) gets FORBIDDEN.
SELECT throws_ok(
  $$ SELECT public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Nobody', '9000000000', '+91', NULL, 'phone', 'none', '{}', NULL, NULL, FALSE) $$,
  '42501', 'FORBIDDEN', 'a non-admin caller is rejected with FORBIDDEN'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-00000000000a')::text, true);

-- auto mode picks a table.
SELECT is(
  ((public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Auto Guest', '98765 00001', '+91', NULL, 'phone', 'auto', '{}', NULL, NULL, FALSE) -> 'table_ids')::jsonb -> 0) #>> '{}',
  'f0000000-0000-0000-0000-000000000005',
  'auto mode assigns the best-fit table (T1)'
);

-- manual mode assigns the chosen table (T2, since T1 is now taken).
SELECT is(
  (SELECT (public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Manual Guest', '98765 00002', '+91', NULL, 'phone', 'manual', ARRAY['f0000000-0000-0000-0000-000000000006']::uuid[], NULL, NULL, FALSE) ->> 'needs_attention')::boolean),
  FALSE,
  'manual mode assigns the requested table cleanly (no attention needed)'
);

-- none mode: no table assigned, no existing demand yet, so it fits cleanly.
SELECT is(
  (SELECT public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 2, '19:00', 2, 'None Guest', '98765 00003', '+91', NULL, 'phone', 'none', '{}', NULL, NULL, FALSE) -> 'table_ids'),
  '[]'::jsonb,
  'none mode saves the booking with no table'
);

-- manual mode, OVER_CAPACITY: T1/T2 are both taken at 19:00 on day+1; a
-- fresh party of 6 manually assigned to T1 (max 4) alone is over capacity.
SELECT throws_ok(
  $$ SELECT public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 3, '19:00', 6, 'Big Party', '98765 00004', '+91', NULL, 'phone', 'manual', ARRAY['f0000000-0000-0000-0000-000000000005']::uuid[], NULL, NULL, FALSE) $$,
  '22023', 'OVER_CAPACITY', 'a chosen table too small for the party fails with OVER_CAPACITY'
);

-- Same request with override succeeds and is flagged for attention.
SELECT is(
  (SELECT (public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 3, '19:00', 6, 'Big Party', '98765 00004', '+91', NULL, 'phone', 'manual', ARRAY['f0000000-0000-0000-0000-000000000005']::uuid[], NULL, NULL, TRUE) ->> 'needs_attention')::boolean),
  TRUE,
  'the same OVER_CAPACITY request with p_allow_override succeeds and sets needs_attention'
);

SELECT is(
  (SELECT attention_reason FROM public.reservations WHERE guest_name = 'Big Party'),
  'over_capacity',
  'attention_reason is recorded as over_capacity'
);

-- CAPACITY_EXCEEDED: both tables are free at day+4 19:00, but booking with no
-- table for a party larger than any single table leaves no slack -- actually
-- simplest CAPACITY_EXCEEDED case: one unassigned party already present, a
-- second with no table on the same single remaining table slot.
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('f0000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 'First Unassigned', CURRENT_DATE + 4, '19:00', 2, 'confirmed', 'phone',
  ((CURRENT_DATE + 4) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 4) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('f0000000-0000-0000-0000-0000000000c2', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 'Second Unassigned', CURRENT_DATE + 4, '19:00', 2, 'confirmed', 'phone',
  ((CURRENT_DATE + 4) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 4) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

SELECT throws_ok(
  $$ SELECT public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 4, '19:00', 2, 'Third Unassigned', '98765 00005', '+91', NULL, 'phone', 'none', '{}', NULL, NULL, FALSE) $$,
  '22023', 'CAPACITY_EXCEEDED', 'a third unassigned party for only two free tables fails with CAPACITY_EXCEEDED'
);

-- Physical overlap is never overridable, even with p_allow_override = TRUE.
SELECT throws_ok(
  $$ SELECT public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Overlap Guest', '98765 00006', '+91', NULL, 'phone', 'manual', ARRAY['f0000000-0000-0000-0000-000000000005']::uuid[], NULL, NULL, TRUE) $$,
  'P0001', 'TABLE_ALREADY_RESERVED', 'a physical overlap fails with TABLE_ALREADY_RESERVED even with override'
);

-- EazyDiner: requires a reference, and a duplicate returns the same reservation id.
SELECT throws_ok(
  $$ SELECT public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 5, '19:00', 2, 'Eazy Guest', '', '+91', NULL, 'eazydiner', 'none', '{}', NULL, NULL, FALSE) $$,
  '22023', 'EXTERNAL_REFERENCE_REQUIRED', 'eazydiner without a reference fails with EXTERNAL_REFERENCE_REQUIRED'
);

SELECT results_eq(
  $$ SELECT (public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 5, '19:00', 2, 'Eazy Guest', '', '+91', NULL, 'eazydiner', 'none', '{}', NULL, 'EZD-012', TRUE) ->> 'reservation_id')
     = (public.create_staff_reservation('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', CURRENT_DATE + 5, '19:00', 2, 'Eazy Guest Again', '', '+91', NULL, 'eazydiner', 'none', '{}', NULL, 'EZD-012', TRUE) ->> 'reservation_id') $$,
  $$ SELECT TRUE $$,
  'a duplicate (source, external_reference) returns the same reservation id'
);

SELECT * FROM finish();
ROLLBACK;
