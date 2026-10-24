-- Internal helpers must not be callable by anon/authenticated via PostgREST,
-- public RPCs must stay callable, and new functions are private by default.
BEGIN;
SELECT plan(8);

SELECT ok(NOT has_function_privilege('anon', 'public.upsert_guest(text,text,text,text,boolean)', 'EXECUTE'),
  'anon cannot execute upsert_guest');
SELECT ok(NOT has_function_privilege('authenticated', 'public.upsert_guest(text,text,text,text,boolean)', 'EXECUTE'),
  'authenticated cannot execute upsert_guest');
SELECT ok(NOT has_function_privilege('anon', 'public.log_reservation_update_event()', 'EXECUTE'),
  'anon cannot execute trigger functions');

SELECT ok(has_function_privilege('anon', 'public.get_available_restaurant_slots(text,date,integer)', 'EXECUTE'),
  'anon can still check availability');
SELECT ok(has_function_privilege('anon', 'public.create_restaurant_reservation(text,uuid,date,time,integer,text,text,text,text,boolean,text)', 'EXECUTE'),
  'anon can still book (locked down to the API route in P1)');

-- Booking still links a guest (upsert_guest runs inside the SECURITY DEFINER RPC).
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.upsert_guest('+91', '9000000000', 'x', NULL, TRUE) $$,
  '42501', NULL, 'anon call to upsert_guest is rejected');
RESET ROLE;

-- Default privileges: a newly created function is private.
CREATE FUNCTION public._privtest() RETURNS INT LANGUAGE sql AS 'SELECT 1';
SELECT ok(NOT has_function_privilege('anon', 'public._privtest()', 'EXECUTE'),
  'new functions are not executable by anon by default');
SELECT ok(NOT has_function_privilege('authenticated', 'public._privtest()', 'EXECUTE'),
  'new functions are not executable by authenticated by default');

SELECT * FROM finish();
ROLLBACK;
