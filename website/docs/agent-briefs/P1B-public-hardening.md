# Agent Brief — Phase P1B: Harden the public booking path

You are implementing **Phase P1B** of `docs/RESERVATIONS-PLAN.md`: the launch blockers for
public online booking. Your commits will be reviewed against this brief. P0 and P1A are live
in production (migrations `014`–`023`).

## Required reading (in full, before writing code)

1. `AGENTS.md`. **This is Next.js 16.** Before touching any route handler, read the route handler,
   headers/request and environment-variable docs in `node_modules/next/dist/docs/`.
2. `docs/RESERVATIONS.md` (especially "Allocation engine"), `docs/RESERVATIONS-PLAN.md` and `docs/RESERVATIONS-API.md`.
3. `docs/agent-briefs/P0-questions.md` and `P1A-questions.md`, including the **Reviewer notes** at the bottom of each.
4. Migrations `016`, `019`, `021`, `022` and `023`; `src/app/api/reservations/**`; `supabase/tests/*.sql`.

---

## Hard rules

- **Never touch the remote database** (no `db push`, no `link`). Local stack only.
- **Never edit migrations `001`–`023`.** New migrations start at **`024_`**.
- **Every new function needs an explicit `GRANT`** (functions are private by default since `019`). Public-path
  functions are granted to **`service_role` only**; staff RPCs to `authenticated` with an admin check inside.
  Add privilege assertions to the tests for every new function.
- **Don't break the live customer UI.** `src/app/(booking)/**`, `src/components/sections/**`
  and `src/components/ui/**` are owned by another developer, and **you must not edit them**. They
  currently read `{ reservation: { id } }` on success and `{ error: "<string>" }` on failure. **Every response
  change must be additive** (see the "Response compatibility" section below).
- No new npm dependencies without a written reason. No secrets or `.env*` files (you *may* add
  placeholder lines to `.env.example`).
- If something is ambiguous, log it in `docs/agent-briefs/P1B-questions.md`, take the conservative option, and carry on.

## Commit hygiene

One commit per task, message format `reservations(p1b): <what>`. Before **every** commit:
```bash
npx tsc --noEmit
npx eslint <files you changed>
npx next build
supabase db reset && supabase test db
```

---

## Response compatibility (applies to every route)

The contract in `docs/RESERVATIONS-API.md` is being updated (task 9) to this **additive** format:

- **Errors:** `{ "error": "<plain-language message>", "code": "<ERROR_CODE>" }`, keeping the same HTTP status codes as today
  (`400`, `404`, `409`, plus the new `429`, `403` and `422`). `error` stays a string.
- **POST /api/reservations success (`201`):**
  `{ "reservation": { "id": "...", "status": "confirmed" | "pending", "manageToken": "..." } }`.
  `reservation.id` stays exactly where it is today.
- **Availability:** `{ slots: [{ serviceId, serviceName, time, requiresApproval? }] }`. Only `requiresApproval` is new.

---

## Tasks (in order)

### 1. Fixes carried over from the P1A review (`024_allocation_lock_and_fixes.sql`)
- **Allocation lock.** Nothing currently stops two bookings arriving at the same moment from
  both passing `_fits_with_unassigned` (e.g. the hostess saves an unassigned booking while a guest books online).
  Add `_lock_restaurant_allocation(p_restaurant_id UUID)`, which runs
  `pg_advisory_xact_lock(hashtextextended('alloc:' || p_restaurant_id::text, 0))`, and call it
  **before any availability or capacity read** in: `create_staff_reservation`, `set_reservation_tables`,
  `create_walkin_reservation`, `assign_reservation_tables`, and the new public/manage RPCs below.
  (Reads such as availability and `suggest_tables` don't take the lock.)
  Re-create each function by copying its **latest** version and adding only the lock call and the fixes below; the reviewer diffs them.
- `set_reservation_tables`: only allow active statuses (`pending, confirmed, arrived, seated`); anything else
  raises `RESERVATION_NOT_ACTIVE`. Also, when clearing `needs_attention`, **keep** `outside_hours` if the booking is still
  outside service hours (use `_service_window`).
- Tests: the lock function exists and is called (grep-style assertion via `pg_get_functiondef` is fine);
  a completed reservation can't be reassigned; `outside_hours` survives a reassignment.

### 2. Server-only Supabase client and locked-down public RPCs
- `src/lib/supabase/service.ts`: creates a client with `SUPABASE_SERVICE_ROLE_KEY` (already used by
  `src/app/api/admin/check/route.ts`). It must be impossible to import from client components; check the
  Next 16 docs for the recommended server-only guard and use it.
- Migration `025_public_rpcs_service_role.sql`:
  - **Revoke** `EXECUTE` on `get_available_restaurant_slots` and `create_restaurant_reservation` from
    `anon` and `authenticated`, and grant to `service_role`.
  - Both `/api/reservations*` routes switch to the service client.
- Test: anon and authenticated can't execute either function; service_role can.
- Manual check in QA steps: `curl` the Supabase REST RPC endpoint with the anon key and get a 401/403-style error.

### 3. Booking policies enforced (`026_public_booking_v2.sql`)
New function **`create_public_reservation(...) RETURNS JSONB`** (service_role only). Keep the old
`create_restaurant_reservation` revoked but in place. Parameters: the same as `create_restaurant_reservation`, plus
`p_manage_token_hash TEXT`. Behaviour:
- Take the allocation lock first.
- Read `restaurant_booking_policies` and enforce:
  - `require_phone` / `require_email` → `CONTACT_REQUIRED`
  - `min_lead_minutes` (slot start minus now) and `max_advance_days` → `OUTSIDE_BOOKING_WINDOW`
  - `last_seating_offset_minutes`: slot start must be ≤ close − offset → `SLOT_UNAVAILABLE`
  - `restaurant_services.max_covers_per_slot`: the sum of `party_size` of active reservations for the same service,
    date and slot time, plus this party, must be ≤ the cap → `SLOT_UNAVAILABLE`
  - `large_party_threshold`: if `party_size >= threshold`, save as **`pending` with no table**
    (it still counts as unassigned demand, so `_fits_with_unassigned` must still pass, otherwise `SLOT_UNAVAILABLE`)
  - `auto_confirm = FALSE`: every booking is `pending` with no table (same capacity rule)
  - otherwise: the existing engine path (best-fit option with `fits_unassigned`), saved as `confirmed`
- Store `manage_token_hash`. Return `{ reservation_id, status }`.
- **`get_available_restaurant_slots`** applies the same window/last-seating/covers rules and returns a new
  `requires_approval BOOLEAN` column (true for large parties or `auto_confirm = FALSE`). Changing the return type
  means `DROP FUNCTION` + re-create + re-`GRANT` to service_role; do that in this migration.
- `online_holdback_pct` is **not** in scope (P3). Leave a comment saying so.
- Tests for **every** rule above, including the pending path counting as unassigned demand.

### 4. Pending approval (staff), in the same migration or `027_pending_review.sql`
- `review_pending_reservation(p_reservation_id, p_approve BOOLEAN, p_table_ids UUID[] DEFAULT '{}', p_allow_override BOOLEAN DEFAULT FALSE) → JSONB`
  (authenticated, admin check, takes the allocation lock).
  Approve → `confirmed`, with tables assigned via the same validation as `set_reservation_tables` (empty = leave unassigned).
  Decline → `cancelled`. Pending only, otherwise `RESERVATION_NOT_PENDING`.
- Admin UI: a **"Requests"** list on `/admin/reservations` and a badge on `/admin/service`, with
  Approve (suggested table preselected via `suggest_tables`), Approve without a table, and Decline.
  Reuse `adminErrors.ts` and add plain-language text for every new code.

### 5. Bot protection and rate limiting
- **Rate limiting in Postgres** (no new dependency). Migration `028_rate_limits.sql`: a table
  `api_rate_limits(bucket TEXT, key TEXT, window_start TIMESTAMPTZ, hits INT, PRIMARY KEY(bucket,key,window_start))`
  and `hit_rate_limit(p_bucket, p_key, p_window_seconds, p_max) RETURNS BOOLEAN` (atomic upsert, service_role only).
  Plus a cleanup of rows older than a day inside the same function, with low probability or on every N calls.
- Limits (constants in `src/lib/reservations/limits.ts`): availability 60/min per IP; create 5 per 10 min
  per IP **and** 3 per day per normalised phone; manage endpoints 20/min per IP. Over the limit → `429`, code `RATE_LIMITED`.
- Client IP: read the platform's forwarded-for header per the Next 16 docs (first entry), falling back to `"unknown"`.
- **Cloudflare Turnstile** on `POST /api/reservations` only: verify a `turnstileToken` from the body against
  Cloudflare's siteverify endpoint with `fetch`. **Enforced only when `TURNSTILE_SECRET_KEY` is set**, because the
  customer UI doesn't send the token yet (the other developer will add the widget). Failure → `403`,
  code `BOT_CHECK_FAILED`. Add `TURNSTILE_SECRET_KEY=` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` placeholders to `.env.example`.

### 6. Duplicate-submission protection
- Migration `029_idempotency.sql`: `api_idempotency_keys(key TEXT PRIMARY KEY, request_hash TEXT, status_code INT,
  response JSONB, created_at)`, service_role only, with cleanup of rows older than 24h.
- `POST /api/reservations`: if an `Idempotency-Key` header is present, use insert-first claiming. Same key and same body
  hash → replay the stored response. Same key with a different body → `409`, code `IDEMPOTENCY_KEY_REUSED`.
  A key claimed but not completed (concurrent retry) → `409`, code `REQUEST_IN_PROGRESS`.
  **The header is optional**; without it the route behaves as before.

### 7. Manage token and manage endpoints
- In `POST /api/reservations`: generate a 32-byte random token (base64url), pass its **sha256 hex** to
  `create_public_reservation`, and return the raw token **once** as `reservation.manageToken`. Never log it.
- RPCs (service_role only, `030_manage_rpcs.sql`), all looked up by `manage_token_hash`:
  - `get_reservation_by_token(p_hash)` → the guest-safe summary only (restaurant name/slug, date, time, party,
    status, guest name, special requests). **No** table, internal flags, phone or email.
  - `cancel_reservation_by_token(p_hash)` → respects `cancellation_cutoff_minutes` (`CANCELLATION_CUTOFF_PASSED`);
    only from `pending`/`confirmed`; event `actor_source = 'guest'`.
  - `modify_reservation_by_token(p_hash, p_date, p_time, p_party_size)` → takes the lock, applies the same policy
    rules as task 3, and re-allocates while excluding its own current assignment (`p_exclude_reservation_id`). It's atomic:
    either the booking moves or nothing changes (`SLOT_UNAVAILABLE`). It may become `pending` under the large-party rule.
- Routes under `src/app/api/reservations/manage/[token]/` (`GET`, `POST .../cancel`, `POST .../modify`) per the
  contract, with the error format above, rate limited. An unknown token → `404`, code `NOT_FOUND` (don't reveal anything else).
- Make sure the guest-actor events are recorded correctly (the update trigger currently labels unauthenticated updates
  `system`; set `actor_source = 'guest'` for token actions, e.g. via a transaction-local setting that the
  trigger reads. Document how).

### 8. Route refactor and error codes
- Both existing routes and the new ones use one shared helper for the error format (`{ error, code }`) and one map from
  database error messages to `{status, code, message}` in `src/lib/reservations/apiErrors.ts`.
  Keep today's wording for existing errors where it exists.
- `POST /api/reservations`: response per the "Response compatibility" section. `GET /availability`: add `requiresApproval`.

### 9. Docs
- `docs/RESERVATIONS-API.md`: switch the contract to the additive format above (errors `{ error, code }`, success
  `{ reservation: { id, status, manageToken } }`), mark the implemented endpoints `live`, list every error code with its
  HTTP status, and document the `Idempotency-Key` and `turnstileToken` behaviour (including "enforced only when configured").
- `docs/RESERVATIONS.md`: policies, pending flow, the allocation lock, manage tokens and rate limits. Tick off P1B in the plan.

---

## When finished

Add a summary at the bottom of `docs/agent-briefs/P1B-questions.md` covering: commits (hash and one line),
deviations with reasons, open questions, **manual QA steps** (including `curl` examples for each route:
happy path, rate limit, idempotent replay, anon RPC rejected, cancel past the cutoff), and a remote-apply
checklist for `024`+ (env vars to set in Vercel **before** deploying, and what to verify after).
