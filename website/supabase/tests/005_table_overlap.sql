-- Two overlapping bookings can never hold the same table at the same time.
-- Covered at two levels: the gist exclusion constraint that protects against
-- a true concurrent race (004_restaurant_booking_and_floorplans.sql), and the
-- booking RPC falling back to SLOT_UNAVAILABLE once a table is taken.
BEGIN;
SELECT plan(2);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('50000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-005', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-005', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('50000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 'Dinner', 1, 2);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT '50000000-0000-0000-0000-000000000003', d, '10:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
-- Exactly one table that fits a 2-top, so the second booking for the same
-- slot has nowhere else to go.
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES ('50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004', 'T1', 1, 2);

-- Level 1: the exclusion constraint itself rejects a second overlapping
-- assignment on the same table, independent of any application logic --
-- this is what keeps a true concurrent race safe.
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source)
VALUES ('50000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000002', 'Fixture A', CURRENT_DATE + 1, '19:00', 2, 'confirmed', 'other');
INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
VALUES ('50000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000005', (CURRENT_DATE + 1 + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', (CURRENT_DATE + 1 + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source)
VALUES ('50000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-000000000002', 'Fixture B', CURRENT_DATE + 1, '19:30', 2, 'confirmed', 'other');

SELECT throws_ok(
  $$ INSERT INTO public.reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
     VALUES ('50000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-000000000005',
             (CURRENT_DATE + 1 + TIME '19:30') AT TIME ZONE 'Asia/Kolkata',
             (CURRENT_DATE + 1 + TIME '21:15') AT TIME ZONE 'Asia/Kolkata') $$,
  '23P01',
  NULL,
  'the exclusion constraint rejects a second overlapping assignment on the same table'
);

-- Level 2: calling the public RPC for the same slot after it is taken
-- surfaces SLOT_UNAVAILABLE instead of double-booking.
SELECT public.create_restaurant_reservation('test-resto-005', '50000000-0000-0000-0000-000000000003', CURRENT_DATE + 2, '19:00', 2, 'First Guest', 'first@example.com', '91234 00001', '+91');

SELECT throws_ok(
  $$ SELECT public.create_restaurant_reservation('test-resto-005', '50000000-0000-0000-0000-000000000003', CURRENT_DATE + 2, '19:00', 2, 'Second Guest', 'second@example.com', '91234 00002', '+91') $$,
  'P0001',
  'SLOT_UNAVAILABLE',
  'a second booking for the same (full) slot is rejected once the only table is taken'
);

SELECT * FROM finish();
ROLLBACK;
