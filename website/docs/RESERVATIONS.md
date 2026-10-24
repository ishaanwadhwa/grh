# Restaurant Reservations

How restaurant table booking works today, what is missing before it is safe to
open to the public, and how third-party channels (EazyDiner) will plug in.

**Last updated:** 2026-10 (reflects migrations `001`–`013`, all applied remotely, plus the
schema added by Phase P0, migrations `014`–`018`, applied locally only until reviewed)

Implementation plan: `RESERVATIONS-PLAN.md`.

---

## 1. Architecture

```
Customer UI                          Admin UI
/reserve, InlineReservation          /admin/restaurants/[id]/availability  (services + hours)
ReservationSlotSelect                /admin/restaurants/[id]/floorplan     (tables)
        │                            /admin/reservations                   (list, assign tables)
        ▼                            /admin/service                        (live floor, walk-ins)
GET  /api/reservations/availability          │
POST /api/reservations                       │ (Supabase client, admin RLS)
        │                                    │
        ▼                                    ▼
Supabase RPCs (SECURITY DEFINER)     Tables (RLS: admins only)
  get_available_restaurant_slots       restaurants, restaurant_services,
  create_restaurant_reservation        restaurant_service_hours, restaurant_service_date_overrides,
  assign_reservation_tables (admin)    restaurant_floorplans, restaurant_tables,
  create_walkin_reservation (admin)    reservations, reservation_table_assignments
  save_restaurant_service   (admin)
```

Guest data and floor plans are never exposed publicly. The public only gets
`(service_id, service_name, slot_time)` from the availability RPC and can only
write through `create_restaurant_reservation`.

### Data model

| Table | Purpose |
|---|---|
| `restaurant_services` | A bookable service (e.g. Dinner): slot interval, seating duration, buffer, min/max party size, and (`015`) a per-slot covers cap `max_covers_per_slot` (NULL = unlimited, not yet enforced). |
| `restaurant_service_hours` | Weekly opening hours per service. Close < open means the service runs past midnight (`005`). |
| `restaurant_service_date_overrides` | Closures or special hours on a specific date. |
| `restaurant_booking_policies` (`015`) | One row per restaurant: `auto_confirm`, `require_phone`/`require_email`, `large_party_threshold`, `min_lead_minutes`, `max_advance_days`, `last_seating_offset_minutes`, `online_holdback_pct`, `cancellation_cutoff_minutes`, `reminder_offsets_minutes`. Schema only — not yet read by any RPC (P1). Defaults reproduce today's behaviour. |
| `guests` (`016`) | One row per distinct phone number (`normalize_phone_e164`), with name, email, notes, tags, `visit_count`/`no_show_count`, `whatsapp_opt_in`. Linked from `reservations.guest_id`; upserted by `create_restaurant_reservation`/`create_walkin_reservation`. Phone-less reservations (most walk-ins) have `guest_id = NULL`. |
| `reservation_events` (`017`) | Append-only history per reservation: `event_type` (`created`, `status_changed`, `tables_assigned`, `updated`), `from_status`/`to_status`, `actor_id`/`actor_source`, `payload`. Written only by triggers; nobody can insert directly, not even admins. |
| `restaurant_floorplans` / `restaurant_tables` | One active floor plan per restaurant. Tables have `min_capacity`/`max_capacity`, a zone, and `is_active` (bookable vs draft). |
| `reservations` | The booking. `status` and `source` (`website`, `phone`, `walk_in`, `eazydiner`, `other`) are `CHECK`-constrained (`014`). `external_reference` holds the partner's booking ID; unique on `(source, external_reference)`. `guest_id` (`016`) links to `guests`. `manage_token_hash`, `needs_attention`/`attention_reason` (`018`) are schema-only placeholders for the guest manage link and EazyDiner conflict flag (P1/P5). |
| `reservation_table_assignments` | Which table(s) a reservation holds and for how long. A **gist exclusion constraint** prevents two active assignments from overlapping on the same table. |

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
4. A slot counts as available if **any single** active table with
   `min_capacity ≤ party ≤ max_capacity` has no overlapping active assignment.

**Booking** (`create_restaurant_reservation`):

1. Re-check everything server-side: the service, the hours, that the slot lines up with the interval, and that it fits before closing time.
2. Choose the **best-fit single table**:
   `ORDER BY (max_capacity - party), max_capacity, label`, locked with
   `FOR UPDATE SKIP LOCKED`.
3. Insert the reservation and its assignment in one transaction. If two
   requests race for the same table, the exclusion constraint guarantees only
   one wins; the loser gets a `SLOT_UNAVAILABLE` error, which the API returns as `409`.

**Admin overrides:** `assign_reservation_tables` can move a reservation onto
any set of tables (so staff can combine tables by hand). `create_walkin_reservation` seats a walk-in party
immediately on the chosen tables.

### Known limitations

| # | Limitation | Impact | Planned fix |
|---|---|---|---|
| A1 | Online booking never combines tables | Large parties see no availability even when two adjacent tables are free | `restaurant_table_combinations` (allowed groups such as T4+T5) used by both RPCs |
| A2 | No limit on covers per slot | The kitchen can get ten 2-tops all booked for 20:00 | `max_covers_per_slot` on `restaurant_services`, checked in both RPCs |
| A3 | No hold-back | Every table can be sold online, leaving none for walk-ins or EazyDiner | `online_bookable` flag per table and/or a per-service % of covers held back |
| A4 | Fixed seating duration | A 2-top and an 8-top get the same time | Duration rules by party size |
| A5 | Greedy, no re-optimisation | The floor fragments over the evening | Low priority; staff reassign tables by hand |

Suggested order: **A2 → A1 → A3**, then A4. A5 only if it turns out to matter in practice.

---

## 3. Public launch blockers

- [ ] **Abuse protection.** `create_restaurant_reservation` is granted to
      `anon`, so anyone with the public anon key can call it directly and
      skip `/api/reservations`. Revoke the `anon` grant, call the RPC from the
      API route with a server-only service-role key, and add rate limiting and a
      CAPTCHA (e.g. Cloudflare Turnstile).
- [ ] **Confirmation email** via Resend (`src/lib/resend/client.ts` exists but is not used yet).
- [ ] **Guest self-service.** A signed manage link to cancel or change a booking.
- [ ] **Admin-created future bookings** for phone and other channels. Today admins can only create
      walk-ins, which are seated immediately.
- [ ] **A2: covers per slot.**
- [ ] End-to-end QA once the new customer UI lands.

---

## 4. EazyDiner integration

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

## 5. Working on this

- Migrations live in `supabase/migrations/` and are applied in order. Many are
  forward fixes (`CREATE OR REPLACE`) because earlier ones are already applied
  remotely. **Never edit an applied migration; add a new one.**
- The customer UI calls only `/api/reservations` and
  `/api/reservations/availability`. Keep their request/response shapes stable
  so UI and backend work can proceed independently.
