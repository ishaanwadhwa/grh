-- Public RPCs must respect unassigned demand (022_public_rpcs_use_engine.sql):
-- a table promised to an unassigned phone booking can't be resold online.
BEGIN;
SELECT plan(3);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-009', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-009', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'b0000000-0000-0000-0000-000000000003', d, '10:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
-- The only table that fits a party of 4.
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'T1', 2, 4);

-- An unassigned phone booking for a party of 4, tonight at 19:00, with no table.
INSERT INTO public.reservations (id, restaurant_id, service_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES (
  'b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
  'Unassigned Four', CURRENT_DATE + 1, '19:00', 4, 'confirmed', 'phone',
  ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata',
  ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.get_available_restaurant_slots('test-resto-009', CURRENT_DATE + 1, 4) WHERE slot_time = '19:00' $$,
  'online availability for a party of 4 at 19:00 is empty once the only matching table is promised to an unassigned booking'
);

SELECT isnt_empty(
  $$ SELECT 1 FROM public.get_available_restaurant_slots('test-resto-009', CURRENT_DATE + 1, 4) WHERE slot_time = '12:00' $$,
  'sanity check: a non-overlapping slot the same day is still available'
);

SELECT throws_ok(
  $$ SELECT public.create_restaurant_reservation('test-resto-009', 'b0000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 4, 'Online Guest', 'online@example.com', '98765 00000', '+91') $$,
  'P0001',
  'SLOT_UNAVAILABLE',
  'booking the same (promised) slot online is rejected'
);

SELECT * FROM finish();
ROLLBACK;
