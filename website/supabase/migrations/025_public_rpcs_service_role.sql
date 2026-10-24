-- Lock the public booking RPCs down to service_role only
-- (docs/agent-briefs/P1B-public-hardening.md task 2). Both functions still
-- carry a literal PUBLIC grant from when they were created in 004, before
-- 019 made new functions private by default -- REVOKE FROM PUBLIC alone
-- would leave every role able to call them via that PUBLIC grant, so it has
-- to be revoked explicitly here, the same lesson as 019's upsert_guest fix.
--
-- After this, the only way to reach either function is the service-role
-- client used by the API routes (src/lib/supabase/service.ts) -- calling the
-- PostgREST RPC endpoint directly with the anon or an authenticated user's
-- key no longer works.

REVOKE ALL ON FUNCTION public.get_available_restaurant_slots(TEXT, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_restaurant_slots(TEXT, DATE, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.create_restaurant_reservation(TEXT, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_reservation(TEXT, UUID, DATE, TIME, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;
