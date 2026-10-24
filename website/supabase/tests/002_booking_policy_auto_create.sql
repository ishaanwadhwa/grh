-- New restaurants get a default restaurant_booking_policies row automatically
-- (015_restaurant_booking_policies.sql).
BEGIN;
SELECT plan(4);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('10000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-002', 'Here', 'Desc');

INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-002', 'Desc');

SELECT is(
  (SELECT COUNT(*)::int FROM public.restaurant_booking_policies WHERE restaurant_id = '10000000-0000-0000-0000-000000000002'),
  1,
  'inserting a restaurant creates exactly one booking policy row'
);

SELECT is(
  (SELECT auto_confirm FROM public.restaurant_booking_policies WHERE restaurant_id = '10000000-0000-0000-0000-000000000002'),
  TRUE,
  'the default policy keeps auto_confirm = true (reproduces current behaviour)'
);

SELECT is(
  (SELECT online_holdback_pct FROM public.restaurant_booking_policies WHERE restaurant_id = '10000000-0000-0000-0000-000000000002'),
  0::smallint,
  'the default policy has no online hold-back'
);

SELECT throws_ok(
  $$ UPDATE public.restaurant_booking_policies SET online_holdback_pct = 101 WHERE restaurant_id = '10000000-0000-0000-0000-000000000002' $$,
  '23514',
  NULL,
  'online_holdback_pct is checked to be between 0 and 100'
);

SELECT * FROM finish();
ROLLBACK;
