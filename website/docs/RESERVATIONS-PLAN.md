# Reservation System — Backend Plan (Angels & Searchers)

Goal: make the backend a stable, real-world reservation system for Angels &
Searchers. It must be ready for the new customer UI (being built separately)
and for EazyDiner bookings. Background and current design are in `RESERVATIONS.md`.

**Status:** draft for review · **Last updated:** 2026-10

---

## 0. Context and decisions

| Topic | Decision / fact |
|---|---|
| POS | None. Our system is the master record for the floor. |
| Booking rules | **Configurable per restaurant** (see the policy table in P0). |
| Guest messaging | **WhatsApp from day one.** No business number or Meta Business account yet, so build the sending pipeline to work with any provider, run email (Resend) until WhatsApp is approved, then switch WhatsApp on. |
| Floor devices | One hostess device today, more later. Realtime is needed eventually but isn't urgent. |
| EazyDiner | No public API (see §4). The restaurant hasn't tried LiveTable yet. |
| UI | Being built by someone else. The backend publishes a stable API contract first (P0) so both can proceed in parallel. |

### Live database snapshot (linked project, migrations 001–013 all applied)

- Angels has two services: **Lunch 12:00–15:30** and **Dinner 19:00–23:59**, both with a 30-minute slot interval, 90-minute seating and a 15-minute buffer, for parties of 1–12.
- Floor plan: 16 tables (T1–T16). Capacities were all 2 until the owner sent real numbers.
  **Fixed 2026-10** via `supabase/data-fixes/2026-10_angels_table_capacities.sql`.
  Parties of 1–6 now get slots online; 7+ need combinations (P3.2, prioritised).
- The last bookable slots are **13:30 (lunch)** and **22:00 (dinner)**, because seating plus buffer must finish before closing time. Confirm that's what the restaurant wants; dinner could use `00:00` close (overnight services are supported) or a separate "last seating" setting (P0 policy).
- No date overrides (closures or special hours) have been entered.

---

## Phase P0: Foundations and API contract (unblocks the UI)

**Status: done**, pending review and the reviewer applying migrations `014`–`018` to the
remote database (see `docs/agent-briefs/P0-questions.md` for the commit list and what
the reviewer needs to do). Implemented against the agent brief `docs/agent-briefs/P0-foundations.md`.

**Tasks**
1. ✅ **Restaurant setup fixes (data, not code):** real table capacities and `is_active`
   set from the owner's list (`supabase/data-fixes/2026-10_angels_table_capacities.sql`,
   applied directly, not a migration). Closing/last-seating times not yet reconfirmed with
   the restaurant — still open, tracked in `docs/agent-briefs/P0-questions.md`.
2. ✅ **API contract** (`docs/RESERVATIONS-API.md` plus shared TS types in `src/lib/reservations/types.ts`):
   - `GET  /api/reservations/availability?restaurant&date&partySize` → slots (unchanged shape, plus an optional `requiresApproval` flag)
   - `POST /api/reservations` → `{ id, status: confirmed|pending, manageToken }`; accepts an `Idempotency-Key` header
   - `GET  /api/reservations/manage/[token]` → booking summary (no internal data)
   - `POST /api/reservations/manage/[token]/cancel`
   - `POST /api/reservations/manage/[token]/modify` (date/time/party; re-runs the availability check)
   - A standard error format: `{ error: { code, message } }` with stable codes (`SLOT_UNAVAILABLE`, `POLICY_VIOLATION`, `RATE_LIMITED`, …)
3. ✅ **Booking policy table** `restaurant_booking_policies` (one row per restaurant, managed in admin):
   `auto_confirm`, `require_phone`, `require_email`, `large_party_threshold`
   (larger parties become `pending` requests), `min_lead_minutes`, `max_advance_days`,
   `last_seating_offset_minutes`, `max_covers_per_slot` (per service), `online_holdback_pct`,
   `cancellation_cutoff_minutes`, `reminder_offsets` (e.g. 24h, 3h).
   Schema only — not read by any RPC yet, so online behaviour is unchanged; wiring it in is P1.
4. ✅ **Schema hardening**
   - `CHECK` constraints on `reservations.status` (`pending, confirmed, arrived, seated, completed, cancelled, no_show`) and `source` (`website, phone, walk_in, eazydiner, other`). The one legacy `walkin` row is normalised to `walk_in` before the constraint is added; no occurrences of either mismatch remain in TS.
   - `guests` table (unique by normalised phone, with email, name, notes, tags, visit/no-show counts, `whatsapp_opt_in`), linked from `reservations.guest_id`. `create_restaurant_reservation`/`create_walkin_reservation` upsert the guest with unchanged signatures/return types.
   - `reservation_events` change history (who, when, from → to, payload), written by a trigger; nobody can insert directly.
   - `manage_token_hash` on reservations (store only the hash; the raw token goes in the guest message).
   - A conflict flag/column (`needs_attention`, `attention_reason`) for imported bookings that couldn't get a table.

**Done when:** the contract doc and types are merged and shared with the UI dev ✅; migrations apply
cleanly on a local Supabase ✅ (`supabase db reset`; pgTAP suite in `supabase/tests/`, 24/24 passing);
parties of 3–12 get slots once Angels' tables are fixed — capacities were fixed (task 1) but availability
output hasn't been re-verified against them since; worth a quick manual check before P1.

---

## Phase P1A: Booking engine and hostess bookings

**Status: done**, pending review and the reviewer applying migrations `020`-`023` to the
remote database (see `docs/agent-briefs/P1A-questions.md` for the commit list and what the
reviewer needs to check/do). Brief: `docs/agent-briefs/P1A-booking-engine.md`.

The hostess books on behalf of guests the way it works in real life:

1. **The system suggests a table** (best fit), and it's preselected.
2. **Or she picks a table herself** on the floor plan or from a list.
3. **Or she decides later.** The booking is saved without a table and assigned before or on the night, again with a suggestion.
4. She can **book anyway** when the system says it won't fit (a 5 on a 4-top, a squeeze on a full night). It's logged and flagged for attention.

**Key rule: bookings without a table still use up capacity.** One shared check is used by online
availability, online booking, staff booking and later EazyDiner imports: "can every unassigned
booking in this window still get a table if we add this party?" Without it, online booking
would resell seats the hostess has already promised.

**Tasks (summary; details in the brief):** a shared allocation engine (suggestions plus a check that unassigned
bookings still fit), which the public RPCs then use; `suggest_tables`, `create_staff_reservation`,
`set_reservation_tables` (assign, reassign, unassign); an admin "New booking" flow with guest
lookup; a "Needs a table" list on the service screen; fixes to phone normalisation and the guest counters.

✅ All of the above, done against the agent brief:
- `020_guest_fixes.sql`: phone normalisation (leading 0, embedded country code) and the guest
  visit/no-show double-count fix, with the one-off merge for guests the renormalisation exposes.
- `021_allocation_engine.sql`: `_free_tables`, `_unassigned_demand`, `_fits_with_unassigned`,
  `_rank_table_options` -- internal, no grants.
- `022_public_rpcs_use_engine.sql`: `get_available_restaurant_slots`/`create_restaurant_reservation`
  re-created with unchanged signatures/grants, table selection now routed through the engine.
- `023_staff_booking_rpcs.sql`: `suggest_tables`, `create_staff_reservation`, `set_reservation_tables`,
  plus the `tables_released` event type and override/`needs_attention` handling.
- `src/components/admin/NewBookingPanel.tsx`, the `/admin/service` "Needs a table" tray, and the
  `/admin/reservations` badges + `set_reservation_tables` switch-over.
- Full design write-up: `docs/RESERVATIONS.md` §3 "Allocation engine (P1A)".

**Done when:** a hostess can take a phone booking in under a minute with a suggested table, a
manual table, or no table, and assign it later ✅. Online availability never sells capacity that
unassigned bookings need ✅ (`supabase/tests/009_public_rpcs_use_engine.sql`). Database tests cover
all of it ✅ (`supabase/tests/010`-`014`, 86/86 passing).

---

## Phase P1B: Harden the public booking path (launch blocker)

Brief: `docs/agent-briefs/P1B-public-hardening.md`. Also covers the fixes carried over from the P1A review (allocation lock).
Response changes are **additive** so the live customer UI keeps working.

**Tasks**
1. Server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY`. **Revoke `anon`** on
   `create_restaurant_reservation` (and the new public functions) so the API route is the only way in.
2. Bot protection: Cloudflare Turnstile verified in `POST /api/reservations`.
3. Rate limiting per IP and per phone number. Use Upstash Redis (Vercel Marketplace), or a Postgres
   counter table to avoid a new dependency.
4. Duplicate protection: save the `Idempotency-Key` and return the original result if the same request is retried.
5. Enforce booking policies inside the database function (lead time, how far ahead, phone/email
   rules, large-party → `pending`, covers per slot, hold-back).
6. Implement the manage-token endpoints (view, cancel, modify), respecting `cancellation_cutoff_minutes`.

**Done when:** calling the RPC directly with the anon key fails; double-submitting creates one booking;
every policy rule has a passing database test; cancel and modify work end to end through the API.

---

## Phase P2: Staff operations (usable on a real night)

**Tasks**
1. ~~`create_staff_reservation`~~: moved to P1A.
2. `set_reservation_status` RPC with allowed transitions only; this replaces direct table
   `UPDATE`s from the browser. Restrict RLS to read-only for staff.
3. `move_reservation`, `extend_reservation` (overstays push `ends_at` and warn about the next booking),
   and late-arrival handling (shift or shorten the seating).
4. Roles: `admin_profiles.role` → `manager` (everything) vs `host` (reservations and service
   only). Enforce in the RPCs and in admin page routing.
5. Date-filtered admin queries (`/admin/reservations` currently loads every reservation).
6. **Realtime** (Supabase Realtime on reservations and assignments) on `/admin/service`, so
   a second device or waiter phones can be added later with no rework. Small task, worth doing now.

**Done when:** a hostess can run a full service (phone booking, arrival, seating, extending, moving,
completing, no-show) without touching the database; every change shows up in `reservation_events`.

---

## Phase P3: Smarter table allocation

**Angels requirements (from the owner, 2026-10):**

| Requirement | Detail |
|---|---|
| Combinations | **T1+T2 joined: 8–14**, **T6+T11 joined: 7–9** |
| Online vs staff max | T4, T5, T6, T11 are "4/5": max 4 online, 5 allowed when staff seat them. Needs `staff_max_capacity` (stored as 4 for now). `assign_reservation_tables` must use the staff max. |
| Splittable tables | T8, T9 seat 3–4 whole, or split into halves T8a/T8b/T9a/T9b of 1–2 each. Model them as "variants" of one physical table, so only one layout can be booked at a time. Booked whole for now. |
| Retired | T15 becomes a wine store (hidden, zone "Wine store") |
| Unconfirmed | T13 isn't on the owner's list; set to 2–4 as a twin of T12. Confirm with the owner. |

In order (**combinations are prioritised: build them straight after P1**):
1. **Covers per slot** (from the policy) in both availability and booking.
2. **Table combinations:** a `restaurant_table_combinations` table (e.g. T6+T7, with min/max
   capacity), managed in the floor plan editor. Booking prefers the best-fitting single table,
   then the smallest combination that fits.
3. **Online hold-back:** an `online_bookable` flag per table plus `online_holdback_pct`. Hold-back
   tables can still be booked by staff and by EazyDiner imports.
4. **Seating duration by party size** (e.g. 1–2: 75 min, 3–4: 90, 5+: 120).

**Done when:** database tests cover combination choice, the covers cap, and hold-back visibility (online vs staff).

---

## Phase P4: Guest messaging (WhatsApp-first, provider-agnostic)

**Tasks**
1. `notification_outbox` table: every booking event queues a message (channel,
   template, payload, status, attempts, provider message ID).
2. Sending worker: triggered via `waitUntil` after the response, plus a Vercel Cron sweep
   every few minutes for retries and scheduled reminders.
3. A `NotificationProvider` interface with implementations:
   - `ResendEmailProvider`: live immediately.
   - `WhatsAppProvider`: Meta Cloud API directly, or a provider such as Interakt/AiSensy/Gupshup;
     switched on by an env flag once the number is verified.
4. Templates (WhatsApp "utility" category): confirmation, pending-request received,
   request approved/declined, reminder, modified, cancelled. Each includes the manage link.
5. Inbound webhook: guests tap "Confirm"/"Cancel" buttons, which update the reservation;
   STOP/opt-out updates `guests.whatsapp_opt_in`.
6. Staff alerts for pending requests and EazyDiner conflicts (in the admin screen first, WhatsApp to the manager later).

**Business actions (start now, these take the longest):**
- [ ] Get a **dedicated phone number** for Angels that isn't registered on the WhatsApp consumer or Business app.
- [ ] Create a **Meta Business** account and complete business verification.
- [ ] Choose a provider: Meta Cloud API directly (cheapest, more work for us) or a provider such as Interakt/AiSensy (easier UI and onboarding, monthly fee).
- [ ] Submit the templates for approval once the wording is agreed.

**Done when:** email confirmations and reminders work in production; the WhatsApp provider passes a test against the Meta test number; switching WhatsApp on is a config change.

---

## Phase P5: EazyDiner

**Tasks**
1. `import_external_reservation(restaurant, source, external_reference, date, time, party, guest…)`:
   service-role/staff only, **upserts by `(source, external_reference)`**, tries to auto-assign a table
   (including hold-back tables), and **never rejects for lack of space**. If no table is free,
   it saves the booking unassigned with the conflict flag set.
2. `cancel_external_reservation(source, external_reference)`.
3. A quick "EazyDiner booking" entry form for the hostess (reuses P2's staff create).
4. A conflict banner and filter in `/admin/reservations` and `/admin/service`.
5. Later: an inbound-email parser (e.g. Resend inbound) once we have sample EazyDiner or LiveTable
   notification emails, calling the same functions.

**Business actions:**
- [ ] Try **LiveTable** and set EazyDiner's sellable inventory per meal period to match our hold-back.
- [ ] Forward a few real EazyDiner booking and cancellation notifications to us (to build the parser).
- [ ] Ask EazyDiner partnerships about booking webhooks or an API and two-way availability (they did this for Petpooja).

**Done when:** importing the same booking twice creates one reservation; an import into a full slot shows up as a conflict instead of failing.

---

## Applies to every phase

- **Local development:** use `supabase start` with migrations applied locally; only push to remote after review.
- **Database tests:** pgTAP via `supabase test db`, covering concurrent booking races, policies,
  status transitions, combinations and imports. Run them in CI on PRs.
- **Monitoring:** structured logs on API routes; alerts on repeated 5xx errors and on outbox
  messages stuck in `failed` (Vercel logs and a daily summary to start with).
- **Migrations:** forward-only; never edit an applied migration.
- **Docs:** keep `RESERVATIONS.md` (design), `RESERVATIONS-API.md` (contract) and this plan up to date.

## Suggested order

`P0 ✅ → P1A` (booking engine and hostess bookings) → `P1B` (public hardening; the API contract's "planned P1" items) → `P3.2 combinations + staff max`
(Angels needs 7–14 online) → `P2` (staff operations) → `P3.1` (covers) → public soft launch → `P4` (email now,
WhatsApp when approved) → `P5` → remaining P3.

Business actions (WhatsApp number, Meta verification, LiveTable trial, table
capacities) should start in parallel **now**.
