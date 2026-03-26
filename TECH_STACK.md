# GOOD ROOM HOUSE — Tech Stack

**Version:** 0.1 (Draft)
**Last Updated:** 2026-03-26

---

## Recommendation Summary

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router)** | SSR for SEO, React ecosystem, API routes, image optimization |
| Styling | **Tailwind CSS + Framer Motion** | Rapid design iteration + polished animations |
| Backend | **Next.js API Routes + Supabase** | Unified codebase, Supabase handles DB + Auth + Storage |
| Database | **PostgreSQL (via Supabase)** | Relational, perfect for bookings, battle-tested |
| Auth | **Supabase Auth** | Google + email out of the box, pairs naturally with Supabase DB |
| Payments | **Razorpay** | India-first, supports international cards, UPI, multi-currency |
| CMS | **Sanity** | Visual editing for ops team, flexible content models, real-time |
| Hosting | **Vercel** | Native Next.js support, CDN, serverless, zero-config deploys |
| Email | **Resend** | Modern API, great templates, developer-friendly |
| Analytics | _To be decided_ | See open question in PRD |

---

## Detailed Reasoning

### Frontend — Next.js 15 (App Router)

**Why Next.js:**
- **SEO matters** — People will Google "boutique resort Jaipur." SSR/SSG gives us fast, crawlable pages.
- **Image optimization** — `next/image` handles responsive images, lazy loading, and format conversion. Critical for a visual-first site with heavy photography.
- **App Router** — Server components reduce client JS bundle. Layouts, loading states, and parallel routes are built in.
- **API routes** — Backend logic lives in the same codebase. No separate server to manage for MVP.
- **Ecosystem** — Largest React framework community. Every library works with it.

**Why not Astro:** Great for static sites, but Good Room House has dynamic flows (bookings, auth, payments). Astro's island architecture adds friction for interactive pages.

**Why not Remix:** Solid framework, but smaller ecosystem, less hosting flexibility, and Next.js has stronger momentum and tooling.

---

### Styling — Tailwind CSS + Framer Motion

**Tailwind CSS:**
- Utility-first means fast iteration on design
- Design tokens (colors, spacing, typography) live in `tailwind.config` — one source of truth
- No CSS-in-JS runtime cost
- Responsive design is trivial (`md:`, `lg:` prefixes)
- Works perfectly with component-based architecture

**Framer Motion:**
- The site needs to *feel* design-forward. Static pages won't cut it.
- Scroll-triggered animations, page transitions, hover effects, gallery interactions
- Declarative API that pairs cleanly with React
- Not a gimmick layer — used with restraint to add polish

**Why not CSS Modules:** More verbose, harder to maintain design consistency at scale.
**Why not Styled Components:** Runtime CSS-in-JS adds bundle size and performance cost. Not worth it when Tailwind exists.

---

### Backend — Next.js API Routes + Supabase

**Architecture:**
```
Browser → Next.js (Vercel) → Supabase (DB + Auth + Storage)
                            → Razorpay (Payments)
                            → Sanity (CMS Content)
                            → Resend (Emails)
```

**Why this split:**
- **Next.js API routes** handle business logic: booking flow, payment callbacks, reservation logic
- **Supabase** handles infrastructure: database, auth, file storage (room images, etc.), real-time subscriptions (future: live availability)
- No separate backend server to deploy and manage
- Scales automatically on Vercel's serverless infra

**Why not a separate Express/Node API:** Overhead. For MVP, API routes in Next.js are sufficient. If the backend grows complex (Phase 2 admin panel, channel manager integrations), we can extract to a separate service later.

---

### Database — PostgreSQL (via Supabase)

**Why PostgreSQL:**
- Relational data model is a natural fit:
  - Properties → Rooms → Bookings → Payments
  - Restaurants → Time Slots → Reservations
  - Users → Bookings + Reservations
- ACID transactions for payment/booking integrity
- JSON columns for flexible metadata (room amenities, special requests)
- Mature, proven, scales well

**Why via Supabase:**
- Managed Postgres — no ops burden
- Built-in Row Level Security (RLS) — secure by default
- Auto-generated REST and GraphQL APIs (useful for quick reads)
- Dashboard for the team to inspect data without SQL
- Realtime subscriptions (future: live availability updates)
- Storage buckets for images/files

**Key Schema Considerations (from PRD):**
- Every booking has a `source` field (`website`, `booking_com`, `airbnb`, `walk_in`, etc.) — designed for the unified ops funnel from day one
- Multi-currency: prices stored in base currency (INR) with conversion at display time
- Soft deletes for bookings (never hard delete financial records)

---

### Auth — Supabase Auth

**Why Supabase Auth:**
- Already using Supabase for DB — no extra service to manage
- Google Sign-In: built-in, one config
- Email + password: built-in, with email verification
- Session management handled automatically
- Row Level Security integrates directly with auth — e.g., "users can only see their own bookings"
- Easy to add Apple Sign-In later

**Why not NextAuth.js:** Great library, but adds a dependency when Supabase Auth already does everything we need. One less thing to configure and maintain.

**Why not Clerk:** Polished UI, but paid service. Supabase Auth is free at our scale and keeps all user data in our own Postgres.

---

### Payments — Razorpay

**Why Razorpay:**
- **India-first** — Supports UPI, net banking, wallets, credit/debit cards natively
- **International cards** — Supports Visa, Mastercard, Amex for USD/GBP transactions
- **Multi-currency** — Can accept payments in INR, USD, GBP
- **Razorpay Payment Links** — Useful for manual/walk-in bookings
- **Subscription support** — If membership tiers come later
- **Indian compliance** — GST invoicing, RBI guidelines handled
- **Good docs and SDKs** for Node.js/React

**Why not Stripe:** Stripe is excellent internationally but has friction for Indian payments (UPI support is limited, onboarding is slower for Indian businesses). Razorpay is the better primary for an India-first brand. Stripe can be added as a secondary gateway later for pure international transactions if needed.

**Payment Flow:**
1. User completes booking form
2. Backend creates Razorpay order with amount + currency
3. Frontend opens Razorpay checkout (modal or redirect)
4. On success → Razorpay sends webhook → backend confirms booking
5. Confirmation email sent via Resend

---

### CMS — Sanity

**Why Sanity:**
- The ops/marketing team needs to update content without touching code:
  - Property descriptions, room details, amenities
  - Restaurant menus, hours, stories
  - Event listings
  - Blog posts / stories (future)
  - Homepage featured content
- **Sanity Studio** — Custom-built editing dashboard, embeddable or standalone
- **Real-time collaboration** — Multiple editors can work simultaneously
- **Flexible schemas** — Define exactly the content models we need
- **Image pipeline** — Built-in image CDN with on-the-fly transformations (crop, resize, format)
- **GROQ query language** — Powerful, flexible content queries
- **Free tier** is generous for MVP

**Why not Contentful:** More rigid content models, pricing scales worse.
**Why not Headless WordPress:** Overkill, security surface area, slower.
**Why not hardcoded:** Not sustainable. Content will change frequently — menus, events, room availability descriptions. The team shouldn't need a developer to update the lunch menu.

**What lives in Sanity vs. Supabase:**
| Sanity (Content) | Supabase (Transactional Data) |
|---|---|
| Property descriptions & stories | User accounts |
| Room descriptions, galleries, amenities | Bookings & payments |
| Restaurant menus & stories | Reservations |
| Event listings & recaps | Availability & pricing |
| About page content | Session data |
| Homepage featured content | Booking history |

---

### Hosting — Vercel

**Why Vercel:**
- Built by the Next.js team — zero-config deployment
- Edge network / CDN — fast globally (matters for international guests)
- Serverless functions — API routes scale automatically
- Preview deployments — every PR gets a live URL for review
- Analytics built in (optional)
- Generous free tier, reasonable scaling costs

**Why not AWS:** Overkill for MVP. More to configure, more to manage. Can migrate later if needed.
**Why not Railway:** Good for backend services, but Vercel is the natural home for Next.js.

---

### Email — Resend

**Why Resend:**
- Modern API, clean DX
- React Email — build email templates with React components (consistent with our frontend stack)
- Reliable delivery
- Simple pricing
- Use cases:
  - Booking confirmation
  - Reservation confirmation
  - Payment receipts
  - Welcome email on signup
  - Cancellation notices

**Why not SendGrid:** Works fine, but older API, more complex setup.
**Why not AWS SES:** Cheapest at scale, but more config. Can switch later if email volume justifies it.

---

## Project Structure (Proposed)

```
goodroom/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (marketing)/        # Public pages (home, about, contact)
│   │   ├── (booking)/          # Booking flow pages
│   │   ├── (auth)/             # Login, signup
│   │   ├── (account)/          # User profile, booking history
│   │   ├── properties/         # Property browse + detail pages
│   │   ├── restaurants/        # Restaurant pages
│   │   ├── events/             # Events page
│   │   └── api/                # API routes
│   ├── components/             # Shared UI components
│   │   ├── ui/                 # Base components (buttons, inputs, modals)
│   │   ├── layout/             # Header, footer, navigation
│   │   └── sections/           # Page sections (hero, property card, etc.)
│   ├── lib/                    # Utilities and service clients
│   │   ├── supabase/           # Supabase client + helpers
│   │   ├── razorpay/           # Payment integration
│   │   ├── sanity/             # Sanity client + queries
│   │   └── resend/             # Email templates + sender
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript type definitions
│   └── styles/                 # Global styles + Tailwind config
├── sanity/                     # Sanity Studio + schemas
├── public/                     # Static assets
├── supabase/                   # Supabase migrations + seed data
├── BRAND.MD
├── WEBSITE_PRD.md
├── TECH_STACK.md
└── package.json
```

---

## Key Technical Decisions

### TypeScript — Yes
The entire codebase will be TypeScript. Type safety across booking flows, payment handling, and API routes prevents bugs that cost money (double bookings, wrong prices, failed payments).

### Monorepo — No (for now)
Single Next.js project. No need for a monorepo until we have a separate admin panel or mobile app. Keep it simple.

### Testing Strategy
- **Unit tests:** Vitest for utility functions, booking logic, price calculations
- **Integration tests:** Booking flow, payment webhook handling
- **E2E tests:** Playwright for critical user flows (browse → book → pay → confirm)
- **Not at MVP launch** — Tests will be added progressively. Ship first, harden after.

### Environment Setup
- **Local dev:** `next dev` + Supabase local (Docker) + Sanity Studio local
- **Staging:** Vercel preview branch + Supabase staging project
- **Production:** Vercel production + Supabase production project

---

## Cost Estimate (MVP / Month)

| Service | Free Tier | Paid Estimate |
|---|---|---|
| Vercel | Hobby free | Pro ~$20/mo |
| Supabase | Free tier (500MB DB, 50K auth users) | Pro ~$25/mo |
| Sanity | Free tier (generous) | ~$0 at MVP scale |
| Razorpay | No monthly fee | 2% per transaction |
| Resend | 3,000 emails/mo free | ~$20/mo if exceeded |
| Domain | — | ~$10-15/year |
| **Total at MVP** | | **~$50-75/mo + payment processing** |

This is extremely lean. Costs scale with usage, not upfront.
