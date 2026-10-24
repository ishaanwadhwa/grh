# P0 Foundations — open questions and deviations

Questions/assumptions logged while implementing `docs/agent-briefs/P0-foundations.md`,
most conservative option chosen in each case, per the brief. Summary at the bottom.

## 1. Scope of the "normalise legacy data" step in task 1

The brief gives one concrete example (`walkin` → `walk_in` on `reservations.source`).
I only normalised that specific value in `014_reservation_status_source_constraints.sql`
and did not guess at coercing any other out-of-range `status`/`source` values, because
none are documented anywhere (not in `RESERVATIONS.md`, not in the live snapshot notes
in `RESERVATIONS-PLAN.md`) and I have no access to the remote data to check.

**Risk for the reviewer:** if the remote `reservations` table has any `status`/`source`
value outside the allowed lists other than `source = 'walkin'`, migration `014` will fail
to apply with a `CHECK` constraint violation. **Before applying P0 migrations remotely,
run:**

```sql
SELECT DISTINCT status FROM reservations
  WHERE status NOT IN ('pending','confirmed','arrived','seated','completed','cancelled','no_show');
SELECT DISTINCT source FROM reservations
  WHERE source NOT IN ('website','phone','walk_in','eazydiner','other','walkin');
```

If either returns rows, decide how to map them before running `014`.

## 2. Guest dedupe key is phone-only, so it's not just walk-ins that can have no guest

The brief says (task 3): "Walk-ins without a phone stay `guest_id = NULL`." The `guests`
table itself is keyed only by normalised phone (per the brief's own table spec — no
email-based key). I kept it generic rather than special-casing walk-ins: **any**
reservation without a usable phone number keeps `guest_id = NULL`, regardless of
`source`. In practice this also applies to website bookings, since `guest_phone` is
optional there (default `''`). This seemed like the conservative, literal reading of
the schema as specified rather than extra behaviour I'd be guessing at (e.g. a
secondary email-based key, which the brief doesn't ask for).

## 3. `upsert_guest` conflict-resolution rules

Not specified by the brief beyond "upsert the guest and set `guest_id`". I chose:
- `name`/`email`: only overwritten when the new value is non-blank (never blank out
  existing data with an empty value).
- `whatsapp_opt_in`: OR'd with the existing value (sticky — once true, a later booking
  that doesn't set it can't silently flip it back to false). Opt-*out* is guest-facing
  (P4 WhatsApp STOP flow) and out of scope here.

## 4. `reservation_events.actor_source` heuristic

The brief doesn't say how to decide `staff` vs `guest` vs `system` vs `import` for the
triggers. At P0 there are exactly two creation paths — the public website RPC (no
authenticated caller) and the admin walk-in RPC (authenticated admin) — so I used
`auth.uid() IS NOT NULL ⇒ 'staff'`, else `'guest'` (for `created`) or `'system'`
(for updates/table assignments, since an unauthenticated update should never happen
today outside triggers). This will need revisiting once P1/P2 add staff-created
bookings from any source and P5 adds `import`.

## 5. Pre-existing lint failures, unrelated to this work

`npm run lint` fails on plain `main` (before any P0 commit) with 4 errors + 1 warning,
all `react-hooks/set-state-in-effect` in `src/app/admin/layout.tsx`,
`src/app/admin/users/page.tsx`, and `src/hooks/useBookingFlow.ts` — none of which this
brief's tasks touch. Verified with `git stash -u && npm run lint`. I did not fix them
(out of scope, and the brief says no drive-by refactors); every commit above introduces
zero *new* lint errors, but the overall `npm run lint` exit code was already non-zero
before I started and still is.

## 6. Migration numbering: a concurrent commit

While I was reading the required docs, a separate, unrelated change
(`918928e data(angels): real table capacities from owner; prioritise table combinations`,
covering `RESERVATIONS-PLAN.md` P0 task 1 — table capacities, not part of this brief's
task list) landed in the same working tree. It briefly used `014_` for a one-off data
fix, applied it locally, then relocated the file to `supabase/data-fixes/` (not a
migration) in the same commit, so by the time I ran `supabase db reset` the migrations
directory was back to a clean, contiguous `001`–`013`. My `014` is unaffected and is the
only file claiming that number. No action needed from the reviewer beyond normal review
of `918928e`, which predates all commits below.

---

## Summary

### Commits (in order)

| Commit | Summary |
|---|---|
| `694b08d` | `014_reservation_status_source_constraints.sql` + `src/lib/reservations/types.ts` — status/source CHECK constraints, normalise legacy `walkin`→`walk_in`, new shared types. |
| `d819000` | `015_restaurant_booking_policies.sql` — `restaurant_booking_policies` table, `restaurant_services.max_covers_per_slot`, backfill + auto-create trigger, admin-only RLS. Schema only, no RPC wiring. |
| `013302a` | `016_guests.sql` — `guests` table, `reservations.guest_id`, `normalize_phone_e164`, `upsert_guest`, backfill/dedupe, visit/no-show counters + trigger; `create_restaurant_reservation`/`create_walkin_reservation` updated (same signatures/return types) to upsert the guest. |
| `f053865` | `017_reservation_events.sql` — `reservation_events` table and the triggers that write it (insert, status change, other updates, table assignment). Admin read-only; no direct writes for anyone. |
| `5d02447` | `018_reservation_manage_token.sql` — `manage_token_hash`, `needs_attention`, `attention_reason` columns. Schema only. |
| `18064a9` | `docs/RESERVATIONS-API.md` + extended `src/lib/reservations/types.ts` — full endpoint contract with live/planned-P1 status labels, standard error envelope, P1 migration notes. |
| `5b6b45d` | `supabase/tests/*.sql` — 6 pgTAP files, 24 tests, covering every item in brief task 7. |
| `43b546a` | `docs/RESERVATIONS.md` data model table updated; `docs/RESERVATIONS-PLAN.md` P0 tasks ticked off. |

### Deviations from the brief (see numbered notes above for detail)

- Normalised only the one documented legacy value (`walkin`→`walk_in`); did not guess at
  other possible bad data (§1).
- Generalised "walk-ins without a phone stay unlinked" to "any reservation without a
  usable phone stays unlinked," since guests are phone-keyed only (§2).
- Made a judgement call on `upsert_guest`'s overwrite/opt-in rules, not specified in the
  brief (§3).
- Made a judgement call on `reservation_events.actor_source` for the two P0 creation
  paths (§4).

### Open questions (unresolved, carried forward)

- From `RESERVATIONS-PLAN.md` P0 task 1 (not this brief's task list, but the overall
  phase's "done when" criterion): closing/last-seating times still need confirming with
  the restaurant; dinner currently closes at `23:59`/last seating `22:00`. Table
  capacities were fixed separately (commit `918928e`) but online availability output for
  parties of 3–12 hasn't been manually re-verified against them since.
- §1 above: whether remote has any `status`/`source` values needing a different mapping
  than the one assumed here.

### What the reviewer needs to do on the remote database

1. **Before applying anything:** run the two `SELECT DISTINCT` queries in §1 against the
   remote `reservations` table and confirm no unexpected `status`/`source` values exist
   (other than `walkin`, which `014` handles).
2. Apply migrations `014` through `018` **in order** — each depends on objects created by
   the previous one (`016` and `017` both re-create/extend functions and triggers touching
   `reservations`).
3. After applying, spot-check:
   - `SELECT count(*) FROM restaurant_booking_policies;` should equal `SELECT count(*) FROM restaurants;`.
   - `SELECT count(*) FROM guests;` and eyeball a few rows for sane phone/E.164 values.
   - `SELECT * FROM reservation_events ORDER BY created_at DESC LIMIT 5;` after the next
     live booking, to confirm triggers fired.
4. No RPC behaviour changes online booking today — `auto_confirm`, policy limits, and
   `max_covers_per_slot` are not read by any RPC yet (P1). Nothing to re-test on the
   customer booking flow beyond the usual smoke test.
5. Nothing here touches `anon`/`authenticated` grants on existing functions; the public
   booking flow's privilege surface is unchanged.
