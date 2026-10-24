# Good Room House — Website

Next.js 16 (App Router) site for properties, restaurants and events, with an
admin panel and restaurant table reservations, backed by Supabase.

## Stack

- **Next.js 16 / React 19 / Tailwind 4.** Read `node_modules/next/dist/docs/` before relying on older Next.js knowledge (see `AGENTS.md`).
- **Supabase:** Postgres, auth, storage. Schema lives in `supabase/migrations/`.
- **Resend** (email), **Razorpay** (payments, still stubbed), **Sanity** (CMS, not yet wired).
- Deployed on Vercel.

## Getting started

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Open http://localhost:3000. The admin panel is at `/admin`.

> Local dev talks to the **live** Supabase. Submitting the reserve/book forms creates real rows.

Behind a corporate proxy that inspects TLS, Node needs the proxy's root certificate, or every Supabase call fails with `SELF_SIGNED_CERT_IN_CHAIN`. Export that certificate as a `.pem` file and point Node at it:

```bash
NODE_EXTRA_CA_CERTS=/path/to/proxy-root-ca.pem npm run dev
```

## Layout

```
src/app/(site)/          public site (shared nav + footer in (site)/layout.tsx), incl. (booking) flows
src/app/experiment/      Angel and the Searchers restaurant page (self-contained fonts, CSS, content.ts)
src/app/admin/           admin panel (see ../ADMIN.md)
src/app/api/             API routes
src/components/          ui / sections / layout / admin components
src/lib/supabase/        server/browser clients and queries
supabase/migrations/     SQL migrations, applied in order (never edit an applied one)
docs/                    design docs
```

## Where to change things (public UI)

| What | Where |
|---|---|
| Colors, fonts, shadows | `src/app/globals.css` (`@theme` block) |
| Nav + footer (every public page) | `src/components/layout/`, wired in `src/app/(site)/layout.tsx` |
| A page | `src/app/(site)/<route>/` |
| Home page sections | `src/components/sections/` |
| Shared bits (Button, DatePicker, RoomCard…) | `src/components/ui/` |

Pages that show database content are split in two:

- `page.tsx` fetches the data on the server. Leave it alone.
- `view.tsx` is the UI. It gets the data as props. Edit or replace it freely.

Pages with no data (events, housemakers, contact) are just `page.tsx`.

A new design only has to accept the same props; the backend doesn't change:

- **Data shapes:** `src/lib/data/schema.ts` (`Property`, `Room`, `Restaurant`, …)
- **Reads:** `src/lib/supabase/queries.ts` (server only, call from `page.tsx`)
- **Writes / interactive:** `/api/*` (`availability`, `pricing`, `bookings`, `reservations`, `payments`)

## Docs

- `../ADMIN.md`: admin panel guide (design kit, conventions, rollout, known gaps)
- `../WAVE-1.0.md`: what the `wave-1.0` branch contains and where each part came from
- `docs/RESERVATIONS.md`: restaurant reservation architecture, allocation algorithm, launch blockers, EazyDiner integration plan
- `docs/RESERVATIONS-PLAN.md`: phased backend plan for a production reservation system (Angels & Searchers)
- `TODO.md`: remaining work across the project
