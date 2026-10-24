-- hit_rate_limit: allows up to the max per window, rejects over, independent
-- keys/buckets don't interfere, service_role only (028_rate_limits.sql).
BEGIN;
SELECT plan(9);

SELECT ok(public.hit_rate_limit('test_bucket_019', 'key1', 60, 3), 'hit 1 of 3 is allowed');
SELECT ok(public.hit_rate_limit('test_bucket_019', 'key1', 60, 3), 'hit 2 of 3 is allowed');
SELECT ok(public.hit_rate_limit('test_bucket_019', 'key1', 60, 3), 'hit 3 of 3 is allowed');
SELECT ok(
  NOT public.hit_rate_limit('test_bucket_019', 'key1', 60, 3),
  'hit 4 is rejected once the limit is reached'
);

-- A different key in the same bucket is independent.
SELECT ok(public.hit_rate_limit('test_bucket_019', 'key2', 60, 3), 'a different key has its own counter');

-- A different bucket for the same key is also independent.
SELECT ok(public.hit_rate_limit('other_bucket_019', 'key1', 60, 3), 'a different bucket has its own counter');

SELECT is(
  (SELECT hits FROM public.api_rate_limits WHERE bucket = 'test_bucket_019' AND key = 'key1'),
  4,
  'hits accumulate correctly across calls in the same window'
);

-- Privileges: service_role only.
SELECT ok(
  NOT has_function_privilege('anon', 'public.hit_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'anon cannot execute hit_rate_limit'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.hit_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'authenticated cannot execute hit_rate_limit'
);

SELECT * FROM finish();
ROLLBACK;
