-- 028/029 created api_rate_limits and api_idempotency_keys without RLS.
-- Supabase grants anon/authenticated table privileges by default, so both
-- were readable and writable over PostgREST with the public anon key:
--   * api_idempotency_keys.response holds the raw manageToken for replays, so anyone
--     could read it and then view, cancel or modify other guests' bookings;
--   * api_rate_limits could be deleted by anyone, which defeats rate limiting.
-- Both are only ever touched by service_role (via the RPCs in 028/029), which
-- bypasses RLS. So: enable RLS with no policies, and drop the client grants.

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;
REVOKE ALL ON TABLE public.api_idempotency_keys FROM anon, authenticated;

-- Failed attempts (5xx, 429) must not be replayed for 24h: the route releases
-- the claim so a genuine retry is processed fresh.
CREATE OR REPLACE FUNCTION public.release_idempotency_key(p_key TEXT)
RETURNS VOID
LANGUAGE sql
AS $$
  DELETE FROM public.api_idempotency_keys WHERE key = p_key AND status_code IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.release_idempotency_key(TEXT) TO service_role;
