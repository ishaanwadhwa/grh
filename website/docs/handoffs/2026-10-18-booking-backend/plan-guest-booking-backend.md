# Guest booking backend: implementation plan

**Goal:** the backend for the new guest booking flow. It covers:
- a menu PDF per restaurant
- optional email
- OTP on WhatsApp with an SMS fallback for +91
- a WhatsApp/SMS confirmation after booking
- an "Unverified" tag in admin
- closing the direct database path that let bookings skip the website's checks

**Architecture:**
- The branching logic lives in two dependency-free modules: `lib/otp.ts` holds the rules and `lib/msg91.ts` the provider calls. Both are checked with Node's built-in test runner against a fake `fetch`.
- The route handlers are thin glue around Supabase. They use the service-role client, which is server only.
- Everything is delivered as one patch against the UI session's working copy and checked with `git apply --check`. Nothing is applied to the live database without the user's OK.

**Tech:** Next.js 16 route handlers (standard `POST(request: Request)`; the client IP comes from `x-forwarded-for`), Supabase (Postgres plus Storage), MSG91 v5 APIs, `node:crypto`.

## Global constraints

**OTP rules**
- 6-digit code, valid for 10 minutes.
- 30 seconds between sends, at most 3 sends per phone per 15 minutes, at most 10 sends per IP per hour.
- 5 wrong tries per code.
- A successful check returns a token valid for 15 minutes.

**Phone numbers**
- +91 needs 10 digits starting 6–9.
- Other country codes need 6–14 digits.
- The country code must match `^\+\d{1,4}$`.
- SMS goes to +91 only.

**Feature switch:** `NEXT_PUBLIC_RESERVATION_OTP === "on"`. When it's off, behaviour matches today except that email is optional, `phone_verified` stays NULL, and confirmations still go out if MSG91 is configured.

**`phone_verified` values**
- `true`: the code was checked.
- `false`: the switch is on, but a non-+91 guest booked without a code.
- `NULL`: not checked (switch off, walk-ins, older bookings).

**Errors** are returned as `{ error, code }`.

**Environment variables** (no secrets in `NEXT_PUBLIC_*` except the public business number):
- `MSG91_AUTH_KEY`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `MSG91_WA_NAMESPACE`
- `MSG91_WA_OTP_TEMPLATE`
- `MSG91_WA_BOOKING_TEMPLATE`
- `MSG91_WA_LANGUAGE` (default `en`)
- `MSG91_SMS_OTP_FLOW_ID`
- `MSG91_SMS_BOOKING_FLOW_ID`
- `OTP_TOKEN_SECRET`
- `NEXT_PUBLIC_RESERVATION_OTP`

## Files

| File | Change |
|---|---|
| `supabase/migrations/014_reservation_contact_and_verification.sql` | New. Adds `phone_verified`, redefines the booking function (optional email, `p_phone_verified`), and makes it callable by the service role only |
| `supabase/migrations/015_restaurant_menu_pdf.sql` | New. Adds `restaurants.menu_pdf_url` and a PDF-only public bucket that only admins can write to |
| `supabase/migrations/016_phone_verifications.sql` | New. Verification rows (phone, IP, channel, code hash, attempts, timestamps), RLS on with no policies |
| `src/lib/otp.ts` | New. Phone rules, code and hash, token sign/verify, send and verify decisions, reservation verification rule, confirmation channel |
| `src/lib/msg91.ts` | New. `sendWhatsAppTemplate`, `sendSmsFlow`: timeout, error detection, `false` when not configured |
| `src/lib/otp.check.ts` | New. `node:test` checks with a fake `fetch` |
| `src/app/api/otp/send/route.ts`, `src/app/api/otp/verify/route.ts` | New |
| `src/app/api/reservations/route.ts` | Service-role client, OTP rule, `phone_verified`, confirmation, error codes |
| `src/lib/supabase/queries.ts`, `src/lib/data/schema.ts` | `menuPdfUrl` on `Restaurant` |
| `src/components/admin/PdfUploader.tsx`, `src/app/admin/restaurants/[id]/page.tsx` | "Menu (PDF)" field |
| `src/app/admin/service/page.tsx`, `src/app/admin/reservations/page.tsx` | "Unverified" tag where `phone_verified === false` |

## Tasks

Each task ends with a verify checkpoint.

1. **Migration 014.** Copy the function from 005 and change only the email check, the stored email value and `p_phone_verified`. Drop the old 11-argument signature. Grant to `service_role`, and revoke from `PUBLIC`, `anon` and `authenticated`.
   *Verify:* a diff against 005's function shows only the intended lines.
2. **`lib/otp.ts` and `lib/msg91.ts` with checks.**
   *Verify:* `node --test` on the compiled checks passes. The checks cover:
   - phone rules
   - the code hash
   - token signing, tampering, expiry and phone mismatch
   - the cooldown and limits
   - wrong, expired and locked codes
   - the reservation rule
   - the confirmation channel
   - the MSG91 payload shape
   - a 200 response that is really an error
   - the timeout
   - "not configured"
3. **Migration 016 and the OTP routes.**
   *Verify:* `tsc --noEmit` over the project passes.
4. **Reservations route.**
   *Verify:* `tsc` passes, and the rule and channel checks from task 2 cover the branches.
5. **Menu PDF (migration 015, uploader, admin field, `menuPdfUrl`).**
   *Verify:* `tsc` passes.
6. **Admin "Unverified" tag.**
   *Verify:* `tsc` passes.
7. **Package.** One patch built from `grh-base` and `grh-work`, then the handoff notes (environment variables, MSG91 and Meta setup, template texts).
   *Verify:* `git apply --check` against the UI session's copy passes.

**Not covered:** the routes aren't run end to end, because there's no local Supabase and no MSG91 credentials. The SQL hasn't been executed (no local Postgres).
