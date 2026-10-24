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

## Layout

```
src/app/                 routes (public site, (booking) flows, admin, api)
src/components/          ui / sections / layout / admin components
src/lib/supabase/        server/browser clients and queries
supabase/migrations/     SQL migrations, applied in order (never edit an applied one)
docs/                    design docs
```

## Docs

- `docs/RESERVATIONS.md`: restaurant reservation architecture, allocation algorithm, launch blockers, EazyDiner integration plan
- `docs/RESERVATIONS-PLAN.md`: phased backend plan for a production reservation system (Angels & Searchers)
- `TODO.md`: remaining work across the project
