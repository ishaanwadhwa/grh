-- create_public_reservation / get_available_restaurant_slots v2: every
-- booking policy rule (026_public_booking_v2.sql).
BEGIN;
SELECT plan(21);

-- --- Fixture A: covers-per-slot + contact requirements ---
INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('d1000000-0000-0000-0000-000000000001', 'Test Property A', 'test-property-017a', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('d1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'Test Resto A', 'test-resto-017a', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size, max_covers_per_slot)
VALUES ('d1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'Dinner', 1, 12, 4);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'd1000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('d1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('d1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 'T1', 1, 6),
  ('d1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 'T2', 1, 6),
  ('d1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 'T3', 1, 6);

-- Baseline booking succeeds, confirmed, with manage_token_hash stored.
SELECT lives_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Normal Guest', 'normal@example.com', 'hashaaa1', '98765 00001', '+91', FALSE, NULL) $$,
  'a normal booking within every policy limit succeeds'
);
SELECT is(
  (SELECT status FROM public.reservations WHERE guest_name = 'Normal Guest'),
  'confirmed',
  'it is saved confirmed, with a table'
);
SELECT is(
  (SELECT manage_token_hash FROM public.reservations WHERE guest_name = 'Normal Guest'),
  'hashaaa1',
  'the manage token hash is stored as given'
);

-- Covers-per-slot: fill the slot to the cap (4), then one more fails.
SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'At Cap Guest', 'atcap@example.com', 'hashaaa2', '98765 00002', '+91', FALSE, NULL);
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 1, 'Over Cap Guest', 'overcap@example.com', 'hashaaa3', '98765 00003', '+91', FALSE, NULL) $$,
  'P0001', 'SLOT_UNAVAILABLE', 'a booking that would push covers for the slot past max_covers_per_slot is rejected'
);

-- Contact requirements.
UPDATE public.restaurant_booking_policies SET require_phone = TRUE WHERE restaurant_id = 'd1000000-0000-0000-0000-000000000002';
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:00', 2, 'No Phone', 'nophone@example.com', 'hashaaa4', '', '+91', FALSE, NULL) $$,
  '22023', 'CONTACT_REQUIRED', 'require_phone rejects a booking with no phone'
);
UPDATE public.restaurant_booking_policies SET require_phone = FALSE, require_email = TRUE WHERE restaurant_id = 'd1000000-0000-0000-0000-000000000002';
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:00', 2, 'No Email', NULL, 'hashaaa5', '98765 00005', '+91', FALSE, NULL) $$,
  '22023', 'CONTACT_REQUIRED', 'require_email rejects a booking with no email'
);
UPDATE public.restaurant_booking_policies SET require_email = FALSE WHERE restaurant_id = 'd1000000-0000-0000-0000-000000000002';
SELECT lives_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:00', 2, 'No Email OK', NULL, 'hashaaa6', '98765 00006', '+91', FALSE, NULL) $$,
  'once require_email is off, a booking with no email succeeds'
);

-- max_advance_days.
UPDATE public.restaurant_booking_policies SET max_advance_days = 10 WHERE restaurant_id = 'd1000000-0000-0000-0000-000000000002';
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 20, '20:00', 2, 'Too Far Out', 'far@example.com', 'hashaaa7', '98765 00007', '+91', FALSE, NULL) $$,
  '22023', 'OUTSIDE_BOOKING_WINDOW', 'max_advance_days rejects a date too far in the future'
);

-- min_lead_minutes.
UPDATE public.restaurant_booking_policies SET max_advance_days = NULL, min_lead_minutes = 1440 WHERE restaurant_id = 'd1000000-0000-0000-0000-000000000002';
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017a', 'd1000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '18:00', 2, 'Too Soon', 'soon@example.com', 'hashaaa8', '98765 00008', '+91', FALSE, NULL) $$,
  '22023', 'OUTSIDE_BOOKING_WINDOW', 'min_lead_minutes rejects a slot that starts too soon'
);

-- --- Fixture B: last_seating_offset_minutes, large_party_threshold, auto_confirm ---
INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('d2000000-0000-0000-0000-000000000001', 'Test Property B', 'test-property-017b', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('d2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', 'Test Resto B', 'test-resto-017b', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('d2000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'd2000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('d2000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES ('d2000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000004', 'T1', 1, 10);

-- last_seating_offset_minutes=180: close 23:00, cutoff 20:00. 20:30 would
-- pass the plain duration check (seating+buffer=105 -> fits until 21:00) but
-- must fail the new offset rule.
UPDATE public.restaurant_booking_policies SET last_seating_offset_minutes = 180 WHERE restaurant_id = 'd2000000-0000-0000-0000-000000000002';
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017b', 'd2000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:30', 2, 'Too Late Offset', 'late@example.com', 'hashbbb1', '98765 10001', '+91', FALSE, NULL) $$,
  'P0001', 'SLOT_UNAVAILABLE', 'last_seating_offset_minutes rejects a slot the plain duration check alone would allow'
);
SELECT lives_ok(
  $$ SELECT public.create_public_reservation('test-resto-017b', 'd2000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '20:00', 2, 'Just In Time', 'ontime@example.com', 'hashbbb2', '98765 10002', '+91', FALSE, NULL) $$,
  'a slot exactly at the last-seating cutoff succeeds'
);

-- large_party_threshold: pending, no table, but still has to fit as
-- unassigned demand (_fits_with_unassigned).
UPDATE public.restaurant_booking_policies SET last_seating_offset_minutes = NULL, large_party_threshold = 8 WHERE restaurant_id = 'd2000000-0000-0000-0000-000000000002';
SELECT public.create_public_reservation('test-resto-017b', 'd2000000-0000-0000-0000-000000000003', CURRENT_DATE + 2, '19:00', 8, 'Big Party', 'big@example.com', 'hashbbb3', '98765 10003', '+91', FALSE, NULL);
SELECT is(
  (SELECT status FROM public.reservations WHERE guest_name = 'Big Party'),
  'pending',
  'a party at/above large_party_threshold is saved pending'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_table_assignments a JOIN public.reservations r ON r.id = a.reservation_id WHERE r.guest_name = 'Big Party' AND a.released_at IS NULL),
  0,
  'the pending large-party booking has no table assigned'
);
-- It still counts as unassigned demand: a single-table restaurant with a
-- pending party of 8 blocks a confirmed booking that would need the same table.
UPDATE public.restaurant_booking_policies SET large_party_threshold = NULL WHERE restaurant_id = 'd2000000-0000-0000-0000-000000000002';
SELECT throws_ok(
  $$ SELECT public.create_public_reservation('test-resto-017b', 'd2000000-0000-0000-0000-000000000003', CURRENT_DATE + 2, '19:00', 2, 'Should Not Fit', 'blocked@example.com', 'hashbbb4', '98765 10004', '+91', FALSE, NULL) $$,
  'P0001', 'SLOT_UNAVAILABLE', 'the pending large party still counts as unassigned demand against the only table'
);

-- auto_confirm = FALSE: every booking is pending.
UPDATE public.restaurant_booking_policies SET auto_confirm = FALSE WHERE restaurant_id = 'd2000000-0000-0000-0000-000000000002';
SELECT public.create_public_reservation('test-resto-017b', 'd2000000-0000-0000-0000-000000000003', CURRENT_DATE + 3, '19:00', 2, 'Needs Approval', 'approval@example.com', 'hashbbb5', '98765 10005', '+91', FALSE, NULL);
SELECT is(
  (SELECT status FROM public.reservations WHERE guest_name = 'Needs Approval'),
  'pending',
  'auto_confirm = FALSE makes every booking pending'
);

-- get_available_restaurant_slots v2: requires_approval reflects auto_confirm/large_party_threshold.
SELECT is(
  (SELECT BOOL_OR(requires_approval) FROM public.get_available_restaurant_slots('test-resto-017b', CURRENT_DATE + 4, 2)),
  TRUE,
  'requires_approval is true for every slot once auto_confirm = FALSE'
);
UPDATE public.restaurant_booking_policies SET auto_confirm = TRUE, large_party_threshold = 8 WHERE restaurant_id = 'd2000000-0000-0000-0000-000000000002';
SELECT is(
  (SELECT BOOL_OR(requires_approval) FROM public.get_available_restaurant_slots('test-resto-017b', CURRENT_DATE + 4, 8)),
  TRUE,
  'requires_approval is true for a party at the large_party_threshold'
);
SELECT is(
  (SELECT BOOL_OR(requires_approval) FROM public.get_available_restaurant_slots('test-resto-017b', CURRENT_DATE + 4, 2)),
  FALSE,
  'requires_approval is false for a normal party under the threshold'
);

-- Privileges: create_public_reservation is service_role only, same as the
-- rest of the public path (025).
SELECT ok(
  NOT has_function_privilege('anon', 'public.create_public_reservation(text,uuid,date,time,integer,text,text,text,text,text,boolean,text)', 'EXECUTE'),
  'anon cannot execute create_public_reservation'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.create_public_reservation(text,uuid,date,time,integer,text,text,text,text,text,boolean,text)', 'EXECUTE'),
  'authenticated cannot execute create_public_reservation'
);
SELECT ok(
  has_function_privilege('service_role', 'public.create_public_reservation(text,uuid,date,time,integer,text,text,text,text,text,boolean,text)', 'EXECUTE'),
  'service_role can execute create_public_reservation'
);

SELECT * FROM finish();
ROLLBACK;
