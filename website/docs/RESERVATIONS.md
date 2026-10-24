# Restaurant Reservations

How restaurant table booking works today, what is missing before it is safe to
open to the public, and how third-party channels (EazyDiner) will plug in.

**Last updated:** 2026-10 (reflects migrations `001`–`023` -- P0/P1A, all applied remotely --
plus Phase P1B, migrations `024`–`030`, applied locally only until reviewed)

Implementation plan: `RESERVATIONS-PLAN.md`.

---

## 1. Architecture

```
Customer UI                          Admin UI
/reserve, InlineReservation          /admin/restaurants/[id]/availability  (services + hours)
ReservationSlotSelect                /admin/restaurants/[id]/floorplan     (tables)
        │                            /admin/reservations                   (list, Requests, badges, assign tables)
        ▼                            /admin/service                        (live floor, walk-ins, Needs a table, Requests)
GET  /api/reservations/availability          │                            NewBookingPanel                       (guest lookup, suggest + book)
POST /api/reservations                       │ (Supabase client, admin RLS)
GET/POST /api/reservations/manage/[token]*   │
        │ (service-role client, src/lib/supabase/service.ts)
        ▼                                    ▼
Supabase RPCs (SECURITY DEFINER)     Tables (RLS: admins only)
  get_available_restaurant_slots (v2, service_role only)  restaurants, restaurant_services,
  create_public_reservation      (service_role only)      restaurant_service_hours, restaurant_service_date_overrides,
  get/cancel/modify_reservation_by_token (service_role)   restaurant_floorplans, restaurant_tables,
  create_restaurant_reservation  (revoked, kept for rollback)  reservations, reservation_table_assignments,
  suggest_tables              (admin)  restaurant_booking_policies, guests, reservation_events,
  create_staff_reservation    (admin)  api_rate_limits, api_idempotency_keys
  set_reservation_tables      (admin)
  review_pending_reservation  (admin)
  assign_reservation_tables   (admin, unused by the UI since P1A -- kept for compatibility)
  create_walkin_reservation   (admin)
  save_restaurant_service     (admin)
  _free_tables / _unassigned_demand / _fits_with_unassigned / _rank_table_options
  _lock_restaurant_allocation / _service_window / _validate_table_selection   (all internal, no grants)
```

Guest data and floor plans are never exposed publicly. The public only gets
`(service_id, service_name, slot_time, requires_approval)` from the availability
RPC, and can only write through `create_public_reservation` or the
`manage/[token]` RPCs -- all service-role only since P1B (`025`); see §4.

### Data model

| Table | Purpose |
|---|---|
| `restaurant_services` | A bookable service (e.g. Dinner): slot interval, seating duration, buffer, min/max party size, and (`015`) a per-slot covers cap `max_covers_per_slot` (NULL = unlimited; enforced since `026`, see §4). |
| `restaurant_service_hours` | Weekly opening hours per service. Close < open means the service runs past midnight (`005`). |
| `restaurant_service_date_overrides` | Closures or special hours on a specific date. |
| `restaurant_booking_policies` (`015`) | One row per restaurant: `auto_confirm`, `require_phone`/`require_email`, `large_party_threshold`, `min_lead_minutes`, `max_advance_days`, `last_seating_offset_minutes`, `online_holdback_pct`, `cancellation_cutoff_minutes`, `reminder_offsets_minutes`. Enforced in the public booking/modify RPCs since `026`/`030` (§4) — except `online_holdback_pct`, still P3. Defaults reproduce pre-P1B behaviour. |
| `guests` (`016`) | One row per distinct phone number (`normalize_phone_e164`), with name, email, notes, tags, `visit_count`/`no_show_count`, `whatsapp_opt_in`. Linked from `reservations.guest_id`; upserted by `create_restaurant_reservation`/`create_walkin_reservation`. Phone-less reservations (most walk-ins) have `guest_id = NULL`. |
| `reservation_events` (`017`, `023`) | Append-only history per reservation: `event_type` (`created`, `status_changed`, `tables_assigned`, `tables_released`, `updated`), `from_status`/`to_status`, `actor_id`/`actor_source`, `payload` (includes `needs_attention`/`attention_reason` on `created`, since `023`). Written only by triggers; nobody can insert directly, not even admins. |
| `restaurant_floorplans` / `restaurant_tables` | One active floor plan per restaurant. Tables have `min_capacity`/`max_capacity`, a zone, and `is_active` (bookable vs draft). |
| `reservations` | The booking. `status` and `source` (`website`, `phone`, `walk_in`, `eazydiner`, `other`) are `CHECK`-constrained (`014`). `external_reference` holds the partner's booking ID; unique on `(source, external_reference)`. `guest_id` (`016`) links to `guests`. `manage_token_hash` (`018`) stores only the sha256 hex of the guest's manage token, set by `create_public_reservation`/`modify_reservation_by_token` since `030` (§4). `needs_attention`/`attention_reason` (`018`) are set by the staff RPCs since `023` (`over_capacity`, `overbooked`, `outside_hours`) when a booking was saved with `p_allow_override`. |
| `reservation_table_assignments` | Which table(s) a reservation holds and for how long. A **gist exclusion constraint** prevents two active assignments from overlapping on the same table. |
| `api_rate_limits` (`028`) | Fixed-window request counters (`bucket`, `key`, `window_start`, `hits`) behind `hit_rate_limit()`. Self-cleans rows older than a day. |
| `api_idempotency_keys` (`029`) | One row per `Idempotency-Key` seen on `POST /api/reservations`: `request_hash`, `status_code`, `response`. Self-cleans rows older than 24h. |

### Reservation lifecycle

`confirmed → arrived → seated → completed` (or `cancelled` / `no_show`).

- Moving to `seated` stamps `seated_at` (`012`).
- Moving to `cancelled`, `completed` or `no_show` releases the table assignments (`011`), so the table becomes free again.

---

## 2. The allocation algorithm (current)

**Availability** (`get_available_restaurant_slots(slug, date, party_size)`):

1. Find the active services whose party-size range includes the party.
2. Work out that day's open/close times (date override first, then weekly hours).
3. Step from opening time by `slot_interval_minutes`. Each slot occupies
   `seating_duration + buffer` minutes and must end by closing time.
4. A slot counts as available if **some single-table option from the allocation
   engine** (§3 below) fits the party (`min_capacity ≤ party ≤ max_capacity`) and
   `fits_unassigned` (no table an unassigned staff booking needs gets sold out from under it).

**Booking** (`create_public_reservation` since P1B; the pre-P1B `create_restaurant_reservation`
is revoked but left in place -- see §4):

1. Re-check everything server-side: the service, the hours, that the slot lines up with the interval, and that it fits before closing time.
2. Apply the restaurant's booking policies (§4): contact requirements, lead time/advance
   window, last-seating offset, covers per slot, and the large-party/`auto_confirm` decision
   between `confirmed` (with a table) and `pending` (without one, yet).
3. For a `confirmed` booking, choose the **best-fit single table** from the same ranked
   options as availability, locked with `FOR UPDATE SKIP LOCKED`, under a per-restaurant
   advisory lock (§4 "Allocation lock") that serialises this against every other
   allocation-affecting RPC.
4. Insert the reservation (and its assignment, if any) in one transaction. If two
   requests race for the same table, the exclusion constraint guarantees only
   one wins; the loser gets a `SLOT_UNAVAILABLE` error, which the API returns as `409`.

**Admin overrides:** `assign_reservation_tables` (`004`) can still move a reservation onto
any set of tables, but nothing in the admin UI calls it since P1A --
`set_reservation_tables` (§3 below) is used instead. `create_walkin_reservation` seats a walk-in party
immediately on the chosen tables.

### Known limitations

| # | Limitation | Impact | Planned fix |
|---|---|---|---|
| A1 | Online booking never combines tables | Large parties see no availability even when two adjacent tables are free | `restaurant_table_combinations` (allowed groups such as T4+T5) used by both RPCs |
| ~~A2~~ | ~~No limit on covers per slot~~ | Fixed in P1B: `max_covers_per_slot` on `restaurant_services`, enforced in `create_public_reservation`/`get_available_restaurant_slots`/`modify_reservation_by_token` | -- |
| A3 | No hold-back | Every table can be sold online, leaving none for walk-ins or EazyDiner | `online_bookable` flag per table and/or a per-service % of covers held back |
| A4 | Fixed seating duration | A 2-top and an 8-top get the same time | Duration rules by party size |
| A5 | Greedy, no re-optimisation | The floor fragments over the evening | Low priority; staff reassign tables by hand |

Suggested order: **A1 → A3**, then A4. A5 only if it turns out to matter in practice.

---

## 3. Allocation engine (P1A)

The hostess can take a phone booking with a suggested table, a manual table, or no
table at all (decided later). **The key rule: a booking with no table still uses up
capacity.** Online availability, online booking, staff booking, and (later) EazyDiner
imports all share one check for this, so online booking can never resell a seat the
hostess has already promised. Brief: `docs/agent-briefs/P1A-booking-engine.md`.

### Shared internal functions (`021_allocation_engine.sql`, no grants -- not callable over PostgREST)

- **`_free_tables(restaurant_id, starts_at, ends_at, exclude_reservation_id?)`** -- active
  tables on the active floor plan with no overlapping active assignment. Excluding a
  reservation's own id makes its current table look free again, for re-suggestion.
- **`_unassigned_demand(restaurant_id, starts_at, ends_at, exclude_reservation_id?)`** --
  active reservations (`pending`/`confirmed`/`arrived`/`seated`) overlapping the window
  that currently have **no active table assignment at all**.
- **`_fits_with_unassigned(restaurant_id, starts_at, ends_at, new_party?, new_table_ids?, exclude_reservation_id?)`**
  -> `BOOLEAN`. Can every unassigned booking in the window -- plus `new_party`, if it's
  given and would itself have no table -- still get a table, after `new_table_ids` are
  taken out of the free pool? Greedy, largest party first, smallest table that still fits
  (`min_capacity` is **ignored** -- an unassigned staff booking can be seated anywhere
  big enough). Deliberately conservative: a booking's whole window counts as demand even
  if two unassigned parties wouldn't actually overlap each other, so this can
  under-count capacity on a packed night but never over-count it.
- **`_rank_table_options(restaurant_id, starts_at, ends_at, party, strict_min, exclude_reservation_id?)`**
  -> ranked `(rank, table_ids[], total_capacity, fits_unassigned)`. Single tables only in
  P1A (combinations are P3; the shape already supports them). Order: `fits_unassigned DESC`,
  then best fit, then label. `strict_min = TRUE` for online booking (table's own
  `min_capacity`-`max_capacity` range must fit); `FALSE` for staff.

### Public RPCs (`022_public_rpcs_use_engine.sql`)

`get_available_restaurant_slots` and `create_restaurant_reservation` (same signatures,
return types and grants as before) now source their table choice from
`_rank_table_options(..., strict_min => TRUE)` and only offer/book an option whose
`fits_unassigned` is `TRUE`.

### Staff RPCs (`023_staff_booking_rpcs.sql`)

All `SECURITY DEFINER`, check `admin_profiles` first, `GRANT EXECUTE ... TO authenticated`
only (no `anon`).

- **`suggest_tables(restaurant_id, service_id, date, time, party_size, exclude_reservation_id?)`**
  -> `JSONB` with ranked `options`, `unassigned_fits` (what accepting the top option, or
  leaving it unassigned, would do to the night), and `warnings`
  (`OUTSIDE_SERVICE_HOURS`, `NO_TABLE_FITS`, `UNASSIGNED_WOULD_NOT_FIT`). Never fails --
  staff times don't need to land on the slot interval and overnight hours are supported
  the same way as `005`/`013`.
- **`create_staff_reservation(...)`** -> `JSONB`. `source` is `phone`/`eazydiner`/`other`;
  `table_mode` is `auto`/`manual`/`none`. Always saves as `confirmed`. A physical table
  overlap (`TABLE_ALREADY_RESERVED`) is **always** an error, never overridable. `OVER_CAPACITY`
  (chosen tables too small for the party) and `CAPACITY_EXCEEDED` (would break an
  unassigned booking elsewhere) can be bypassed with `p_allow_override`, which sets
  `needs_attention`/`attention_reason` (`over_capacity`, `overbooked`, `outside_hours`) and
  is recorded in the booking's `created` event payload. A duplicate `(source,
  external_reference)` returns the existing reservation instead of erroring (prepares for P5).
- **`set_reservation_tables(reservation_id, table_ids, allow_override?)`** -> `JSONB`.
  Assign, reassign, or (empty array) unassign; same validation/override rules as above;
  clears `needs_attention` when the new assignment needs no override. Logs a
  `tables_released` event when unassigning. `assign_reservation_tables` (`004`) is left in
  place for compatibility, but nothing in the admin UI calls it since P1A.

### Admin UI

- **`NewBookingPanel`** (`src/components/admin/NewBookingPanel.tsx`, used from both
  `/admin/reservations` and `/admin/service`): guest lookup by phone or name against
  `guests`, then `suggest_tables` on every party/date/time/service change, with
  Suggested / Choose table / Decide later, and a **Book anyway** action that retries
  `create_staff_reservation` with `p_allow_override = true`.
- **`/admin/service`**: a **Needs a table** tray for the selected service/date (active
  reservations with no active assignment, or `needs_attention`), with Assign suggested /
  Choose table / Leave unassigned per row.
- **`/admin/reservations`**: "No table" / "Needs attention" badges; the table picker
  preselects a `suggest_tables` option and calls `set_reservation_tables`, with an
  Unassign action.
- Every suggest-tables warning and staff-RPC error code is mapped to plain language in
  `src/lib/reservations/adminErrors.ts` -- the hostess never sees a raw Postgres error.

---

## 4. Booking policies, pending approvals, and the public API (P1B)

Brief: `docs/agent-briefs/P1B-public-hardening.md`. Full HTTP contract: `RESERVATIONS-API.md`.

### Allocation lock

`_lock_restaurant_allocation(restaurant_id)` (`024`) takes a
`pg_advisory_xact_lock` per restaurant, held for the rest of the transaction.
Called **before any availability/capacity read** in every RPC that reads or
writes allocation state: `create_staff_reservation`, `set_reservation_tables`,
`create_walkin_reservation`, `assign_reservation_tables`,
`create_public_reservation`, `review_pending_reservation`, and
`modify_reservation_by_token`. This closes the gap where two bookings arriving
at the same moment (e.g. a hostess saving an unassigned booking while a guest
books online) could both pass `_fits_with_unassigned` and overcommit a table.
Pure reads (`get_available_restaurant_slots`, `suggest_tables`,
`get_reservation_by_token`) don't take it.

### Booking policies enforced

`create_public_reservation` and `get_available_restaurant_slots` (both
re-created in `026_public_booking_v2.sql`) read `restaurant_booking_policies`
and `restaurant_services.max_covers_per_slot`:

| Policy field | Effect |
|---|---|
| `require_phone` / `require_email` | Missing contact info → `CONTACT_REQUIRED`. |
| `min_lead_minutes` / `max_advance_days` | Slot too soon or too far out → `OUTSIDE_BOOKING_WINDOW` (online booking); the slot simply doesn't appear in availability. |
| `last_seating_offset_minutes` | Slot start must leave this much room before closing, on top of the duration already fitting → `SLOT_UNAVAILABLE` if not. |
| `max_covers_per_slot` (per service) | Sum of `party_size` for active reservations at that exact service/date/time, plus this party, capped → `SLOT_UNAVAILABLE` if exceeded. |
| `large_party_threshold` | `party_size` at/above it → saved `pending`, no table. Still checked against `_fits_with_unassigned` as unassigned demand, so a pending request that could never be seated is rejected (`SLOT_UNAVAILABLE`), not silently accepted. |
| `auto_confirm = FALSE` | Every booking is `pending`, same capacity rule as above. |

`online_holdback_pct` is **not** enforced yet -- per-table hold-back is P3
(`restaurant_table_combinations`, `online_bookable`).

`get_available_restaurant_slots` applies the same window/last-seating/covers
rules and adds a `requires_approval` column (`true` for large parties or
`auto_confirm = FALSE`) -- see `RESERVATIONS-API.md`.

### Pending approval

A `pending` reservation (large party or `auto_confirm = FALSE`) is reviewed by
staff: `review_pending_reservation(reservation_id, approve, table_ids?,
allow_override?)` (`027`) -- approve (with a `suggest_tables`-preselected
table, a manual one, or none) confirms it; decline cancels it. Surfaced as a
**Requests** list on `/admin/reservations` (the existing `pending` filter tab,
now showing a live count) and a badge + inline Approve/Decline on
`/admin/service`'s "Needs a table" tray.

### Manage tokens

`POST /api/reservations` generates a 32-byte random token, returns it **once**
as `reservation.manageToken`, and passes only its sha256 hex to
`create_public_reservation`, which stores it in `reservations.manage_token_hash`
(schema from `018`). Three service-role RPCs (`030_manage_rpcs.sql`), all
looked up by that hash:

- `get_reservation_by_token`: guest-safe summary only (no table, phone, email, or internal flags).
- `cancel_reservation_by_token`: respects `cancellation_cutoff_minutes`; only from `pending`/`confirmed`.
- `modify_reservation_by_token`: takes the allocation lock, applies the same policy
  checks as `create_public_reservation` plus the cancellation cutoff, and
  re-allocates excluding its own current table. Atomic: any failure leaves the
  booking untouched.

Guest actions run through the service-role client, so `auth.uid()` is `NULL`
just like a background job -- `log_reservation_update_event` would otherwise
label them `'system'`. Both token RPCs set a transaction-local GUC
(`PERFORM set_config('app.actor_source', 'guest', true)`) before writing,
which the trigger reads first and falls back to the old `auth.uid()`-based
`staff`/`system` split only when it's unset.

### Rate limiting, idempotency, bot protection

Summarised here; full detail (limits, headers, codes) in `RESERVATIONS-API.md`:

- **Rate limiting**: Postgres-backed (`hit_rate_limit`, `028`, no new dependency), checked before every RPC call from the API routes.
- **Idempotency**: optional `Idempotency-Key` header on `POST /api/reservations` (`029`); insert-first claiming, replays the exact stored response for a genuine retry.
- **Bot protection**: Cloudflare Turnstile on `POST /api/reservations`, enforced only once `TURNSTILE_SECRET_KEY` is set (the customer UI doesn't send a token yet).

---

## 5. Public launch blockers

- [x] **Abuse protection** (P1B). `get_available_restaurant_slots`/`create_restaurant_reservation`
      are revoked for `anon`/`authenticated` (`025`); `/api/reservations*` now calls
      `create_public_reservation`/`get_available_restaurant_slots` (v2) through a
      server-only service-role client (`src/lib/supabase/service.ts`). Rate limiting
      (`028`) and Cloudflare Turnstile (enforced once `TURNSTILE_SECRET_KEY` is set) are in
      place -- see `RESERVATIONS-API.md` §§Rate limits/Bot protection.
- [ ] **Confirmation email** via Resend (`src/lib/resend/client.ts` exists but is not used yet).
- [x] **Guest self-service** (P1B). Manage tokens (`018`, `030`) and
      `/api/reservations/manage/[token]*` (view, cancel, modify).
- [x] **Admin-created future bookings** (P1A). `create_staff_reservation` books any source
      (phone/eazydiner/other) for a future date/time, with auto/manual/no table.
- [x] **A2: covers per slot** (P1B). `restaurant_services.max_covers_per_slot`, enforced in
      `create_public_reservation`/`get_available_restaurant_slots` v2 and
      `modify_reservation_by_token`.
- [ ] End-to-end QA once the new customer UI lands.

---

## 6. EazyDiner integration

**Core problem:** EazyDiner sells from inventory configured in *its* dashboard
and cannot see our tables, so double-booking is possible unless we manage it.

### Principles

1. **Partition inventory.** Give EazyDiner a fixed set of slots or covers in their
   dashboard, and hold the same amount back on our side (A3).
2. **Never reject an EazyDiner booking.** The guest has already been confirmed by
   EazyDiner. Import it with `source = 'eazydiner'` and `external_reference = <their ID>`,
   try to auto-assign a table, and if none is free, leave it **unassigned and
   flagged as a conflict** for staff to resolve.
3. **Idempotency.** The existing unique index on `(source, external_reference)`
   makes re-imports and cancellations safe.

### Planned pieces

- [ ] `import_external_reservation(restaurant_id, source, external_reference, …)`:
      an admin/service-role RPC that upserts by reference, assigns a table if possible,
      and never fails because of capacity.
- [ ] `cancel_external_reservation(source, external_reference)`.
- [ ] A conflict indicator in `/admin/reservations` and `/admin/service`.

### Research findings (2026-10)

- **No public or self-serve API.** EazyDiner has no developer portal or docs. Integrations
  are partnerships agreed case by case; Petpooja's POS is the confirmed one.
- **LiveTable** (livetableapp.com) is EazyDiner's free restaurant app. Staff use it to
  accept bookings and to set **how many tables EazyDiner can sell per meal period**.
  This is where the EazyDiner allotment gets set to match our hold-back.
- Third-party "EazyDiner API" vendors (Actowiz, Real Data API, …) are scrapers.
  They can't sync reservations and may breach EazyDiner's terms. Don't use them.

### Ways to get bookings in (increasing effort)

1. **Manual entry.** An "Add external booking" form in admin, sharing the code
   behind launch blocker "Admin-created future bookings".
2. **Email parsing.** Forward EazyDiner/LiveTable booking and cancellation emails to an
   inbound-email webhook (e.g. Resend inbound), parse them, and call the import or cancel RPC.
3. **Partner API.** Only if EazyDiner partnerships agrees. It would call the same import RPC.

The phased implementation is in `RESERVATIONS-PLAN.md`.

---

## 7. Working on this

- Migrations live in `supabase/migrations/` and are applied in order. Many are
  forward fixes (`CREATE OR REPLACE`) because earlier ones are already applied
  remotely. **Never edit an applied migration; add a new one.**
- The customer UI calls only `/api/reservations` and
  `/api/reservations/availability`. Keep their request/response shapes stable
  so UI and backend work can proceed independently.
