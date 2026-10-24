# Booking backend handoff (2026-10-18): kept for reference, not applied

A Claude session ("GRH portal backend access") wrote this guest-booking backend on 2026-10-18, against `main` @ `6973d1b`. It was never applied anywhere.

**Don't apply `guest-booking-backend.patch` as it is.** Since then, `main` gained the reservations P0 and P1A work: migrations 014–023, the allocation engine, staff RPCs and `docs/RESERVATIONS*.md`.

## Conflicts with today's `main`

- **Duplicate migration numbers.** The patch's migrations are numbered `014`–`017`; `main` already uses those numbers. P1B also plans `024`–`030`.
- **The booking function.** The patch's `014` rewrites `create_restaurant_reservation`.
  - `main` rewrote that function in `016`, then routed it through the allocation engine in `022`.
  - Applying the patch would undo the engine.

## Where each idea stands against `main` and P1B (`docs/agent-briefs/P1B-public-hardening.md`)

| Handoff idea | Today's `main` | Planned in P1B | Verdict |
|---|---|---|---|
| Email optional (phone *or* email) | Still **requires** email (`016`/`022` reject a blank email) | `create_public_reservation` with `require_phone`/`require_email` (`CONTACT_REQUIRED`) | Fold into P1B's new function |
| Only the server can create bookings | Public RPCs still granted to anon (`022` kept the grants) | `025_public_rpcs_service_role.sql` | P1B covers it |
| Rate limits on sends and bookings | None | `028_rate_limits.sql` (Postgres `hit_rate_limit`) | Use P1B's mechanism |
| Phone codes: OTP over WhatsApp, SMS fallback for +91 (MSG91), hashed codes, unit tests | None | Not in P1B | **Unique to this handoff**; port after P1B |
| WhatsApp/SMS booking confirmation; `notified` in the API response | None | Not in P1B | **Unique**; port after P1B |
| "Unverified" tag (`reservations.phone_verified`) | None | No | The `wave-1.0` admin already shows it whenever the column exists |
| Menu PDF (`restaurants.menu_pdf_url` + `restaurant-menus` bucket) | None | No | Admin uploader is in `wave-1.0` and stays hidden until the column exists; the patch's `015` is still needed, renumbered |

## Files

| File | What |
|---|---|
| `backend-handoff.md` | What the patch adds, rollout order, MSG91/Meta/DLT setup, limits, what was and wasn't tested |
| `plan-guest-booking-backend.md` | The plan it was built from |
| `guest-booking-backend.patch` | The full patch (16 files). Env var names only, no secrets. |
| `optional-email.patch` | An earlier, smaller patch (optional email only), superseded by `main`'s `016` |
| `booking-ux-research.md` | Guest booking UX research (District/Zomato, Swiggy Dineout, OpenTable, Resy, Foodiv, Dribbble/Behance) and the decisions made from it |
| `react-bits-accordion-gallery.md` | Notes on the accordion gallery component used in `/experiment` |
