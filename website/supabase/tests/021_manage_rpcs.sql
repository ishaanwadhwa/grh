-- get_reservation_by_token / cancel_reservation_by_token /
-- modify_reservation_by_token: guest-safe summary, cutoff, atomic modify,
-- actor_source = 'guest', privileges (030_manage_rpcs.sql).
BEGIN;
SELECT plan(15);

INSERT INTO public.properties (id, name, slug, location, description)
VALUES ('a3000000-0000-0000-0000-000000000001', 'Test Property', 'test-property-021', 'Here', 'Desc');
INSERT INTO public.restaurants (id, property_id, name, slug, description)
VALUES ('a3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'Test Resto', 'test-resto-021', 'Desc');
INSERT INTO public.restaurant_services (id, restaurant_id, name, min_party_size, max_party_size)
VALUES ('a3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000002', 'Dinner', 1, 12);
INSERT INTO public.restaurant_service_hours (service_id, day_of_week, opens_at, closes_at)
SELECT 'a3000000-0000-0000-0000-000000000003', d, '18:00', '23:00' FROM generate_series(0, 6) d;
INSERT INTO public.restaurant_floorplans (id, restaurant_id, image_path, canvas_width, canvas_height)
VALUES ('a3000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000002', 'x.png', 100, 100);
INSERT INTO public.restaurant_tables (id, restaurant_id, floorplan_id, label, min_capacity, max_capacity)
VALUES
  ('a3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000004', 'T1', 1, 6),
  ('a3000000-0000-0000-0000-000000000006', 'a3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000004', 'T2', 1, 6);

-- Unknown token.
SELECT throws_ok(
  $$ SELECT public.get_reservation_by_token('no-such-hash') $$,
  'P0002', 'INVALID_TOKEN', 'an unknown token raises INVALID_TOKEN'
);

-- Create via the public path and inspect the guest-safe view.
SELECT public.create_public_reservation('test-resto-021', 'a3000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Token Guest', 'token@example.com', 'hash-021-a', '98765 60001', '+91', FALSE, 'window seat');

SELECT is(
  (public.get_reservation_by_token('hash-021-a') ->> 'guestName'),
  'Token Guest',
  'the summary includes the guest name'
);
SELECT ok(
  NOT (public.get_reservation_by_token('hash-021-a') ? 'guestPhone')
  AND NOT (public.get_reservation_by_token('hash-021-a') ? 'tableIds')
  AND NOT (public.get_reservation_by_token('hash-021-a') ? 'needsAttention'),
  'the summary never includes phone, table, or internal flags'
);
SELECT is(
  (public.get_reservation_by_token('hash-021-a') ->> 'canCancel')::boolean,
  TRUE,
  'canCancel is true with no cancellation cutoff configured'
);

-- Modify to a new date/time/party; atomic (table re-allocated, old released).
SELECT public.modify_reservation_by_token('hash-021-a', CURRENT_DATE + 2, '20:00', 4);
SELECT is(
  (SELECT date FROM public.reservations WHERE manage_token_hash = 'hash-021-a'),
  (CURRENT_DATE + 2),
  'modify updates the date'
);
SELECT is(
  (SELECT time FROM public.reservations WHERE manage_token_hash = 'hash-021-a'),
  '20:00',
  'modify updates the time'
);
SELECT is(
  (SELECT party_size FROM public.reservations WHERE manage_token_hash = 'hash-021-a'),
  4,
  'modify updates the party size'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.reservation_table_assignments a JOIN public.reservations r ON r.id = a.reservation_id WHERE r.manage_token_hash = 'hash-021-a' AND a.released_at IS NULL),
  1,
  'modify re-allocates exactly one active table assignment'
);

-- Modify events are attributed to the guest, not system.
SELECT ok(
  (SELECT COUNT(*)::int FROM public.reservation_events e JOIN public.reservations r ON r.id = e.reservation_id WHERE r.manage_token_hash = 'hash-021-a' AND e.actor_source != 'guest') = 0,
  'every event on a guest-created, guest-modified reservation is attributed to the guest'
);

-- Modify failure leaves the booking unchanged (atomic): request a party of
-- 50 (impossible given only two 6-seat tables and no large-party pending path).
SELECT throws_ok(
  $$ SELECT public.modify_reservation_by_token('hash-021-a', CURRENT_DATE + 2, '20:00', 50) $$,
  'P0001', 'SLOT_UNAVAILABLE', 'an impossible party size fails modify (service max_party_size)'
);
SELECT is(
  (SELECT party_size FROM public.reservations WHERE manage_token_hash = 'hash-021-a'),
  4,
  'the failed modify left the party size unchanged'
);

-- Cancel.
SELECT public.cancel_reservation_by_token('hash-021-a');
SELECT is(
  (SELECT status FROM public.reservations WHERE manage_token_hash = 'hash-021-a'),
  'cancelled',
  'cancel sets status to cancelled'
);
SELECT throws_ok(
  $$ SELECT public.cancel_reservation_by_token('hash-021-a') $$,
  '22023', 'CANCELLATION_CUTOFF_PASSED', 'cancelling an already-cancelled reservation fails'
);

-- cancellation_cutoff_minutes.
UPDATE public.restaurant_booking_policies SET cancellation_cutoff_minutes = 1440 WHERE restaurant_id = 'a3000000-0000-0000-0000-000000000002';
SELECT public.create_public_reservation('test-resto-021', 'a3000000-0000-0000-0000-000000000003', CURRENT_DATE + 1, '19:00', 2, 'Cutoff Guest', 'cutoff@example.com', 'hash-021-b', '98765 60002', '+91', FALSE, NULL);
SELECT throws_ok(
  $$ SELECT public.cancel_reservation_by_token('hash-021-b') $$,
  '22023', 'CANCELLATION_CUTOFF_PASSED', 'cancelling inside cancellation_cutoff_minutes fails'
);

-- Privileges: service_role only.
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.get_reservation_by_token(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.cancel_reservation_by_token(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.modify_reservation_by_token(text,date,time,integer)', 'EXECUTE'),
  'authenticated cannot execute any of the three manage-token RPCs'
);

SELECT * FROM finish();
ROLLBACK;
