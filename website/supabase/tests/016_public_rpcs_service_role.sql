-- Public booking RPCs are service_role only (025_public_rpcs_service_role.sql):
-- anon and authenticated lost the PUBLIC-grant loophole from 004; service_role can execute.
BEGIN;
SELECT plan(6);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_available_restaurant_slots(text,date,integer)', 'EXECUTE'),
  'anon cannot execute get_available_restaurant_slots'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.get_available_restaurant_slots(text,date,integer)', 'EXECUTE'),
  'authenticated cannot execute get_available_restaurant_slots'
);
SELECT ok(
  has_function_privilege('service_role', 'public.get_available_restaurant_slots(text,date,integer)', 'EXECUTE'),
  'service_role can execute get_available_restaurant_slots'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.create_restaurant_reservation(text,uuid,date,time,integer,text,text,text,text,boolean,text)', 'EXECUTE'),
  'anon cannot execute create_restaurant_reservation'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.create_restaurant_reservation(text,uuid,date,time,integer,text,text,text,text,boolean,text)', 'EXECUTE'),
  'authenticated cannot execute create_restaurant_reservation'
);
SELECT ok(
  has_function_privilege('service_role', 'public.create_restaurant_reservation(text,uuid,date,time,integer,text,text,text,text,boolean,text)', 'EXECUTE'),
  'service_role can execute create_restaurant_reservation'
);

SELECT * FROM finish();
ROLLBACK;
