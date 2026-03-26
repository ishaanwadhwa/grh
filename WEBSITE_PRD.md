# GOOD ROOM HOUSE — Website PRD

**Version:** 0.1 (Draft)
**Last Updated:** 2026-03-26

---

## 1. Purpose

The Good Room House website is the **digital front door** of the brand. It should do three things:

1. **Seduce** — Make people feel something the moment they land. This is a design-forward brand; the website must reflect that instantly.
2. **Convert** — Let people browse properties, book stays, reserve tables, and pay — seamlessly.
3. **Build community** — Give people a reason to create an account, come back, and feel like insiders.

The website is NOT a generic hotel booking site. It should feel like an extension of the physical spaces — intimate, curated, slightly unexpected.

---

## 2. User Types

### 2.1 Guest (Not Logged In)
- Can browse everything: properties, rooms, restaurants, events
- Can view availability and pricing
- Must sign up / log in to book or reserve

### 2.2 Member (Logged In)
- Can book stays and make restaurant reservations
- Can manage their bookings (view, modify, cancel)
- Can view booking history
- Has a profile (name, contact, preferences)
- May receive early access to events or new properties (future)

### 2.3 Admin (Internal — Phase 2)
- Manages properties, rooms, availability, pricing
- Views and manages bookings/reservations
- Admin panel is a separate concern — not part of the public website MVP

---

## 3. Sitemap & Pages

### 3.1 Home / Landing Page
**Purpose:** First impression. Set the mood. Drive exploration.

**Content:**
- Hero section — full-bleed visual (video or high-res imagery), brand tagline
- Brief brand story — what Good Room House is (pulled from brand DNA)
- Featured properties — card-based preview of locations (Jaipur first)
- Featured restaurants — visual tease
- Upcoming events or community highlights (if available)
- Newsletter signup / CTA to explore
- Footer with links, social, contact

**Feel:** Editorial, cinematic, minimal text, maximum visual impact.

---

### 3.2 Properties (Browse All)
**Purpose:** Show all Good Room House locations at a glance.

**Approach:** The homepage highlights one featured property (Jaipur at launch). A separate Properties page lists all locations — even if there's only one initially, it establishes the multi-property brand structure from day one. Reference: [Sacred House](https://www.sacredhouse.com.tr/en) for the editorial, immersive property presentation style.

**Content:**
- Grid/list of all properties with:
  - Hero image
  - Location
  - Short description
  - CTA → View Property
- Filter/sort by location (future, when multiple properties exist)

---

### 3.3 Individual Property Page
**Purpose:** Deep dive into a specific location. This is where desire is built.

**Content:**
- Property hero — immersive gallery (carousel or scroll-based)
- Property story — what makes this place special, its personality
- Rooms section:
  - Each room as a card with:
    - Name / identity
    - Gallery (multiple images)
    - Description (personality, not just specs)
    - Key details (capacity, bed type, size, amenities)
    - Price per night
    - Availability indicator
    - CTA → Book This Room
- Amenities & features (pool, common areas, etc.)
- Location info — map, getting there, nearby highlights
- On-site restaurants (link to restaurant pages)
- Guest reviews / testimonials (future)

---

### 3.4 Booking Flow
**Purpose:** Take the user from "I want this room" to "It's booked."

**Steps:**
1. **Select dates** — Check-in / check-out date picker with availability
2. **Select room** — If coming from property page, room may be pre-selected. Otherwise, show available rooms for selected dates.
3. **Guest details** — Number of guests, any special requests
4. **Login / Signup** — If not logged in, prompt here (don't block browsing earlier)
5. **Review & Pay** — Order summary, pricing breakdown (room rate × nights, taxes, fees), payment input
6. **Confirmation** — Booking confirmed, confirmation number, email sent

**Pricing:** Prices are shown only after date selection — not publicly listed on room cards.

**Currency Support:** INR, USD, GBP. Currency selector available in the booking flow.

**Key Principles:**
- Minimal steps, minimal friction
- Show total price early — no surprise fees at checkout
- Mobile-first — most users will book on phone
- Payment via Razorpay or Stripe (decision needed based on India focus)

---

### 3.5 Restaurants
**Purpose:** Showcase the dining experiences. Drive footfall and reservations.

**Content:**
- Overview of all restaurants under the brand
- Each restaurant gets its own section/page:
  - Hero imagery
  - Story / concept
  - Menu highlights (not full menu — curated visuals)
  - Vibe description (music, crowd, energy)
  - Location & hours
  - CTA → Reserve a Table
- Gallery (food, interiors, people)

---

### 3.6 Restaurant Reservation Flow
**Purpose:** Book a table.

**Steps:**
1. Select restaurant
2. Select date & time
3. Party size
4. Login / Signup (if not logged in)
5. Special requests (optional)
6. Confirmation

**Note:** No payment required for table reservations (unless policy changes). Just a booking hold.

---

### 3.7 Events / Community (MVP)
**Purpose:** Showcase upcoming events, past highlights, and the community layer.

**Content:**
- Upcoming events (dinners, concerts, gatherings)
- Past event gallery / recaps
- CTA to RSVP or express interest
- Potentially gated content for logged-in members (future)

**Note:** Launches at MVP. Can start simple and evolve — but the page exists from day one. Social media links (Instagram, etc.) live in the site footer and About page, not here.

---

### 3.8 About / Story
**Purpose:** Tell the brand story. Introduce the founder. Build emotional connection.

**Content:**
- The "why" behind Good Room House
- Founder story — personal, visible, opinionated (per brand DNA)
- Philosophy & values
- Visual storytelling (images of the team, the build process, the spaces)

---

### 3.9 Contact Us
**Purpose:** Simple way to reach the team.

**Content:**
- Contact form (name, email, subject, message)
- Email address
- Phone number (optional — brand decision)
- Social media links
- Location(s) with map embed
- FAQ section (optional, can add later)

---

### 3.10 Account / Profile
**Purpose:** Logged-in user's personal space.

**Content:**
- Profile info (name, email, phone, photo)
- Upcoming bookings (stays + restaurant reservations)
- Past bookings / history
- Edit profile
- Logout

---

### 3.11 Auth Pages
**Purpose:** Login and signup.

**Methods:**
- Google Sign-In (primary)
- Email + password (secondary)
- Apple Sign-In (optional, nice-to-have)
- OTP / magic link (optional, consider for mobile)

**Principles:**
- Fast — minimal fields at signup (name, email, done)
- Social login preferred — reduce friction
- Don't ask for info you don't need yet

---

## 4. Feature Priority (MVP vs. Later)

### MVP (Phase 1) — Launch
| Feature | Priority |
|---|---|
| Home / Landing page | Must have |
| Individual Property page (Jaipur) | Must have |
| Room browsing with details | Must have |
| Booking flow (date → room → pay) | Must have |
| Auth (Google + email) | Must have |
| Payment integration | Must have |
| Booking confirmation (on-site + email) | Must have |
| Account / Profile with bookings | Must have |
| Restaurant pages | Must have |
| Restaurant reservation flow | Must have |
| Contact Us page | Must have |
| About / Story page | Must have |
| Mobile responsive | Must have |
| Properties browse page | Must have |
| Events / Community page | Must have |
| Multi-currency (INR, USD, GBP) | Must have |

### Phase 2
| Feature | Priority |
|---|---|
| Unified Operations Dashboard (all channels) | High |
| OTA channel manager integration (Booking.com, Airbnb, etc.) | High |
| Admin panel (manage rooms, availability, bookings) | High |
| Guest reviews / testimonials | Medium |
| Newsletter integration | Medium |
| Multi-property support (new locations) | High |
| Apple Sign-In | Low |
| Loyalty / repeat guest perks | Low |

---

## 5. Design Direction

### Principles
- **Visual-first** — Large imagery, minimal UI chrome, let the spaces speak
- **Editorial feel** — More magazine than booking engine
- **Whitespace is a feature** — Breathe. Don't crowd.
- **Typography-led** — Strong typeface choices carry the brand voice
- **Motion with purpose** — Subtle animations, scroll-triggered reveals, not gimmicks
- **Single design language** — One consistent visual mode throughout. No dark/light toggle. The palette will be defined by design references.

### References
- [Sacred House](https://www.sacredhouse.com.tr/en) — Editorial, immersive property presentation. Each room has distinct personality. Rich visual storytelling.
- _More to be added — user will share additional design references._

### Brand Consistency
- Tone of voice on the website = same as Instagram: witty, self-aware, slightly irreverent
- No stock photos. Ever. All imagery should feel real, shot with taste.
- The website should feel like it was designed by the founder, not a committee.

---

## 6. Technical Considerations (Pre-Decision)

These will be decided in the **Tech Stack Decision** phase:

| Decision | Options to Evaluate |
|---|---|
| Frontend framework | Next.js / Astro / Remix |
| Styling | Tailwind CSS / CSS Modules / Styled Components |
| Backend | Next.js API routes / Separate Node/Express API / Supabase |
| Database | PostgreSQL / Supabase / PlanetScale |
| Auth | NextAuth.js / Supabase Auth / Clerk |
| Payments | Razorpay (India-first) / Stripe |
| CMS (for content) | Sanity / Contentful / Headless WordPress / None (hardcoded) |
| Hosting | Vercel / AWS / Railway |
| Email | Resend / SendGrid / AWS SES |

---

## 7. Unified Operations Funnel (Phase 2)

Room bookings will come from multiple channels — the website, Booking.com, Airbnb, MakeMyTrip, etc. Restaurant reservations come from the website. The operations team needs **one place to see everything**.

**Architecture:**
- Website bookings (rooms + restaurants) → flow directly into our database
- OTA bookings (Booking.com, Airbnb, etc.) → synced via a **channel manager** (e.g., Cloudbeds, Little Hotelier, or custom API integrations)
- **Unified Operations Dashboard** = single source of truth for all bookings across all channels

**What the dashboard shows:**
- All room bookings (website + OTAs) in one calendar view
- All restaurant reservations
- Booking status (confirmed, pending, cancelled)
- Guest details and contact info
- Revenue by channel
- Availability sync (prevent double-bookings across platforms)

**MVP implication:** The database schema must be designed from day one to support multi-channel bookings, even though the dashboard itself is Phase 2. Every booking record should have a `source` field (website, booking.com, airbnb, walk-in, etc.).

---

## 8. Open Questions

### Resolved
| Question | Decision |
|---|---|
| Properties page at launch | Featured property on homepage + separate Properties page |
| Events page at MVP | Build it for MVP |
| Dark/light mode | Single design language throughout, no toggle |
| Restaurant reservations | Custom-built |
| Pricing display | Shown after date selection only |
| Multi-currency | INR, USD, GBP |

### Still Open
1. **Cancellation policy** — What are the rules? Needs to be displayed in booking flow.
2. **Admin panel** — Build custom or use a service like Sanity/Strapi for content management?
3. **Analytics** — Google Analytics / Mixpanel / PostHog / Plausible?
4. **Channel manager** — Which OTAs to integrate with first? Which channel manager service?

---

## 9. Success Metrics (Website-Specific)

- **Conversion rate** — Visitors → Bookings
- **Bounce rate** — Are people staying or leaving?
- **Average session duration** — Are people exploring?
- **Booking completion rate** — How many people start vs. finish a booking?
- **Mobile vs. desktop split** — Informs design priority
- **Repeat visits** — Are people coming back?
- **Restaurant reservation volume** — Is the site driving table bookings?
