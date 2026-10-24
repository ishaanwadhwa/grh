-- anon must not be able to read guests, reservation_events, or
-- restaurant_booking_policies (all admin-only RLS, 015/016/017).
BEGIN;
SELECT plan(4);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('60000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-006', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-006', 'Desc');
INSERT INTO public.guests (phone_e164, name) VALUES ('+910000000006', 'RLS Test Guest');

-- Sanity check: as the table owner these rows are visible.
SELECT isnt_empty(
  $$ SELECT 1 FROM public.restaurant_booking_policies WHERE restaurant_id = '60000000-0000-0000-0000-000000000002' $$,
  'sanity check: the policy row exists before testing anon access to it'
);

SET LOCAL ROLE anon;

SELECT is_empty(
  $$ SELECT 1 FROM public.guests $$,
  'anon cannot select any row from guests'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.restaurant_booking_policies $$,
  'anon cannot select any row from restaurant_booking_policies'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.reservation_events $$,
  'anon cannot select any row from reservation_events'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
