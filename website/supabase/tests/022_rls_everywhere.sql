-- Catch-all guard: Supabase grants anon/authenticated access to new tables by
-- default, so a table without RLS is world-readable via the anon key.
-- Every table in public must have RLS enabled, and the internal API tables
-- must not be reachable by anon at all.
BEGIN;
SELECT plan(5);

SELECT is(
  (SELECT COALESCE(STRING_AGG(c.relname, ', ' ORDER BY c.relname), '')
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity),
  '',
  'every public table has row level security enabled');

SELECT ok(NOT has_table_privilege('anon', 'public.api_idempotency_keys', 'SELECT'), 'anon cannot read idempotency keys');
SELECT ok(NOT has_table_privilege('anon', 'public.api_rate_limits', 'DELETE'), 'anon cannot delete rate limit counters');

INSERT INTO public.api_idempotency_keys (key, request_hash, status_code, response)
VALUES ('t-key', 'h', 201, '{"reservation":{"manageToken":"secret"}}');
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT * FROM public.api_idempotency_keys $$, '42501', NULL, 'anon select is rejected');
RESET ROLE;

SELECT ok(NOT has_function_privilege('anon', 'public.release_idempotency_key(text)', 'EXECUTE'), 'anon cannot release idempotency keys');

SELECT * FROM finish();
ROLLBACK;
