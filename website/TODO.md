# SUNDAY ROSE CLUB — Remaining Work

**Last Updated:** 2026-07

See `docs/RESERVATIONS.md` (design) and `docs/RESERVATIONS-PLAN.md` (phased
backend plan) for restaurant reservations.

---

## Done

- Supabase project wired up (`src/lib/supabase/*`); schema in `supabase/migrations/001`–`013`
- Admin panel (`/admin`): login, self-service password reset, users, properties/rooms,
  restaurants, events, bookings, settings
- Restaurant reservations backend: services/hours/date overrides, floor plan editor,
  collision-safe table assignment, availability and booking RPCs
- Admin reservations list with table assignment, live service floor (`/admin/service`)
  with arrived/seated/complete/no-show and walk-ins
- Customer reservation flow (`/reserve`, `InlineReservation`) calls the real API
- Room availability/booking API routes read and write Supabase via `src/lib/supabase/queries.ts`

---

## Restaurant Reservations — Public Launch

- [ ] **Angels data fix:** all 16 tables are `max_capacity = 2`, so parties of 3+ get no online slots
- [ ] Business: dedicated WhatsApp number + Meta Business verification (blocks WhatsApp)
- [ ] Business: trial EazyDiner LiveTable, set allotment to match hold-back

- [ ] Abuse protection: revoke `anon` on `create_restaurant_reservation`, call via
      service-role in the API route, add rate limiting + Turnstile
- [ ] Reservation confirmation email (Resend)
- [ ] Guest manage link (cancel / modify)
- [ ] Admin form for future phone/external bookings (not just walk-ins)
- [ ] Max covers per slot (kitchen pacing)
- [ ] Table combinations for large parties
- [ ] Online hold-back (tables / % of covers reserved for walk-ins and partners)
- [ ] Party-size-based seating duration
- [ ] Integrate new customer UI (in progress — flatmate) and QA end to end

### EazyDiner
- [ ] `import_external_reservation` / `cancel_external_reservation` RPCs (idempotent on
      `source + external_reference`, never reject for capacity)
- [ ] Conflict flag in admin when an imported booking has no free table
- [ ] Manual "Add external booking" form
- [ ] Inbound email parser for EazyDiner confirmations/cancellations
- [ ] Ask EazyDiner about a partner API

---

## Room Booking Flow

- Full UI flow exists (`/book` → `/book/details` → `/book/review` → `/book/confirmation`)
- [ ] Real Razorpay payments (`/api/payments` and `/api/payments/verify` are still stubs; review page uses mock payment)
- [ ] Payment failure/retry handling + webhook for async confirmations
- [ ] Multi-currency test (INR/USD/GBP)
- [ ] Booking confirmation + cancellation emails
- [ ] Concurrent booking conflict protection (equivalent of the restaurant exclusion constraint)
- [ ] Tighten RLS on `bookings` (001 still allows public read/insert)
- [ ] Property detail page still uses mock data (`src/app/properties/[slug]/page.tsx`)

---

## Other Integrations

### Resend (Email)
- [ ] Verify domain
- [ ] Templates: booking confirmation, reservation confirmation, cancellation, welcome

### Sanity CMS
- [ ] Create project + Studio, define schemas (Property, Room, Restaurant, Event)
- [ ] Decide Sanity vs Supabase as source of truth for content (admin panel currently edits Supabase)

### Contact & Newsletter
- [ ] Contact form submission (Resend) + spam protection
- [ ] Newsletter signup → Resend audience / Zoho

---

## Customer Auth (Not Yet Built)

- [ ] `/login`, `/signup`, `/account` (booking history)
- [ ] Decide whether reservations require login (currently guest checkout)

---

## Dynamic Pricing (Future)

`/api/pricing` currently returns `basePricePerNight × nights + 18% GST`.
Phase 2: seasonal multipliers. Phase 3: external pricing service.

---

## Operations / Channels (Phase 2)

- [ ] Hotel channel manager (Booking.com, Airbnb, MakeMyTrip)
- [ ] Revenue reporting by channel
- [ ] Zoho CRM: contacts from bookings/reservations/newsletter, WhatsApp, Members Club segmentation

---

## Polish & QA

- [ ] Real photography, mobile QA, SEO metadata, OG images
- [ ] 404 page, loading states, error boundaries
- [ ] Accessibility + Core Web Vitals audit
