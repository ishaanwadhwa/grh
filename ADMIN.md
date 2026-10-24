# Admin panel: guide and changelog

Read this before changing anything under `website/src/app/admin` or `website/src/components/admin`.

## Where things stand (2026-10-25)

- **Branch:** `wave-1.0`, built on `main` @ `68bc976` (after reservations P0 and P1A). It's a separate branch and isn't merged; nothing has gone into `main`. What the whole branch contains (public site, admin, handoffs): `WAVE-1.0.md`.
- **Booking backend:** it is `main`'s.
  - Read `website/docs/RESERVATIONS*.md`, the agent briefs (P1B is next) and `src/lib/reservations/` before changing statuses, sources or how bookings and tables change.
  - The admin goes through `main`'s booking-engine RPCs; see Conventions.
- **`main`'s P1A admin tools are carried into this design:**
  - `NewBookingPanel` (restyled, logic unchanged);
  - table suggestions;
  - `set_reservation_tables` with override;
  - unassign;
  - flagged bookings.
  - They come from commit "Port main's P1A booking tools into the redesigned admin".
- **The backend session's handoff** (OTP, WhatsApp/SMS, `phone_verified`, `menu_pdf_url`) is **not applied**. It's kept in `website/docs/handoffs/2026-10-18-booking-backend/`, with a table of what P1B already covers.
  - The admin copes without it: "Unverified" tags and the Menu (PDF) field don't show until those columns exist.

## Database rollout (needs the owner's OK; never run against live Supabase on your own)

- `040_restaurant_public_page.sql` is the only migration in this branch.
  - It's numbered 040 because `main` is at `023` and P1B plans `024`–`030`. A clashing number wouldn't show up as a git conflict, only as a failure when migrations run, so renumber to the next free number at merge time if needed.
  - It contains only `ADD COLUMN IF NOT EXISTS`, so it's safe to run any time and to re-run.
  - Until it runs, the new restaurant fields show read-only and Save keeps working.

## Map

| Route | Job |
|---|---|
| `/admin` | Overview: today first (bookings, needs a table, seated, check-ins) |
| `/admin/service` | **Live floor**: bookings queue + floor map or table cards; suggested tables, seat/hold/unassign (with "anyway" override), walk-ins, new bookings, finish |
| `/admin/reservations` | Every table booking by day; call, cancel, new booking. Table work happens only on the live floor ("Find a table" deep-links there) |
| `/admin/bookings` | Room bookings |
| `/admin/restaurants` → `/[id]` · `/[id]/availability` · `/[id]/floorplan` | Restaurant Details · Booking hours · Floor plan (tabs via `RestaurantHeader`) |
| `/admin/properties` → `/[id]` · `/[id]/rooms` · `/rooms/[roomId]` | Property Details · Rooms (tabs via `TabsHeader`) |
| `/admin/events`, `/admin/users` (Team), `/admin/settings`, `/admin/login` | as named |

| File | Holds |
|---|---|
| `src/app/admin/admin.css` | Every admin style. Tokens and parts are scoped to `.adm` in `@layer components`, so a Tailwind utility on the same element wins. |
| `src/components/admin/ui.tsx` | `PageHeader`, `TabsHeader`, `RestaurantHeader`, `StatusTag`, `Toggle`, `SwitchRow`, `Stepper`, `Sheet`, `Empty`, `Loading`, `useNotice`, `useEscape`, `Chevron`/`Close` (DLS glyph paths), and the `fmtDate`/`fmtDay`/`fmtTime`/`fmtMoney`/`plural`/`todayIn`/`nowIn`/`slugify`/`sourceLabel` helpers |
| `src/components/admin/floor.tsx` | Shared by the floor plan and the live floor: `loadFloor`, `FloorFrame`, `FloorTable` (table with chair pills), `TableCard`, `RoomItems`, `FloorKey`, `ZoomButtons`, `contentBox`/`zoomBox`/`panBox`/`clampBox`, plus `WITH_TABLES`/`tablesOf`/`needsTable`/`ENDED` for bookings on tables |
| `src/components/admin/NewBookingPanel.tsx` | `main`'s P1A staff booking panel (phone/EazyDiner/other; auto, manual or no table). Restyled on the kit; logic unchanged |
| `src/components/admin/AdminShell.tsx` | Nav (Today / Set up / Admin), one admin check per visit, Agentation in dev |
| `src/components/admin/FormField.tsx` | Field with the label above; `group` for anything that isn't a single input |

## Design rules (slice DLS 2.0 anatomy, public-site palette)

- **Colour:** warm paper page, petrol ink text, tomato red for the one main action, and status tints for tags. Table states are `--t-free`, `--t-booked`, `--t-arrived`, `--t-seated`, `--t-idle` and `--t-off` (top, chairs, ink). Never hard-code a colour; add a token.
- **Type:** Young Serif for page titles, Schibsted Grotesk for everything else, weights 400/500 only, and Pinyon Script for the wordmark only.
- **Parts:**
  - pill buttons: one `btn-primary` per view; destructive actions use `btn-danger` text or the `ConfirmDialog` with a neutral confirm, never a red fill;
  - 16px cards with shadow, never a border or grey fill;
  - underlined inputs with the label above;
  - pills (`aria-pressed`/`aria-current`) for filters and tabs, never underlined tabs;
  - green switches on the trailing edge;
  - `StatusTag` for every state chip;
  - one bottom snackbar per page.
- **Copy:**
  - sentence case; CTAs start with a verb ("Seat at T4", "Save changes");
  - absolute dates ("18 Oct '26", "Sun, 18 Oct"), 12-hour times;
  - money as ₹1,00,000;
  - no emoji, and no hand-drawn icons.

## Conventions (do this, not that)

- **Supabase:** use `createClient()` from `@/lib/supabase/client`. It's a browser singleton, so it's safe to call per render and to list in deps. Never `createBrowserClient(...)` inline.
- **Messages:**
  - `const { say, fail, snackbar } = useNotice()`, then render `{snackbar}` once.
  - `fail(error)` takes a Supabase error and turns 23503 / 23505 into plain words.
  - Check `error` on every write, and update local state only on success.
- **Edit pages:** if loading the record fails, show `Empty` with an error. A blank form can be saved over the real row.
- **Forms:** use `<FormField group>` around uploaders, steppers and pill groups. With a `<label>`, a click on the label "clicks" the first button inside, which once deleted a photo.
- **Bookings and tables:**
  - **change them only through `main`'s booking engine:**
    - `suggest_tables` for the best tables;
    - `set_reservation_tables(p_reservation_id, p_table_ids, p_allow_override)` to assign or unassign;
    - `create_staff_reservation` (via `NewBookingPanel`) for phone/EazyDiner bookings;
    - `create_walkin_reservation` for walk-ins;
  - never write `reservation_table_assignments` directly, and never use the old `assign_reservation_tables`;
  - show engine errors with `friendlyError()` from `src/lib/reservations/adminErrors.ts`. When `overridable` is true, offer "… anyway", which retries with `p_allow_override = true`;
  - `needs_attention` / `attention_reason` come from the engine. Flagged bookings belong under "Needs a table"; `StatusTag` knows the reasons;
  - select with `` `*, ${WITH_TABLES}` `` so tables arrive with the booking;
  - use `tablesOf(row)`, `needsTable(row, ids)` and `ENDED`/`ENDED_FILTER`. Don't hand-roll status lists.
- **Deep link to the live floor:** `/admin/service?restaurant=<id>&date=YYYY-MM-DD&booking=<id>` opens that booking. Reservations uses it for "Find a table" and "Open on floor".
- **Time:** `todayIn(tz)` / `nowIn(tz)` with the restaurant's `timezone`.
- **React Compiler lint:** don't put `try … finally` in components; it silently turns off compiler checks for the whole component.

## Run and check locally

```bash
cd website && npm run dev        # /admin needs a real admin login (the proxy guards it)
npx tsc --noEmit -p .
npx eslint src/app/admin src/components/admin
```

On a network that inspects TLS (a corporate proxy), start the dev server with `NODE_EXTRA_CA_CERTS=<corporate CA .pem>`, or the server-side Supabase calls (the proxy, `/api/admin/check`) fail and sign-in loops.

## Known gaps / next steps

- **Public site:** it doesn't read the 040 fields yet. `src/app/experiment/content.ts` still hard-codes them. `mapRestaurant` already returns `area`, `tagline`, `google`, `host`, etc.
- **Floor:**
  - On a rotated table the resize dot sits off the corner, because the resize maths ignores rotation.
  - Dragging redraws the whole page. That's fine at ~20 tables; memoise the table layer if floors get big.
  - There's no search or status/area filter on the live floor yet (tables are grouped by area instead).
  - Table suggestions are fetched when you pick a booking with no table. A booking that has a table but is flagged gets no automatic suggestion; staff tap tables and press "… anyway" if the engine refuses.
- **Data:**
  - A room-booking cancel blocked by row-level security returns no error and changes 0 rows, so it looks like it worked. Add `.select()` and check the row count.
  - `ImageUploader` skips failed uploads silently.
  - Photo alt text can't be edited. The menu is a PDF only; there's no dish editor.
- **Admin email domains are hard-coded in 4 places:** `login/page.tsx`, `users/page.tsx` (twice), and `api/admin/users/route.ts`.
- **Migration checks:** once `040` (and the menu PDF column, if the handoff lands) is live everywhere, delete the column checks in `restaurants/[id]/page.tsx` (`hasPublicFields`, `hasMenuPdf`, `PUBLIC_FIELDS`).
- **Statuses:** `ENDED` and `needsTable` in `floor.tsx` and `StatusTag` in `ui.tsx` hand-list reservation statuses. `main` now has `RESERVATION_STATUSES` and `RESERVATION_SOURCES` in `src/lib/reservations/types.ts`; switch to those.
- **`NewBookingPanel`** still builds its own client with `createBrowserClient(...)` (`main`'s code, left alone so the restyle stays presentation-only). Switch it to `createClient()` the next time its logic changes.

## Changelog

### 2026-10-25: `wave-1.0` (on `main` @ `68bc976`)

The admin part of `wave-1.0` (the full list is in `WAVE-1.0.md`):

1. **Admin design kit:** `admin.css` tokens and DLS parts, the site's fonts, the grouped nav, `ui.tsx` primitives, `useNotice`, `FormField group`, and `PdfUploader`.
2. **Live floor and floor plan:** shared `floor.tsx`; tables drawn with chairs; a bookings queue with a map or card grid and one action bar; the editor with Tables and Room modes and autosave.
3. **Floor plan save checks** carried over from `main`'s `2a960c8`.
4. **Restaurant page fields:** migration `040`, the type mapping, and a regrouped Details page.
5. **All other pages** on the kit, with simpler hierarchy and safer saves.
6. **`main`'s P1A booking tools** in the new design: New booking, suggestions, set/unassign tables with override, flagged bookings, and the deep link.
7. **`NewBookingPanel` restyled** on the kit, logic untouched.
   - Errors and "Book anyway" now sit next to Confirm, so they stay in view.
   - The success message uses 12-hour time.
   - The selected guest showed a literal `·`; that's fixed.

Earlier cuts of the admin work, `feat/admin-redesign` on `6973d1b` and then on `3b35ffc`, are replaced by this branch.
