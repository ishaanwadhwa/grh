-- Duplicate-submission protection for POST /api/reservations
-- (docs/agent-briefs/P1B-public-hardening.md task 6). Insert-first claiming:
-- the INSERT either succeeds (first time this key is seen) or hits the
-- primary key and we inspect what's there -- no separate read-then-write race.

CREATE TABLE public.api_idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  status_code INTEGER,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Returns one of:
--   {"state": "claimed"}                                   -- proceed; caller must call complete_idempotency_key when done
--   {"state": "in_progress"}                                -- same key+body, still being processed by another request
--   {"state": "replay", "status_code": ..., "response": ...} -- same key+body, already completed -- replay this
--   {"state": "conflict"}                                   -- same key, different body
CREATE OR REPLACE FUNCTION public.claim_idempotency_key(
  p_key TEXT,
  p_request_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  BEGIN
    INSERT INTO public.api_idempotency_keys (key, request_hash)
    VALUES (p_key, p_request_hash);

    -- Opportunistic cleanup, same pattern as hit_rate_limit (028).
    IF random() < 0.01 THEN
      DELETE FROM public.api_idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
    END IF;

    RETURN JSONB_BUILD_OBJECT('state', 'claimed');
  EXCEPTION WHEN unique_violation THEN
    SELECT request_hash, status_code, response INTO v_existing
      FROM public.api_idempotency_keys WHERE key = p_key;

    IF v_existing.request_hash IS DISTINCT FROM p_request_hash THEN
      RETURN JSONB_BUILD_OBJECT('state', 'conflict');
    ELSIF v_existing.status_code IS NULL THEN
      RETURN JSONB_BUILD_OBJECT('state', 'in_progress');
    ELSE
      RETURN JSONB_BUILD_OBJECT('state', 'replay', 'status_code', v_existing.status_code, 'response', v_existing.response);
    END IF;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_idempotency_key(
  p_key TEXT,
  p_status_code INTEGER,
  p_response JSONB
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE public.api_idempotency_keys
  SET status_code = p_status_code, response = p_response
  WHERE key = p_key;
$$;

GRANT EXECUTE ON FUNCTION public.complete_idempotency_key(TEXT, INTEGER, JSONB) TO service_role;
