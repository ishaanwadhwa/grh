# Agent Brief — Phase P0: Foundations & API Contract

You are implementing **Phase P0** of `docs/RESERVATIONS-PLAN.md` for the
Angels & Searchers reservation system. Your commits will be reviewed against this brief.
Read these first, in full:

1. `AGENTS.md`: this is Next.js 16. Read `node_modules/next/dist/docs/` for anything touching routes.
2. `docs/RESERVATIONS.md`: current design.
3. `docs/RESERVATIONS-PLAN.md`: the plan. **Only P0 is in scope.**
4. `supabase/migrations/004_*.sql`, `005_*.sql` and `013_*.sql`: the current RPCs and their conventions.

---

## Hard rules

- **Never touch the remote database.** No `supabase db push`, no `supabase link`, no
  dashboard changes. Work only against the local stack (`supabase start`, `supabase db reset`).
  The reviewer applies migrations to the remote database.
- **Never edit existing migrations `001`–`013`.** Add new ones starting at `014_`.
- **No behaviour change for the current public flow.** `/reserve`, `InlineReservation` and
  the existing `/api/reservations*` routes must keep working exactly as now. New policy
  defaults must reproduce current behaviour.
- **Do not edit customer UI files.** Another developer owns them:
  `src/app/(booking)/**`, `src/components/sections/**`, `src/components/ui/**`.
- No new npm dependencies without writing down why in the final summary.
- Never commit secrets or `.env*` files.
- If something is ambiguous, **don't guess**. Add it to `docs/agent-briefs/P0-questions.md`,
  choose the most conservative option, and carry on.

## Commit hygiene

- One commit per task below, message format `reservations(p0): <what>`.
- Before **every** commit, all of these must pass:
  ```bash
  npx tsc --noEmit
  npm run lint
  supabase db reset        # all migrations apply cleanly from scratch
  supabase test db         # once tests exist (task 7)
  ```
- Keep diffs focused. No drive-by refactors or reformatting of unrelated code.

---

## Tasks (in order)

### 1. Status and source constraints (`014_reservation_status_source_constraints.sql`)
- First normalise existing data (e.g. map any legacy `walkin` → `walk_in`), then add:
  - `reservations.status` CHECK in (`pending, confirmed, arrived, seated, completed, cancelled, no_show`)
  - `reservations.source` CHECK in (`website, phone, walk_in, eazydiner, other`)
- Add `src/lib/reservations/types.ts` with `ReservationStatus`, `ReservationSource`
  and the other shared types. Do **not** change `BookingSource` in `src/lib/data/schema.ts`,
  which is used by hotel bookings. Point reservation code at the new types instead.
- Make sure every RPC and admin page that writes `status`/`source` uses only the allowed values.

### 2. Booking policies (`015_restaurant_booking_policies.sql`)
- Table `restaurant_booking_policies`, **one row per restaurant** (PK/FK `restaurant_id`):
  `auto_confirm BOOL DEFAULT TRUE`, `require_phone BOOL DEFAULT FALSE`,
  `require_email BOOL DEFAULT TRUE`, `large_party_threshold SMALLINT NULL`,
  `min_lead_minutes INT DEFAULT 0`, `max_advance_days INT NULL`,
  `last_seating_offset_minutes INT NULL`, `online_holdback_pct SMALLINT DEFAULT 0 CHECK 0–100`,
  `cancellation_cutoff_minutes INT DEFAULT 0`, `reminder_offsets_minutes INT[] DEFAULT '{1440,180}'`,
  `created_at`, `updated_at`.
- `restaurant_services.max_covers_per_slot SMALLINT NULL` (NULL = unlimited).
- Backfill one row for every existing restaurant. Add a trigger so new restaurants get one automatically.
- RLS on: admins can read and write, nobody else. **Don't wire it into the booking RPCs yet** (that's P1).
- Note: NULL / 0 defaults mean "no restriction", so behaviour stays the same.

### 3. Guests (`016_guests.sql`)
- Table `guests`: `id`, `phone_e164 TEXT UNIQUE NULL`, `email TEXT NULL`, `name`, `notes`,
  `tags TEXT[]`, `visit_count INT DEFAULT 0`, `no_show_count INT DEFAULT 0`,
  `whatsapp_opt_in BOOL DEFAULT FALSE`, timestamps.
- `reservations.guest_id UUID NULL REFERENCES guests ON DELETE SET NULL`.
- An SQL helper `normalize_phone_e164(code TEXT, phone TEXT)` that strips non-digits and returns NULL for an empty phone.
- Backfill: create guests from existing reservations that have a phone number (deduplicated by
  E.164) and link them. Walk-ins without a phone stay `guest_id = NULL`.
- Update the existing RPCs (`create_restaurant_reservation`, `create_walkin_reservation`) to
  upsert the guest and set `guest_id`. **Keep their signatures and return types unchanged.**
- Trigger to keep `visit_count` / `no_show_count` up to date when status becomes `completed` / `no_show`.
- RLS on: admins only.

### 4. Change history (`017_reservation_events.sql`)
- Table `reservation_events`: `id`, `reservation_id`, `event_type`
  (`created, status_changed, tables_assigned, updated`), `from_status`, `to_status`,
  `actor_id UUID NULL` (`auth.uid()`), `actor_source TEXT` (`staff, guest, system, import`),
  `payload JSONB`, `created_at`.
- Triggers on `reservations` (insert, status update, other updates) and on
  `reservation_table_assignments` (insert) write the events.
- RLS on: admins can read, nobody can write directly (triggers are SECURITY DEFINER).

### 5. Manage token and conflict flag (`018_reservation_manage_token.sql`)
- `reservations.manage_token_hash TEXT UNIQUE NULL` (store only a sha256 hex; raw tokens are never stored).
- `reservations.needs_attention BOOL DEFAULT FALSE` and `attention_reason TEXT NULL`
  (used later for EazyDiner conflicts).
- Schema only. Token generation is P1.

### 6. API contract (`docs/RESERVATIONS-API.md` and types)
- Document every endpoint listed in `RESERVATIONS-PLAN.md` P0 task 2: method, path,
  request, response, error codes, and a **status** label (`live` / `planned P1`).
- Standard error format `{ error: { code, message } }` and the list of codes.
- Add matching request/response TS types to `src/lib/reservations/types.ts`.
- The existing live routes may keep their current responses. Write down any difference
  between what's live now and the contract, as a P1 migration note.
- This document is what the UI developer builds against, so make it precise and include examples.

### 7. Database tests (`supabase/tests/*.sql`, pgTAP)
At minimum:
- Two concurrent/overlapping bookings for the same single table: the second fails.
- Status and source CHECK constraints reject bad values.
- A new restaurant gets a policy row automatically.
- Guest upsert removes duplicates by phone; walk-ins without a phone get `guest_id` NULL.
- Status change → a `reservation_events` row with the correct from/to.
- `completed` / `no_show` bump the guest counters.
- RLS: the anon role can't select from `guests`, `reservation_events` or `restaurant_booking_policies`.

### 8. Docs
- Update `docs/RESERVATIONS.md` (data model table) and tick off P0 items in
  `docs/RESERVATIONS-PLAN.md`. Don't rewrite the other sections.

---

## When finished

Write a summary at the bottom of `docs/agent-briefs/P0-questions.md` covering:
- the list of commits (hash and one line each)
- any deviation from this brief, with the reason
- open questions
- anything the reviewer must do on the remote database (migration order, data checks)
