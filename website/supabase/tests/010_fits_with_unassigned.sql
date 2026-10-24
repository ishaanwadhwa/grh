-- _fits_with_unassigned: feasible/infeasible cases and min_capacity ignored
-- for the internal engine (021_allocation_engine.sql).
BEGIN;
SELECT plan(4);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('d0000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-010', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-010', 'Desc');
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'T1', 2, 4),
  ('d0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'T2', 2, 4);

-- Two unassigned demands (4 and 2) overlapping the window, two free tables.
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000002', 'Demand Four', CURRENT_DATE + 1, '19:00', 4, 'confirmed', 'phone',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata'),
  ('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000002', 'Demand Two', CURRENT_DATE + 1, '19:00', 2, 'confirmed', 'phone',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

SELECT ok(
  public._fits_with_unassigned('d0000000-0000-0000-0000-000000000002',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata'),
  'two unassigned demands (4, 2) both fit when two tables are free'
);

-- Release one table's worth of capacity by pretending a 3rd demand of 3 also needs a seat --
-- with only two tables total, three overlapping demands is infeasible.
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-000000000002', 'Demand Three', CURRENT_DATE + 1, '19:00', 3, 'confirmed', 'phone',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

SELECT ok(
  NOT public._fits_with_unassigned('d0000000-0000-0000-0000-000000000002',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata'),
  'three unassigned demands with only two free tables is infeasible'
);

SELECT ok(
  public._fits_with_unassigned('d0000000-0000-0000-0000-000000000002',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata',
    NULL, '{}', 'd0000000-0000-0000-0000-0000000000a3'),
  'excluding the third demand (p_exclude_reservation_id) makes the same window feasible again'
);

-- min_capacity is ignored: a lone demand of 1 can use a table whose
-- min_capacity is 3 (a 4-top), which strict online booking would never offer it.
DELETE FROM public.reservations WHERE restaurant_id = 'd0000000-0000-0000-0000-000000000002';
UPDATE public.restaurant_tables SET min_capacity = 3 WHERE id = 'd0000000-0000-0000-0000-000000000005';
DELETE FROM public.restaurant_tables WHERE id = 'd0000000-0000-0000-0000-000000000004';
INSERT INTO public.reservations (id, restaurant_id, guest_name, date, time, party_size, status, source, starts_at, ends_at)
VALUES ('d0000000-0000-0000-0000-0000000000a4', 'd0000000-0000-0000-0000-000000000002', 'Lone Single', CURRENT_DATE + 1, '19:00', 1, 'confirmed', 'phone',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata');

SELECT ok(
  public._fits_with_unassigned('d0000000-0000-0000-0000-000000000002',
    ((CURRENT_DATE + 1) + TIME '19:00') AT TIME ZONE 'Asia/Kolkata', ((CURRENT_DATE + 1) + TIME '20:45') AT TIME ZONE 'Asia/Kolkata'),
  'a party of 1 fits a table whose min_capacity is 3 -- min_capacity is ignored for this check'
);

SELECT * FROM finish();
ROLLBACK;
