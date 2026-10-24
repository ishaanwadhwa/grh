# P1A Booking Engine — open questions and deviations

Judgment calls logged while implementing `docs/agent-briefs/P1A-booking-engine.md`,
most conservative option chosen in each case. Summary at the bottom.

## 1. `attention_reason` priority when more than one issue applies

`create_staff_reservation`/`set_reservation_tables` can hit outside-hours, over-capacity,
and capacity-exceeded-by-unassigned-demand checks in the same call, but `attention_reason`
is a single value. Not specified by the brief, so I picked a fixed priority and always keep
the **first** one set: `outside_hours` (checked first) > `over_capacity` (manual mode) >
`overbooked` (the generic post-check, all modes). A booking overridden for more than one
reason only ever shows the first; the full picture is still visible via the `warnings`
array returned to the caller and the booking's own data (time vs. hours, table vs. party size).

## 2. `suggest_tables`'s top-level `unassigned_fits` / `UNASSIGNED_WOULD_NOT_FIT`

The brief's example JSON shows `unassigned_fits` at the top level, separate from each
option's own `fits_unassigned`, but doesn't say how the top-level one is computed. I used:
the **top-ranked option's** `fits_unassigned` if any option exists (since that's what the
UI preselects and "accepting the suggestion" would actually do), otherwise the no-table
scenario (`_fits_with_unassigned` with no table at all). This seemed the most useful
reading: it reflects what happens if the hostess takes the default action, not an abstract
"could the night somehow survive this party" answer unrelated to what she's about to click.

## 3. EazyDiner duplicate-reference idempotency generalised to any source

The brief's "a duplicate `(source, external_reference)` returns the existing reservation
id" is written under the EazyDiner bullet, but I implemented it generically: **any** call
with a non-blank `p_external_reference`, regardless of `p_source`, is deduped the same way.
This matches the actual scope of the existing unique index from `004`
(`reservations_channel_external_ref_unique`, on `(source, external_reference)` for any
source) rather than special-casing one source value, and costs nothing extra for `phone`/
`other` callers who simply won't pass a reference.

## 4. `NewBookingPanel` is self-fetching, not purely prop-driven

The brief says it's "used from both `/admin/reservations` and `/admin/service`", implying
a single reusable component. `/admin/service` already scopes everything to one selected
restaurant; `/admin/reservations` has no restaurant selector at all (it lists every
restaurant's bookings together). Rather than add restaurant-scoping state to
`/admin/reservations` or pass down two different shapes of data, `NewBookingPanel` fetches
its own restaurants/services/tables (optionally pre-scoped via `defaultRestaurantId` from
`/admin/service`) and shows its own restaurant picker when none is given. This keeps both
call sites small and the panel genuinely reusable.

## 5. Table picker is a capacity-labelled grid, not the floor-plan SVG

Both "Choose table" in `NewBookingPanel` and the existing `/admin/reservations` picker use
a grid of table buttons (label + capacity, disabled when taken in that exact window), the
same pattern the walk-in form already used — not the floor-plan SVG renderer from
`/admin/service`. The brief explicitly allows this ("opens floor-plan picking ... **or a
list**"). Reusing the SVG renderer would have meant lifting its pan/zoom/layout state out
of `/admin/service/page.tsx` into a shared component, which felt like a larger, riskier
refactor than this task called for.

## 6. `/admin/reservations` only prefetches a suggestion for *unassigned* reservations

On load, `/admin/reservations` calls `suggest_tables` (and preselects the top option) only
for active reservations that currently have no table — not for every visible reservation.
Already-assigned reservations keep showing their actual assignment as the starting
selection, as before. This bounds the number of `suggest_tables` calls to roughly the
"needs a table" count instead of the full list, which otherwise has no pagination (a known,
separate limitation — see `RESERVATIONS-PLAN.md` P2 task 5).

## 7. Carried forward from P0, still open

Closing/last-seating times for Angels still haven't been reconfirmed with the restaurant
owner (`docs/agent-briefs/P0-questions.md` §7 / `RESERVATIONS-PLAN.md` P0 task 1). Not in
this brief's scope; flagging again so it doesn't get lost.

---

## Summary

### Commits (in order)

| Commit | Summary |
|---|---|
| `778595a` | `020_guest_fixes.sql` + `supabase/tests/008_guest_fixes.sql` — phone normalisation fixes (leading 0, embedded country code), one-off merge of guests the renormalisation exposes, and the completed/no_show double-count fix. |
| `4df8bd2` | `021_allocation_engine.sql` — `_free_tables`, `_unassigned_demand`, `_fits_with_unassigned`, `_rank_table_options`. No grants. |
| `1aa3c8d` | `022_public_rpcs_use_engine.sql` + `supabase/tests/009_*.sql` — public RPCs wired to the engine; unchanged signatures/grants. |
| `41cdcb0` | `023_staff_booking_rpcs.sql` — `suggest_tables`, `create_staff_reservation`, `set_reservation_tables`, `tables_released` event type. |
| `c054b17` | `src/components/admin/NewBookingPanel.tsx` + buttons on both admin pages. |
| `63355ca` | `src/lib/reservations/adminErrors.ts` + "Needs a table" tray on `/admin/service` + badges/`set_reservation_tables`/Unassign on `/admin/reservations`. |
| `7d86316` | `supabase/tests/010`–`014` — engine, `suggest_tables`, `create_staff_reservation`, `set_reservation_tables`, and privilege coverage. |
| `9d537c9` | `docs/RESERVATIONS.md` §3 + `docs/RESERVATIONS-PLAN.md` P1A ticked off. |

Full suite: `supabase test db` → 14 files, 86/86 passing. `npx tsc --noEmit`, `npx eslint`
on every changed file, and `npx next build` all clean before each commit; `npm run lint`
stayed at the 4 pre-existing errors noted in `P0-questions.md` §5 (none in files this brief
touched).

### Deviations from the brief

See the numbered notes above: `attention_reason` priority (§1), `suggest_tables`'s
`unassigned_fits` computation (§2), EazyDiner dedupe generalised to any source (§3),
`NewBookingPanel` self-fetching restaurants/services/tables (§4), grid instead of SVG table
picker (§5), suggestion prefetch scoped to unassigned reservations only (§6).

### Open questions

- Whether the `attention_reason` priority in §1 is the right one long-term, or whether it
  should become an array once a UI exists that can show more than one reason.
- §7: Angels' closing/last-seating times, carried over from P0.

### Manual QA steps for the reviewer

Local stack (`supabase start`, `npm run dev`), against a restaurant with a service, an
active floor plan, and at least two tables of different capacities:

1. **New booking, auto table.** `/admin/service` → **+ New booking** → search a phone
   number with no match → fill in name/party/date/time/service → leave **Suggested table**
   selected → **Confirm booking**. Expect a toast naming the guest, time, and table; the
   reservation appears in the list with that table assigned.
2. **New booking, guest lookup.** Open **+ New booking** again, type the same phone number
   (6+ digits) → the earlier guest should appear in the match list with 0 visits/no-shows →
   tap it → name/email prefill.
3. **New booking, decide later.** Create a booking with **Decide later** selected. It should
   save with no table and show a "No table" badge in `/admin/reservations`, and appear in
   the **Needs a table** tray on `/admin/service` for that date/service.
4. **Assign from the tray.** On `/admin/service`, open the **Needs a table** tray, tap
   **Suggest a table** on the booking from step 3, then **Assign suggested**. It should
   disappear from the tray and show up with a table on the floor/list.
5. **Book anyway.** Book enough parties into a single small restaurant/service/time slot to
   exhaust its tables, then create one more with **Decide later**. Expect a **CAPACITY_EXCEEDED**
   message with a **Book anyway** button; clicking it should save the booking and show
   "flagged for attention" in the toast, with a **Needs attention** badge afterwards.
6. **EazyDiner source.** New booking with source **eazydiner** and no reference → expect a
   validation message, not a raw error. Fill in a reference and save; it should succeed.
7. **Reassign and unassign on `/admin/reservations`.** For any active reservation, confirm
   the table picker preselects a suggestion, change the selection and **Save table
   assignment**, then **Unassign** the same reservation and confirm it goes back to showing
   "No table".
8. **Online availability still works unchanged** for a party size/time that has no
   unassigned-demand conflict (smoke test `/reserve` or the availability API directly) —
   confirms P1A didn't change the shape or behaviour of the public flow outside the new
   unassigned-demand rule.

Browser/interactive testing of the three new UI surfaces (`NewBookingPanel`, the tray, the
updated picker) was **not** performed as part of this work — only `tsc`, `eslint`, and a
production `next build`. Steps 1–7 above are what still needs a human click-through before
this is considered UI-verified.

### What the reviewer needs to do on the remote database

1. **Migration `020` changes real guest data.** The `guests.phone_e164` renormalisation and
   duplicate-merge step is a one-off, irreversible operation (it deletes the losing side of
   each merge after summing its counters onto the survivor). **Export/snapshot the `guests`
   and `reservations` tables before applying `020`** so a merge can be inspected or reverted
   from the backup if something looks wrong. After applying, spot-check:
   ```sql
   -- Guests whose phone_e164 changed shape in a way worth a manual look
   -- (run before/after from the backup to compare row counts and names).
   SELECT count(*) FROM guests;
   SELECT id, phone_e164, name, visit_count, no_show_count FROM guests ORDER BY updated_at DESC LIMIT 20;
   ```
2. Apply `020` through `023` **in order** — `023` alters `reservation_events`'s `event_type`
   CHECK constraint and re-creates `log_reservation_created_event`, both defined in `017`/`019`.
3. After applying, confirm the three staff RPCs are authenticated-only and the new engine
   functions have no grants (mirrors `supabase/tests/014_p1a_privileges.sql`):
   ```sql
   SELECT has_function_privilege('anon', 'public.create_staff_reservation(uuid,uuid,date,time,integer,text,text,text,text,text,text,uuid[],text,text,boolean)', 'EXECUTE'); -- expect false
   SELECT has_function_privilege('authenticated', 'public.create_staff_reservation(uuid,uuid,date,time,integer,text,text,text,text,text,text,uuid[],text,text,boolean)', 'EXECUTE'); -- expect true
   ```
4. No public RPC response shapes changed — nothing to re-test on the customer booking flow
   beyond the usual smoke test, and the unassigned-demand rule only makes online slots
   *disappear* when a staff booking already needs that table, never the reverse.
5. `assign_reservation_tables` (`004`) still exists and is still granted to `authenticated`;
   it's just unused by the admin UI now. Nothing to revoke — P1B still plans to tighten
   public-RPC grants, not this one.
