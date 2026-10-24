-- Postgres-backed rate limiting, no new dependency
-- (docs/agent-briefs/P1B-public-hardening.md task 5).
-- Fixed-window counter: window_start buckets requests into p_window_seconds
-- slices, so "hits" for a given (bucket, key, window) increments atomically
-- via a single upsert -- no separate read-then-write race.

CREATE TABLE public.api_rate_limits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_start)
);

-- Records one hit for (p_bucket, p_key) and returns whether it's still
-- within the limit (TRUE = allowed, FALSE = rate limited). Service-role only
-- -- called from route handlers, never from the browser.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(
  p_bucket TEXT,
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_hits INTEGER;
BEGIN
  v_window_start := TO_TIMESTAMP(FLOOR(EXTRACT(EPOCH FROM NOW()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.api_rate_limits (bucket, key, window_start, hits)
  VALUES (p_bucket, p_key, v_window_start, 1)
  ON CONFLICT (bucket, key, window_start) DO UPDATE SET hits = public.api_rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  -- Opportunistic cleanup instead of a cron job: cheap, and only needs to
  -- happen often enough that the table doesn't grow unbounded.
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
  END IF;

  RETURN v_hits <= p_max;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hit_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
