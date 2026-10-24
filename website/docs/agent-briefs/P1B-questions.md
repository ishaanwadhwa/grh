# P1B Public Hardening — open questions and deviations

Judgment calls logged while implementing `docs/agent-briefs/P1B-public-hardening.md`,
most conservative option chosen in each case. Summary at the bottom.

## 1. `CANCELLATION_CUTOFF_PASSED` reused for "not cancellable any more" generally

The brief only names one error code for cancel/modify failures around timing. I used it
both for "inside `cancellation_cutoff_minutes`" and for "the booking isn't `pending`/
`confirmed` any more" (already cancelled, completed, arrived, seated, or no-show) — from
a guest's perspective both mean the same thing ("you can't do this online any more"), and
the brief doesn't introduce a separate code for the second case.

## 2. `INVALID_TOKEN` (internal) vs `NOT_FOUND` (public)

The three manage-token RPCs raise `INVALID_TOKEN` (specific, matches the original P0
contract draft). The P1B brief's route-level instruction says an unknown token should be
"404, code `NOT_FOUND`". I kept both: the RPC's internal signal stays specific and
greppable in logs, and `src/lib/reservations/apiErrors.ts` renames it to the public code
`NOT_FOUND` at the HTTP boundary. `docs/RESERVATIONS-API.md` documents `NOT_FOUND` as the
contract; `INVALID_TOKEN` is an implementation detail now.

## 3. `requiresApproval` on availability shipped a task early

Task 8 lists "`GET /availability`: add `requiresApproval`" as part of the route-refactor
task, but the RPC already returned `requires_approval` as of task 3 (026). Rather than
leave a computed field unused for five commits, I wired it into the route's response in
the task 5 commit (rate limiting), when I was already touching that route. Purely
additive, no behaviour risk; called out here so the task-to-commit mapping below isn't
confusing.

## 4. `modify_reservation_by_token` doesn't change contact info, so doesn't re-check `CONTACT_REQUIRED`

The brief says modify "applies the same policy rules as task 3". Guest name/email/phone
aren't modify's parameters (only date/time/party size are), so there's nothing new to
check there — `CONTACT_REQUIRED` only ever applies at creation time. I did carry forward
every rule that *can* be re-triggered by changing date/time/party: lead time, advance
window, last-seating offset, covers per slot, and the large-party/`auto_confirm` decision
(which can flip a `confirmed` booking to `pending` on modify).

## 5. Modify is a partial update

`ModifyReservationRequest` has all three fields optional ("at least one required"). The
route looks up the current booking first and fills in any omitted field with its current
value before calling `modify_reservation_by_token` (which itself takes all three as
required parameters — partial-update semantics live in the route, not the RPC, to keep
the RPC's atomicity guarantee simple: it always validates/applies a complete new
(date, time, party_size) triple).

## 6. New dependency: `server-only`

Added per the brief's own instruction to "check the Next 16 docs for the recommended
server-only guard" (`node_modules/next/dist/docs/01-app/02-guides/data-security.md`
explicitly recommends this exact package for preventing a server-only module —
`src/lib/supabase/service.ts`, which holds `SUPABASE_SERVICE_ROLE_KEY` — from being
bundled into client code; it's a zero-dependency ~10-line package, no transitive
dependencies). Used in every new file under `src/lib/reservations/` and
`src/lib/supabase/service.ts`.

## 7. curl smoke-testing was not performed by me

This sandbox's tool policy blocks the `curl` command entirely (`bash` denies anything
matching `curl*`). Every change was verified via `tsc --noEmit`, `eslint`, `next build`,
and pgTAP tests against the underlying RPCs/tables, but the actual HTTP routes were never
exercised against a running server by me. The "Manual QA steps" section below has the
exact commands for the reviewer to run.

---

## Summary

### Commits (in order)

| Commit | Summary |
|---|---|
| `e7db0f4` | `024_allocation_lock_and_fixes.sql` + test — allocation lock; `set_reservation_tables` fixes carried from the P1A review. |
| `f38c752` | `src/lib/supabase/service.ts` + `025_public_rpcs_service_role.sql` — server-only client; public RPCs locked to `service_role`. |
| `4d78115` | `026_public_booking_v2.sql` + test — `create_public_reservation`, `get_available_restaurant_slots` v2, every booking policy rule. |
| `038cccf` | `027_pending_review.sql` + test + admin UI — `review_pending_reservation`, Requests list/badge. |
| `c01e86e` | `028_rate_limits.sql` + test + `src/lib/reservations/{limits,clientIp,rateLimit,turnstile,phone}.ts` — rate limiting and Turnstile wired into both existing routes. |
| `5c098a9` | `029_idempotency.sql` + test + `src/lib/reservations/{hash,idempotency}.ts` — `Idempotency-Key` support on `POST /api/reservations`. |
| `f27cc01` | `030_manage_rpcs.sql` + test + three new routes under `manage/[token]/**` — manage tokens, guest self-service, `actor_source = 'guest'`. |
| `003dcba` | `src/lib/reservations/apiErrors.ts` — consolidated error mapping; refactored all five routes onto it. |
| `9b789f9` | `docs/RESERVATIONS-API.md` rewritten, `docs/RESERVATIONS.md` §4 added, plan ticked off. |

Full suite: `supabase test db` → 21 files, 162/162 passing. `npx tsc --noEmit`, `npx eslint`
on every changed file, and `npx next build` all clean before each commit. `npm run lint`
stayed at the 4 pre-existing errors noted since P0 (none in files this brief touched).

### Deviations

See the numbered notes above: cutoff code reuse (§1), `INVALID_TOKEN`/`NOT_FOUND`
reconciliation (§2), `requiresApproval` shipped a task early (§3), modify not re-checking
contact fields (§4), modify's partial-update semantics living in the route (§5), the new
`server-only` dependency (§6).

### Open questions

- Whether `CANCELLATION_CUTOFF_PASSED` should eventually split into two codes (inside the
  cutoff vs. wrong status) if the UI ever needs to show a different message for each (§1).
- Confirmation email (Resend) is still not wired up — unchanged from P0/P1A, not in this
  brief's scope, still listed as open in `RESERVATIONS.md` §5.
- A1 (table combinations) and A3 (online hold-back) are still open, P3.
- Angels' closing/last-seating times, carried over from P0 (`P0-questions.md` §7).

### Manual QA steps for the reviewer

Against a local dev server (`supabase start`, `npm run dev`) with a restaurant/service/
floor plan seeded, and **replace `<uuid>`/`<slug>`/`<token>` with real values**:

**1. Happy path — create a booking:**
```bash
curl -s -i -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantSlug": "<slug>", "serviceId": "<uuid>",
    "date": "2026-12-01", "time": "19:00", "partySize": 2,
    "guestName": "Asha Rao", "guestEmail": "asha@example.com", "guestPhone": "9876543210"
  }'
```
Expect `201` and `{ "reservation": { "id": "...", "status": "confirmed", "manageToken": "..." } }`. Save the `manageToken`.

**2. View / cancel via the manage token:**
```bash
curl -s -i http://localhost:3000/api/reservations/manage/<manageToken>
curl -s -i -X POST http://localhost:3000/api/reservations/manage/<manageToken>/cancel
```
Expect `200` + the guest-safe summary, then `200` + `{"reservation":{"id":"...","status":"cancelled"}}`.
Re-running the cancel should now return `422` / `CANCELLATION_CUTOFF_PASSED` (already cancelled).

**3. Cancel past the cutoff:** set `cancellation_cutoff_minutes` on the restaurant's policy
row to something large (e.g. `1440`), create a booking for the next day, then repeat the
cancel call above — expect `422` / `CANCELLATION_CUTOFF_PASSED` immediately (not after
re-trying).

**4. Rate limit (create, 5/10min/IP):** repeat step 1's request 6 times in quick succession
(same or different bodies, doesn't matter — the limit is per-IP). Expect the first 5 to
process normally (success or a business error) and the 6th to be `429` with
`{"code":"RATE_LIMITED"}`.

**5. Idempotent replay:**
```bash
curl -s -i -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" -H "Idempotency-Key: demo-key-1" \
  -d '{ ...same body as step 1 but a different date/time so it does not hit the rate limit from step 4... }'
# Run the exact same command again:
curl -s -i -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" -H "Idempotency-Key: demo-key-1" \
  -d '{ ...identical body... }'
```
Expect the second call to return the **same** reservation id and status as the first (no
second row in the `reservations` table) — confirm with:
```sql
select count(*) from reservations where guest_email = 'asha@example.com' and date = '...';
```
Then retry with the same key but a **different** body — expect `409` / `IDEMPOTENCY_KEY_REUSED`.

**6. Anon RPC rejected at the database level (not just the Next.js route):**
```bash
curl -s -i -X POST "$SUPABASE_URL/rest/v1/rpc/create_restaurant_reservation" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_restaurant_slug":"<slug>","p_service_id":"<uuid>","p_service_date":"2026-12-01","p_slot_time":"19:00","p_party_size":2,"p_guest_name":"Test","p_guest_email":"test@example.com"}'
```
Expect a PostgREST error (function not found for role `anon`, `PGRST202`/`404`-style —
exact shape depends on the Supabase CLI/REST version) rather than a created reservation.
Repeat against `get_available_restaurant_slots` and `create_public_reservation` for full
coverage — all three should be unreachable with the anon key.

**7. Turnstile (only if testing with `TURNSTILE_SECRET_KEY` set):** omit `turnstileToken`
from step 1's body — expect `403` / `BOT_CHECK_FAILED`. With the env var unset (the
default until the UI ships the widget), the same request should succeed regardless of
`turnstileToken`.

### What the reviewer needs to do on the remote database and in Vercel

1. **No irreversible data changes in this phase** (unlike P1A's `020`, which merged guest
   records) — `024`–`030` are schema/function changes only. A backup before applying is
   still good practice, just not urgent the way it was for P1A.
2. Apply `024` through `030` **in order**.
3. **Before setting `TURNSTILE_SECRET_KEY` in production**, confirm the customer UI has
   actually shipped the Turnstile widget and is sending `turnstileToken`. Setting the
   secret key first would make every public booking fail with `BOT_CHECK_FAILED`, since
   enforcement switches on purely based on the env var being present, independent of
   whether the UI sends a token yet.
4. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project's environment
   variables (it's likely already there for `/api/admin/*`, but this is a second,
   independent consumer of the same variable — verify it's available to
   `/api/reservations*` specifically, i.e. not scoped to a different environment/branch).
5. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` can be set any time (it's inert until the UI reads it)
   but has no effect here since this brief didn't touch the customer UI.
6. After applying, run the anon-rejection curl checks in QA step 6 against production (or
   staging) directly — this is the one check that specifically proves the database-level
   lockdown, independent of the Next.js deployment.
7. Spot-check the existing customer booking flow end-to-end once deployed — the response
   shape only grew new fields, but this is the first time `create_public_reservation`
   (rather than `create_restaurant_reservation`) runs against real production policy data,
   so confirm a normal booking still comes back `confirmed` with a table, not unexpectedly
   `pending`.

---

## Reviewer notes (P1B review and go-live, 2026-10-26)

- **Accepted** all 10 commits. `024` diffs cleanly: only the lock call and the three P1A carry-overs. Deviations §1–§6 accepted.
- **Security fix `497beed` / `031`:** `api_rate_limits` and `api_idempotency_keys` had no RLS, and Supabase grants anon access to new
  tables by default. With the public key, anyone could read stored replays, including raw `manageToken`s (so they could view, cancel or modify
  other guests' bookings), and delete rate-limit counters. Both are now RLS-on and service_role-only. Test `022` fails if **any** public table lacks RLS.
- **Fixed:** idempotency cached 5xx/429 for 24h. Those now release the claim (`release_idempotency_key`).
- **Fixed `0958a89`:** the route required an email before the booking policy could apply. Email is now optional at the route, and
  `CONTACT_REQUIRED` enforces the policy. Angels is set to phone required, email optional (`supabase/data-fixes/2026-10_angels_contact_policy.sql`).
- **HTTP QA (§7, done by the reviewer via Node fetch on a local stack):** create, manage GET/modify/cancel, cancel-again 422, bogus token 404,
  idempotent replay (same id) and key reuse 409, rate limit 429 on the 6th request, and anon RPC/table access rejected. All passed.
- **Merged with `wave-1.0`** (`63f1fb4`). The P1B pending review was ported into the redesigned admin, and his `040` was renumbered to `032`.
- **Production:** `024`–`032` were dry-run in a transaction that rolled back, then applied; `main` pushed. Verified privileges, RLS, the Angels policy and slots.
- **Still to do by a human:** click through the redesigned admin while logged in (WAVE-1.0 merge checklist step 5, plus the Requests flow).
