-- P1A function privileges: internal engine functions have no grants at all;
-- the three staff RPCs are authenticated-only; anon gets none of the new
-- functions (docs/agent-briefs/P1A-booking-engine.md hard rule: "Every new
-- function needs an explicit GRANT EXECUTE... Internal helpers: no grant at all").
BEGIN;
SELECT plan(14);

-- Internal engine (021) and private helpers (023): no grants for anyone.
SELECT ok(NOT has_function_privilege('anon', 'public._free_tables(uuid,timestamptz,timestamptz,uuid)', 'EXECUTE'), 'anon cannot execute _free_tables');
SELECT ok(NOT has_function_privilege('authenticated', 'public._free_tables(uuid,timestamptz,timestamptz,uuid)', 'EXECUTE'), 'authenticated cannot execute _free_tables');
SELECT ok(NOT has_function_privilege('anon', 'public._unassigned_demand(uuid,timestamptz,timestamptz,uuid)', 'EXECUTE'), 'anon cannot execute _unassigned_demand');
SELECT ok(NOT has_function_privilege('authenticated', 'public._fits_with_unassigned(uuid,timestamptz,timestamptz,integer,uuid[],uuid)', 'EXECUTE'), 'authenticated cannot execute _fits_with_unassigned');
SELECT ok(NOT has_function_privilege('authenticated', 'public._rank_table_options(uuid,timestamptz,timestamptz,integer,boolean,uuid)', 'EXECUTE'), 'authenticated cannot execute _rank_table_options');
SELECT ok(NOT has_function_privilege('authenticated', 'public._service_window(uuid,uuid,date,time)', 'EXECUTE'), 'authenticated cannot execute _service_window');
SELECT ok(NOT has_function_privilege('authenticated', 'public._validate_table_selection(uuid,uuid[])', 'EXECUTE'), 'authenticated cannot execute _validate_table_selection');

-- Staff RPCs (023): authenticated only, never anon.
SELECT ok(NOT has_function_privilege('anon', 'public.suggest_tables(uuid,uuid,date,time,integer,uuid)', 'EXECUTE'), 'anon cannot execute suggest_tables');
SELECT ok(has_function_privilege('authenticated', 'public.suggest_tables(uuid,uuid,date,time,integer,uuid)', 'EXECUTE'), 'authenticated can execute suggest_tables');

SELECT ok(NOT has_function_privilege('anon', 'public.create_staff_reservation(uuid,uuid,date,time,integer,text,text,text,text,text,text,uuid[],text,text,boolean)', 'EXECUTE'), 'anon cannot execute create_staff_reservation');
SELECT ok(has_function_privilege('authenticated', 'public.create_staff_reservation(uuid,uuid,date,time,integer,text,text,text,text,text,text,uuid[],text,text,boolean)', 'EXECUTE'), 'authenticated can execute create_staff_reservation');

SELECT ok(NOT has_function_privilege('anon', 'public.set_reservation_tables(uuid,uuid[],boolean)', 'EXECUTE'), 'anon cannot execute set_reservation_tables');
SELECT ok(has_function_privilege('authenticated', 'public.set_reservation_tables(uuid,uuid[],boolean)', 'EXECUTE'), 'authenticated can execute set_reservation_tables');

-- Public booking RPCs (022) keep their existing anon grant.
SELECT ok(has_function_privilege('anon', 'public.create_restaurant_reservation(text,uuid,date,time,integer,text,text,text,text,boolean,text)', 'EXECUTE'), 'anon still can execute create_restaurant_reservation');

SELECT * FROM finish();
ROLLBACK;
