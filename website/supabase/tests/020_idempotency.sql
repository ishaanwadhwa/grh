-- claim_idempotency_key / complete_idempotency_key: claim, in-progress,
-- replay, conflict, and privileges (029_idempotency.sql).
BEGIN;
SELECT plan(8);

SELECT is(
  public.claim_idempotency_key('key-020-a', 'hashA'),
  '{"state": "claimed"}'::jsonb,
  'the first claim of a new key succeeds'
);

SELECT is(
  public.claim_idempotency_key('key-020-a', 'hashA'),
  '{"state": "in_progress"}'::jsonb,
  'a second claim with the same key+body before completion is in_progress'
);

SELECT public.complete_idempotency_key('key-020-a', 201, '{"reservation": {"id": "abc"}}'::jsonb);

SELECT is(
  public.claim_idempotency_key('key-020-a', 'hashA'),
  '{"state": "replay", "status_code": 201, "response": {"reservation": {"id": "abc"}}}'::jsonb,
  'claiming the same key+body after completion replays the stored response'
);

SELECT is(
  public.claim_idempotency_key('key-020-a', 'hashB'),
  '{"state": "conflict"}'::jsonb,
  'the same key with a different body hash is a conflict'
);

-- A different key is entirely independent.
SELECT is(
  public.claim_idempotency_key('key-020-b', 'hashA'),
  '{"state": "claimed"}'::jsonb,
  'a different key is claimed independently'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.api_idempotency_keys WHERE key IN ('key-020-a', 'key-020-b')),
  2,
  'one row per distinct key'
);

-- Privileges: service_role only.
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_idempotency_key(text,text)', 'EXECUTE'),
  'authenticated cannot execute claim_idempotency_key'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.complete_idempotency_key(text,integer,jsonb)', 'EXECUTE'),
  'authenticated cannot execute complete_idempotency_key'
);

SELECT * FROM finish();
ROLLBACK;
