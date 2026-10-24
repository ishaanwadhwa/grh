# Wave 1.0

Branch **`wave-1.0`**, built on `main` @ `68bc976` (reservations P0 + P1A).

It's a separate branch. **Nothing has gone into `main`**: the repo owner asked for all new work on fresh branches. It is built on the latest `main` so that merging later is clean.

## What's in it, in commit order

| # | Commit | Where it came from |
|---|---|---|
| 1 | **Public site:** `(site)` route group, the Angel and the Searchers page (`/experiment`), restaurant photos, moodboard | The "GRH project UI setup" session (uncommitted on its local `ui-simplify` since 2026-10-18), carried over as-is apart from a hand-merged README |
| 2 | **Admin design kit:** slice DLS 2.0 anatomy in the public site's palette | The admin redesign session |
| 3 | **Live floor and floor plan editor** on a shared floor kit (tables drawn with chairs) | Same |
| 4 | **Floor plan save checks** carried over from `main`'s `2a960c8` | Same |
| 5 | **Restaurant page fields:** migration `032` and the Details page | Same |
| 6 | **All other admin pages** on the kit (simpler hierarchy, safer saves) | Same |
| 7 | **`main`'s P1A booking tools** in the new design (New booking, suggestions, set/unassign with override, flagged bookings) | Ported from `main` (`c054b17`, `63355ca`, `e01e70d`) |
| 8 | **`NewBookingPanel` restyled** on the kit, logic untouched | `main`'s component |
| 9 | **Handoffs and explorations:** the booking-backend handoff (kept as documents, not applied), booking UX research, hero and layout studies | The "GRH portal backend access" session |
| 10 | **Notes:** this file, `ADMIN.md`, and pointers in `website/CLAUDE.md` and `website/README.md` | — |

## Where to read more

- `ADMIN.md`: the admin guide (design rules, kit, conventions, migration rollout, known gaps, changelog). Read it before touching `src/app/admin` or `src/components/admin`.
- `website/README.md`: running locally (including behind a corporate TLS proxy) and where to change the public UI.
- `website/docs/handoffs/2026-10-18-booking-backend/README.md`: what the unapplied booking handoff adds, and how each idea lines up with `main` and P1B.
- `website/docs/explorations/README.md`: the design studies.
- `website/docs/RESERVATIONS*.md` and `website/docs/agent-briefs/` (on `main`): the booking backend. P1B is next.

## Deliberately not included

- **The booking-backend patch, applied.** It rewrites `create_restaurant_reservation` and would undo `main`'s allocation engine. It's kept in `docs/handoffs/` for P1B to draw from: OTP and WhatsApp/SMS confirmation are the parts P1B doesn't cover.
- **Anything sensitive.** No `.env*` files, keys, tokens or certificates are committed. Docs name environment variables, never their values.
- **Local tooling.** The mock Supabase used for screenshots, the preview launch configs and `node_modules` stay out.

## Merged into `main` (2026-10-26)

Merged together with reservations P1B. What the merge did:
- `040_restaurant_public_page.sql` renumbered to **`032`**, after P1B's `024`–`031`.
- `package.json`: kept both sides (`server-only` from P1B; `gsap`/`lenis`/`three`/`agentation` from here); lock regenerated.
- `admin/service` and `admin/reservations`: took this branch's redesign and ported P1B's pending-request review into it.
  - **Live floor:** a "Requests" group, with Approve, "Approve, table later", Decline, and "Approve anyway" (`review_pending_reservation`).
  - **Reservations:** a Requests filter and count, "Review request" and Decline.
  - **`floor.tsx`:** `needsTable()` no longer counts `pending`, and there's a new `isRequest()`.
- The public booking API now treats email as optional; contact rules come from the restaurant's booking policy. So the booking UI can drop the placeholder `guest-…@no-email.invalid` email.

## Merge checklist (as written before the merge)

1. **Migrations.**
   - This branch adds only `website/supabase/migrations/040_restaurant_public_page.sql` (columns only, safe to re-run).
   - If `main` has a `040` by then, renumber it. Same-number files don't show up as a git conflict; they fail when migrations run.
2. **Dependencies.** `package.json` adds `gsap`, `lenis` and `three` (public site) and `agentation` (dev). Run `npm install`.
3. **Public routes moved** under `src/app/(site)/`. If `main` changed any public page in the meantime, apply that change to the moved file.
4. **Admin pages replaced** (`service`, `reservations`, `restaurants/[id]/floorplan`). If `main` changed those after `68bc976`, port the change into the new design. Commit 7 shows how P1A was carried over.
5. **Check with a real admin login** after merging:
   - **Live floor:** pick an unassigned booking (it should show a suggested table), then seat, hold and unassign.
   - **New booking:** the panel opens and creates a booking.
   - **Reservations:** "Find a table" opens the live floor on that booking.

## How it was checked

- Every commit type-checks on its own (`npx tsc --noEmit`). ESLint is clean on the admin.
- `main` was still at `68bc976` when this was pushed, so merging was a fast-forward.
- The public page (`/experiment`) and the admin run on the dev server. The admin and floor screens were checked by eye on real data before the P1A port: live floor (map and tables), floor plan editor, restaurants, events, reservations, overview, plus the phone width.
- **Not done yet; do both before merging:**
  - A full `npm run build`. On the machine this was made on, Turbopack couldn't download Google Fonts through a corporate TLS proxy. That's the network, not the code.
  - The real-login checks in step 5 of the merge checklist, for the P1A tools and the restyled New booking panel.
