# Guest booking backend: handoff

The patch is `guest-booking-backend.patch`, in this folder. It touches 16 files: 790 lines added, 19 removed. It has not been applied anywhere yet, and nothing has been run against the live Supabase.

## What it adds

| Area | Change |
|---|---|
| Optional email | Bookings need a phone **or** an email. A blank email is stored as `NULL`. |
| Security fix | Only the server can create bookings now (service-role key). Before this, anyone could call the booking function with the site's public key and skip the API's checks. |
| OTP | `POST /api/otp/send` and `/api/otp/verify`. WhatsApp first, SMS fallback for +91. Switched on by `NEXT_PUBLIC_RESERVATION_OTP=on`. |
| Booking API | Optional `otpToken`. The response adds `notified: "whatsapp" \| "sms" \| null` and `phoneVerified`. Every error now carries a `code`. |
| Confirmation | WhatsApp, or SMS for +91 guests who verified by SMS or aren't on WhatsApp. It never fails a booking. |
| Unverified tag | Shows in Admin → Floor service and Reservations when `phone_verified = false` (a foreign number booked without a code). |
| Menu PDF | Admin → Restaurant → "Menu (PDF)" (upload, replace, remove). `menuPdfUrl` is on `Restaurant` and is `null` when empty, so the UI can hide "See menu". |

## Apply the patch

From the repo root (`grh/`):

```bash
git apply website/docs/handoffs/2026-10-18-booking-backend/guest-booking-backend.patch
```

## Rollout order (no booking downtime)

1. Apply migrations **014, 015 and 016** to Supabase. Get the user's OK first.
   - 014 adds the new server-only booking function **next to** the old one, so the live site keeps working.
2. Make sure Vercel has `SUPABASE_SERVICE_ROLE_KEY` (the admin check already uses it) and `OTP_TOKEN_SECRET`. Generate the secret with `openssl rand -base64 32`.
3. Deploy the code.
4. Apply migration **017**. It removes the old booking function that anyone could call with the public key.
5. **Keep OTP off until the new booking flow replaces the old forms.** The old forms (`/reserve`, InlineReservation) have no code step, so with OTP on, +91 guests on those forms would get "Please verify your phone number."

## MSG91 and Meta setup (GRH has to do this; it can't be done for them)

**MSG91 account**
- Create an auth key and set it as `MSG91_AUTH_KEY`.
- Turn off the key's IP whitelist. Vercel's outgoing IPs change.

**WhatsApp**
- Connect the WhatsApp Business number in MSG91.
  - Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to digits with the country code, e.g. `9198XXXXXXXX`. The UI also uses it for the "Open WhatsApp" link.
  - Set `MSG91_WA_NAMESPACE` to the template namespace from MSG91.
  - Set `MSG91_WA_LANGUAGE` only if the templates aren't `en`.
- Meta allows **authentication (code) templates only for eligible, verified businesses**. Complete Meta business verification first.
- Templates:
  - **Authentication** template with a copy-code button → `MSG91_WA_OTP_TEMPLATE`. Meta fixes its text ("{{1}} is your verification code").
  - **Utility** template "booking confirmed" with 4 variables in this order: {{1}} name, {{2}} restaurant, {{3}} when ("Sat 24 Oct, 8:30 PM"), {{4}} guests → `MSG91_WA_BOOKING_TEMPLATE`.
    - Suggested text: "Hi {{1}}, your table at {{2}} is booked for {{3}} for {{4}}. Need to change anything? Just reply here."

**SMS (India, needs DLT registration: entity, sender ID, templates)**
- OTP flow with the variable `otp` → `MSG91_SMS_OTP_FLOW_ID`.
  - Suggested: "##otp## is your Sunday Rose Club booking code. It expires in 10 minutes."
  - Optional last line for Android auto-read: `@<site domain> ###otp##`.
- Booking flow with the variables `name`, `restaurant`, `when`, `guests` → `MSG91_SMS_BOOKING_FLOW_ID`.

Until these exist, everything still works. OTP stays off, no messages go out, and `notified` is `null`.

## Limits and rules

- 6-digit code, valid for 10 minutes.
- 30 seconds between sends, at most 3 codes per number per 15 minutes, at most 10 per IP per hour.
- 5 wrong tries per code.
- A successful check gives a 15-minute token.
- Codes are stored as keyed hashes. Verification rows older than a day are deleted.

## What was checked

- `node --test` passes all 8 checks:
  - phone rules, codes, rate limits
  - code checking (wrong, expired, locked)
  - tokens (tampered, expired, other phone)
  - which bookings need a code
  - the confirmation channel
  - the MSG91 payload against a fake MSG91, including a 200 response that is really an error, the timeout, and "not configured"
  - Two planted bugs were caught.
- Re-run from `website/`:

  ```bash
  npx tsc --module commonjs --target es2022 --types node --esModuleInterop --skipLibCheck --outDir /tmp/otp-test src/lib/otp.ts src/lib/msg91.ts src/lib/otp.test.ts && node --test /tmp/otp-test/
  ```

- `tsc --noEmit` passes for the whole project, and ESLint is clean on the changed files.
- `git apply --check` passes against the UI session's working copy.
- Migration 014's function was generated from migration 005's. A diff shows only the intended lines changed.

## What was not checked

- The routes haven't been run end to end, because there's no local Supabase and no MSG91 credentials.
- The SQL hasn't been executed (no local Postgres).
- The MSG91 WhatsApp payload follows MSG91's published OTP example. Compare it with the sample request MSG91's dashboard shows for each template before going live.

## Known shortcuts (each marked `ponytail:` in the code)

- The send rate limit counts rows first and inserts after, so a burst of parallel sends could slip one extra code through. Code *checking* is race-safe (compare-and-set on attempts).
- Old verification rows are purged on each send. Move this to a Vercel cron if the table gets busy.
- Replaced or removed menu PDFs stay in storage, so the live link never breaks before Save.
