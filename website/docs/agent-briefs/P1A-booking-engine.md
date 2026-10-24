# Agent Brief — Phase P1A: Booking engine & hostess bookings

You are implementing **Phase P1A** of `docs/RESERVATIONS-PLAN.md`. Your commits will be
reviewed against this brief. P0 is done and live in production (migrations `014`–`019`).

## Required reading (in full, before writing code)

1. `AGENTS.md`: this is Next.js 16; read `node_modules/next/dist/docs/` before touching routes.
2. `docs/RESERVATIONS.md`, `docs/RESERVATIONS-PLAN.md` (P1A section) and `docs/RESERVATIONS-API.md`.
3. `docs/agent-briefs/P0-questions.md`: decisions already made in P0.
4. Migrations `004`, `005`, `013`, `016`, `017` and `019`, plus `supabase/tests/*.sql`.
5. `src/app/admin/service/page.tsx` (the walk-in form already picks tables on the floor plan;
   **reuse that pattern**) and `src/app/admin/reservations/page.tsx`.

## What we're building (the real-life flow)

A guest phones. The hostess opens **New booking**, types the phone number (a returning guest
autofills, showing visits, no-shows and notes), and enters party size, date and time. The system
**suggests a table**, which is preselected. She can:

- **accept the suggestion**,
- **pick a different table** on the floor plan or from a list, or
- **decide later**: the booking is saved with no table.

Later (that afternoon, or when the guest arrives) she opens the unassigned booking and
gets a suggestion again, or picks manually. If the system says the booking won't fit (over a table's
capacity, or the night is full), she can still **book anyway**. That's logged and flagged for attention.

**Most important rule:** a booking with no table still uses up capacity. Online availability
and online booking must never sell a table that an unassigned booking will need.

---

## Hard rules (same as P0, plus two new ones)

- **Never touch the remote database** (no `db push`, no `link`). Local stack only.
- **Never edit migrations `001`–`019`.** New migrations start at **`020_`**.
- **Every new function needs an explicit `GRANT EXECUTE`.** Since `019`, functions are private by
  default. Staff RPCs: `GRANT ... TO authenticated` **plus** an `admin_profiles` check inside.
  Internal helpers: no grant at all. Add a privilege assertion for each new function to the tests.
- **Public API response shapes must not change** (`/api/reservations*`). Those changes are P1B.
- **Do not edit customer UI files:** `src/app/(booking)/**`, `src/components/sections/**`,
  `src/components/ui/**`. Admin pages (`src/app/admin/**`, `src/components/admin/**`) are in scope.
- No new npm dependencies without a written reason. No secrets or `.env*` files.
- If something is ambiguous, log it in `docs/agent-briefs/P1A-questions.md`, take the conservative option, and carry on.

## Commit hygiene

One commit per task, message format `reservations(p1a): <what>`. Before **every** commit:
```bash
npx tsc --noEmit
npx eslint <files you changed>      # repo-wide lint has 4 known pre-existing errors; add no new ones
supabase db reset && supabase test db
```

---

## Tasks (in order)

### 1. Small P0 fixes (`020_guest_fixes.sql`)
- `normalize_phone_e164`: strip one leading `0` from the local number, and if the digits already
  start with the country code *and* are longer than 10 digits (e.g. the user typed `+91 98…` into the phone field),
  don't add the code again. Re-normalise and merge any duplicate `guests` rows this exposes (re-point
  `reservations.guest_id` to the oldest row, sum the counters, delete the duplicates).
- `track_guest_visit_counters`: only count a transition into `completed`/`no_show` the **first**
  time for that reservation (e.g. completed → seated → completed must not double-count). Use
  `reservation_events` to tell.
- Tests for both.

### 2. Allocation engine, internal only (`021_allocation_engine.sql`)
No grants on anything in this task.

**`_free_tables(p_restaurant_id, p_starts_at, p_ends_at, p_exclude_reservation_id UUID DEFAULT NULL)`**
→ the active tables on the active floor plan with no overlapping active assignment
(ignoring assignments belonging to `p_exclude_reservation_id`).

**`_unassigned_demand(p_restaurant_id, p_starts_at, p_ends_at, p_exclude_reservation_id DEFAULT NULL)`**
→ `(reservation_id, party_size)` for active reservations (status in `pending, confirmed, arrived,
seated`) that overlap the window and have **no** active assignment.

**`_fits_with_unassigned(p_restaurant_id, p_starts_at, p_ends_at, p_new_party INT NULL,
p_new_table_ids UUID[] DEFAULT '{}', p_exclude_reservation_id DEFAULT NULL) → BOOLEAN`**
- Take the free tables, remove `p_new_table_ids` (the tables the new booking would take), then
  check that every unassigned party (plus `p_new_party` if it's given and has no tables)
  can still get its own table.
- Greedy: sort parties largest first; give each the free table with the smallest
  `max_capacity` that is `>= party`. Unassigned staff bookings ignore `min_capacity` (staff can
  seat a couple at a 4-top). Infeasible if any party is left without a table.
- Being conservative is intended: any overlap with an unassigned booking counts for the whole window.
  Write this down in a comment.

**`_rank_table_options(p_restaurant_id, p_starts_at, p_ends_at, p_party, p_strict_min BOOLEAN,
p_exclude_reservation_id DEFAULT NULL)`**
→ `(rank, table_ids UUID[], total_capacity, fits_unassigned BOOLEAN)`
- Single tables only in P1A (combinations come in P3; design the return type for multi-table options now).
- Candidates: free tables with `max_capacity >= p_party` (and `min_capacity <= p_party` when `p_strict_min`).
- Order: `fits_unassigned DESC`, then `(max_capacity - party)`, then `max_capacity`, then `label`. This is the
  same best fit as today, but it prefers tables that keep unassigned bookings seatable.

### 3. Public RPCs use the engine (`022_public_rpcs_use_engine.sql`)
- `get_available_restaurant_slots`: a slot is available only if some option from
  `_rank_table_options(..., strict_min => TRUE)` has `fits_unassigned = TRUE`.
- `create_restaurant_reservation`: pick the first option with `fits_unassigned = TRUE` (keep
  `FOR UPDATE ... SKIP LOCKED` on the chosen table), otherwise `SLOT_UNAVAILABLE`.
- **Signatures, return types and grants stay unchanged.** Copy the latest versions (`007`/`016`) and
  change only the table-selection part. The reviewer will diff them.
- Tests: an unassigned party of 4 on a night with a single free 4-top → online availability for a
  party of 4 at that time is empty, and `create_restaurant_reservation` raises `SLOT_UNAVAILABLE`.

### 4. Staff RPCs (`023_staff_booking_rpcs.sql`)
All `SECURITY DEFINER`, admin check first, `GRANT EXECUTE ... TO authenticated`.

**`suggest_tables(p_restaurant_id, p_service_id, p_date, p_time, p_party_size, p_exclude_reservation_id DEFAULT NULL) → JSONB`**
```json
{ "starts_at": "...", "ends_at": "...",
  "options": [ { "table_ids": ["..."], "labels": ["T4"], "total_capacity": 4, "fits_unassigned": true } ],
  "unassigned_fits": true,
  "warnings": ["OUTSIDE_SERVICE_HOURS" | "NO_TABLE_FITS" | "UNASSIGNED_WOULD_NOT_FIT"] }
```
- Staff times do **not** need to line up with the slot interval (20:15 is fine). They must fall within the service hours
  (overnight supported, like `013`), otherwise add the `OUTSIDE_SERVICE_HOURS` warning (a warning, not an error).
- Duration = `seating_duration + buffer` of the service. Use `p_strict_min => FALSE`.

**`create_staff_reservation(...) → JSONB`**
Parameters: `p_restaurant_id, p_service_id, p_date, p_time, p_party_size, p_guest_name,
p_guest_phone, p_guest_phone_code DEFAULT '+91', p_guest_email DEFAULT NULL,
p_source DEFAULT 'phone'` (allowed: `phone, eazydiner, other`), `p_table_mode`
(`auto | manual | none`), `p_table_ids UUID[] DEFAULT '{}'`, `p_special_requests DEFAULT NULL`,
`p_external_reference DEFAULT NULL`, `p_allow_override BOOLEAN DEFAULT FALSE`.
- `auto`: use the top `suggest_tables` option. If there isn't one, fail with `NO_TABLE_AVAILABLE` (the UI then
  offers manual / none / override).
- `manual`: the tables must be active and on the active floor plan. A physical overlap is **always** an error
  (`TABLE_ALREADY_RESERVED`; the exclusion constraint enforces it too). If total capacity is below the party size,
  fail with `OVER_CAPACITY` unless `p_allow_override`.
- `none`: no assignment.
- For every mode: if `_fits_with_unassigned` is false after this booking, fail with `CAPACITY_EXCEEDED` unless
  `p_allow_override`.
- When an override was used: set `needs_attention = TRUE` and `attention_reason` (`over_capacity` /
  `overbooked` / `outside_hours`), and record it in the event payload.
- Guest: `upsert_guest(...)` and set `guest_id`. Email is optional for staff bookings.
- Status is `confirmed`. Return `{ reservation_id, table_ids, needs_attention, warnings }`.
- `p_source = 'eazydiner'` requires `p_external_reference`. A duplicate `(source, external_reference)`
  should return the existing reservation id instead of failing (prepares for P5).

**`set_reservation_tables(p_reservation_id, p_table_ids UUID[], p_allow_override BOOLEAN DEFAULT FALSE) → JSONB`**
- An empty array **unassigns**: release the active assignments, no new ones.
- Otherwise it replaces the assignment, with the same validation and override rules as `manual` above, and
  clears `needs_attention` if the new assignment needs no override.
- Leave `assign_reservation_tables` in place (for compatibility) but stop calling it from the admin UI.

**Make sure every changed path produces the right `reservation_events` rows** (`tables_assigned`, and add
`tables_released` to the event_type CHECK for unassigning). `actor_source = 'staff'`.

### 5. Admin UI: New booking (`src/components/admin/NewBookingPanel.tsx`)
Used from both `/admin/reservations` and `/admin/service` (a "New booking" button next to "Walk-in").
1. **Guest:** phone first. On 6 or more digits, search `guests` (admin RLS allows reads) by phone suffix; also search by name.
   Picking a guest prefills name/email and shows visits, no-shows, notes and tags. Email is optional.
2. **Booking:** party size, date (defaults to the selected service date), time (free time input),
   service (auto-chosen from the time, can be overridden), source (`phone` by default, `eazydiner`
   shows a required "EazyDiner booking ID" field, `other`), special requests.
3. **Table:** call `suggest_tables` whenever party/date/time changes (debounced). Show:
   - **Suggested: T4 (3–4 seats)**, preselected,
   - **Choose table** (opens floor-plan picking like the walk-in form; tables taken in that window are disabled) or a list,
   - **Decide later**.
   Show warnings in plain language. When the save fails with `OVER_CAPACITY` / `CAPACITY_EXCEEDED` /
   `NO_TABLE_AVAILABLE`, show the reason and a clearly separate **"Book anyway"** button
   (it retries with `p_allow_override = true`).
4. On success: a toast with the guest, time and table (or "No table yet"), then refresh the list or board.

### 6. Admin UI: unassigned bookings and assigning
- `/admin/service`: a **"Needs a table"** tray listing the selected service's reservations that have no
  active assignment, plus anything with `needs_attention`. Tapping one shows the suggestion
  (`suggest_tables` with `p_exclude_reservation_id`) with **Assign suggested**, **Choose table** and **Leave unassigned**.
- `/admin/reservations`: show a "No table" / "Needs attention" badge, and switch the existing table picker to
  `set_reservation_tables` (with the suggestion preselected and an Unassign action).
- Error messages are mapped to plain language (no raw Postgres errors shown to the hostess).

### 7. Tests (`supabase/tests/`)
At minimum:
- `_fits_with_unassigned`: feasible and infeasible cases, largest-first assignment, `min_capacity` ignored for staff.
- `suggest_tables`: best fit first, off-interval time OK, `OUTSIDE_SERVICE_HOURS` warning, excludes self.
- `create_staff_reservation`: each `auto/manual/none` mode; `OVER_CAPACITY` and `CAPACITY_EXCEEDED`
  without override; with override → saved and `needs_attention`; physical overlap always fails;
  an EazyDiner duplicate reference returns the same id; a non-admin gets `FORBIDDEN`.
- `set_reservation_tables`: assign, reassign, unassign; events written.
- Public: unassigned demand blocks online availability and booking (task 3).
- Privileges: anon can execute none of the new functions; authenticated can execute only the three staff RPCs.

### 8. Docs
- `docs/RESERVATIONS.md`: a new "Allocation engine" section (the unassigned-demand rule, ranking and overrides)
  and the staff RPCs.
- Tick off P1A in `docs/RESERVATIONS-PLAN.md`.

---

## When finished

Add a summary to the bottom of `docs/agent-briefs/P1A-questions.md` covering: commits (hash and one line), deviations
with reasons, open questions, and **manual QA steps** for the reviewer (a click-path through the new
booking and assign flows), plus anything to check before applying `020`–`023` to the remote database.
