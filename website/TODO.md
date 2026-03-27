# GOOD ROOM HOUSE — Remaining Work

**Last Updated:** 2026-03-26

---

## Backend / Services (Not Yet Wired)

### Supabase (Database + Auth)
- [ ] Create Supabase project
- [ ] Set up database tables matching `src/lib/data/schema.ts`
- [ ] Migrate mock data to real database
- [ ] Replace mock imports in API routes with Supabase queries
- [ ] Set up Row Level Security (RLS) policies
- [ ] Configure Google OAuth provider
- [ ] Configure email/password auth
- [ ] Wire `src/lib/supabase/client.ts` and `server.ts` with real env vars
- [ ] Add auth checks to booking/reservation API routes

### Razorpay (Payments)
- [ ] Create Razorpay account (test mode)
- [ ] Replace `src/app/api/payments/route.ts` stub with real Razorpay SDK
- [ ] Implement payment signature verification in `/api/payments/verify`
- [ ] Add Razorpay checkout modal to booking review page
- [ ] Handle payment failures and retries
- [ ] Set up webhook endpoint for async payment confirmations
- [ ] Test multi-currency support (INR/USD/GBP)

### Resend (Email)
- [ ] Create Resend account and verify domain
- [ ] Build booking confirmation email template (React Email)
- [ ] Build reservation confirmation email template
- [ ] Build cancellation notification email
- [ ] Wire email sending into booking and reservation API routes
- [ ] Add welcome email on signup

### Sanity CMS
- [ ] Create Sanity project
- [ ] Install Sanity Studio (had esbuild issues — retry or use standalone)
- [ ] Define schemas: Property, Room, Restaurant, Event
- [ ] Migrate hardcoded content to Sanity
- [ ] Replace mock data reads with Sanity GROQ queries
- [ ] Set up image pipeline (Sanity CDN)

---

## Frontend — UI Only (Backend Not Wired)

### Restaurant Reservation (Inline)
- `src/components/sections/InlineReservation.tsx` — UI is built
- Currently hits mock `/api/reservations` endpoint
- [ ] Wire to real Supabase database
- [ ] Add auth check (require login before confirming)
- [ ] Add real-time table availability checking
- [ ] Send confirmation email on successful reservation

### Room Booking Flow
- Full UI flow exists (`/book` → `/book/details` → `/book/review` → `/book/confirmation`)
- Currently uses mock data and mock payments
- [ ] Wire to real Supabase database
- [ ] Wire to real Razorpay payments
- [ ] Add auth gate at guest details step
- [ ] Send confirmation email on successful booking
- [ ] Handle concurrent booking conflicts (optimistic locking)

### Contact Form
- `src/app/contact/page.tsx` — UI is built
- [ ] Wire form submission to Resend or a form service
- [ ] Add spam protection (honeypot or reCAPTCHA)

### Newsletter Signup
- `src/components/sections/NewsletterSignup.tsx` — UI is built
- [ ] Wire to email service (Resend audience, Mailchimp, or Supabase table)

---

## Auth Pages (Not Yet Built)

- [ ] `/login` — Login page (Google + email/password)
- [ ] `/signup` — Registration page
- [ ] `/account` — User profile + booking history
- [ ] Auth redirect flow (login → return to previous page)
- [ ] Protected routes (booking details, account page)

---

## Dynamic Pricing Service (Future)

The pricing API (`/api/pricing`) is designed as a gateway:
- **Currently:** Returns `basePricePerNight × nights + 18% GST`
- **Phase 2:** Add seasonal multipliers
- **Phase 3:** External microservice (Python/FastAPI) with ML model

Data to capture from day one (via analytics, not DB):
- User agent / device type
- Booking lead time
- Search patterns (dates, rooms viewed)
- Currency selected
- Time of booking
- Returning vs. new user

---

## Operations Dashboard (Phase 2)

- [ ] Admin panel for managing properties, rooms, availability
- [ ] Unified booking view (website + OTA channels)
- [ ] Channel manager integration (Booking.com, Airbnb, MakeMyTrip)
- [ ] Revenue reporting by channel
- [ ] Availability calendar with double-booking prevention

---

## Zoho CRM Integration (Phase 2)

Integration point for newsletters, guest management, and Members Club communication.

- [ ] Set up Zoho CRM account + API credentials
- [ ] Newsletter signup → create Zoho CRM contact (tag: "newsletter")
- [ ] Booking confirmed → create Zoho CRM contact + deal (tag: "guest", link booking data)
- [ ] Reservation confirmed → create Zoho CRM contact (tag: "diner")
- [ ] Sync phone number + WhatsApp flag to Zoho contact fields
- [ ] Members Club segmentation via custom tags/pipeline (visit count, last stay, preferences)
- [ ] Zoho Campaigns integration for email marketing (event invites, new property announcements)
- [ ] WhatsApp Business integration via Zoho for booking confirmations & guest communication
- [ ] Contact form submissions → Zoho CRM lead

---

## Polish & QA

- [ ] Replace all placeholder images with real photography
- [ ] Mobile responsiveness QA across all pages
- [ ] SEO metadata on all pages
- [ ] Open Graph images for social sharing
- [ ] 404 page design
- [ ] Loading states and skeleton screens
- [ ] Error boundary components
- [ ] Accessibility audit (keyboard nav, screen reader, contrast)
- [ ] Performance audit (Core Web Vitals)
