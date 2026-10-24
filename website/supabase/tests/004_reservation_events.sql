-- Status changes are logged to reservation_events (017_reservation_events.sql).
BEGIN;
SELECT plan(4);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('40000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-004', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-004', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT '40000000-0000-0000-0000-000000000003', d, '10:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES ('40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'T1', 1, 4);

CREATE TEMP TABLE t004_reservation AS
SELECT public.create_restaurant_reservation('test-resto-004', '40000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Cara', 'cara@example.com', '91234 56789', '+91') AS id;

SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_events WHERE reservation_id = (SELECT id FROM t004_reservation) AND event_type = 'created'),
  1,
  'creating a reservation logs a created event'
);

UPDATE public.reservations SET status = 'cancelled' WHERE id = (SELECT id FROM t004_reservation);

SELECT is(
  (SELECT from_status FROM public.reservation_events
     WHERE reservation_id = (SELECT id FROM t004_reservation) AND event_type = 'status_changed'),
  'confirmed',
  'a status change logs status_changed with the right from_status'
);

SELECT is(
  (SELECT to_status FROM public.reservation_events
     WHERE reservation_id = (SELECT id FROM t004_reservation) AND event_type = 'status_changed'),
  'cancelled',
  'a status change logs status_changed with the right to_status'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_events WHERE reservation_id = (SELECT id FROM t004_reservation) AND event_type = 'tables_assigned'),
  1,
  'the initial table assignment logs a tables_assigned event'
);

SELECT * FROM finish();
ROLLBACK;
