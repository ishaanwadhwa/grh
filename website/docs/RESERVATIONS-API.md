# Reservations API Contract

The contract the customer UI builds against. Backed by shared TS types in
`src/lib/reservations/types.ts`. Background: `RESERVATIONS.md`. Plan:
`RESERVATIONS-PLAN.md`.

**Status:** P1B — all five endpoints below are **live**. Last updated: 2026-10
(`docs/agent-briefs/P1B-public-hardening.md`).

All request/response bodies are JSON. All endpoints are under `/api/reservations`.

> **Note for the UI developer:** the error envelope changed shape from the
> original P0 draft of this document (which nested `error` as an object). The
> format below — `error` stays the plain string it always was, `code` is a
> new sibling field — is what's actually implemented, chosen specifically so
> the existing customer UI (which already reads `error` as a string) keeps
> working without any change on its side. See "Response compatibility" below.

---

## Standard error format

```json
{ "error": "That time was just booked. Please choose another available time.", "code": "SLOT_UNAVAILABLE" }
```

- `error`: a plain-language, guest-safe string. **Unchanged shape** from before P1B — it was always a string, and still is.
- `code`: **new in P1B**, additive. A stable machine-readable string from the table below. Absent on the pre-P1B error bodies that predate this field existing in production, so UI code should not assume it's always present on every historical log line, but every error from the current deployment includes it.

TS type: `ApiErrorBody` in `src/lib/reservations/types.ts`.

### Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body/query failed basic validation (missing/malformed field, or an invalid JSON body). |
| `RESTAURANT_NOT_FOUND` | 404 | The restaurant slug doesn't exist or isn't active. |
| `SERVICE_NOT_FOUND` | 404 | The service id doesn't exist, isn't active, or doesn't belong to the restaurant. |
| `NOT_FOUND` | 404 | The manage token doesn't match any reservation (wrong, expired, or already used by a different flow). Deliberately generic — see `GET /manage/{token}`. |
| `SLOT_UNAVAILABLE` | 409 | The requested date/time no longer has a free table, is outside opening hours, doesn't align to the service's slot interval, is in the past, or (for `modify`) the new slot doesn't work. |
| `CONTACT_REQUIRED` | 422 | The restaurant's policy requires a phone and/or email that wasn't provided. |
| `OUTSIDE_BOOKING_WINDOW` | 422 | Below the restaurant's `min_lead_minutes`, or beyond its `max_advance_days`. |
| `CANCELLATION_CUTOFF_PASSED` | 422 | Too close to the booking's start time to cancel or modify it online (`cancellation_cutoff_minutes`), or the booking is no longer in a cancellable state. |
| `RATE_LIMITED` | 429 | Too many requests from this IP (all endpoints) or phone number (`POST /api/reservations` only). See "Rate limits" below. |
| `BOT_CHECK_FAILED` | 403 | Cloudflare Turnstile verification failed. Only possible when `TURNSTILE_SECRET_KEY` is configured — see "Bot protection" below. |
| `IDEMPOTENCY_KEY_REUSED` | 409 | The same `Idempotency-Key` was sent with a different request body. |
| `REQUEST_IN_PROGRESS` | 409 | The same `Idempotency-Key`'s first attempt hasn't finished yet (a near-simultaneous retry). |
| `SERVICE_UNAVAILABLE` | 503 | The server-side Supabase client isn't configured (missing env vars). Not expected in production. |
| `INTERNAL_ERROR` | 500 | Unexpected server error. Logged server-side; never leaks internals to the client. |

Implemented in `src/lib/reservations/apiErrors.ts`, which every route shares.

---

## Rate limits

Enforced in Postgres (`hit_rate_limit`, `supabase/migrations/028_rate_limits.sql`), checked with the server-side service-role client before any RPC call:

| Endpoint | Limit |
|---|---|
| `GET /api/reservations/availability` | 60 requests / minute / IP |
| `POST /api/reservations` | 5 requests / 10 minutes / IP, **and** 3 / day / normalised phone number |
| Every `POST`/`GET` under `/api/reservations/manage/[token]*` | 20 requests / minute / IP |

Client IP is read from `X-Forwarded-For` (first entry) or `X-Real-IP`, falling back to `"unknown"` if neither is present (`src/lib/reservations/clientIp.ts`). Over the limit → `429` / `RATE_LIMITED`.

---

## Bot protection

`POST /api/reservations` verifies a `turnstileToken` field in the request body against [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)'s `siteverify` endpoint.

**This is only enforced when `TURNSTILE_SECRET_KEY` is set** in the server environment. The customer UI doesn't render the Turnstile widget or send a token yet, so until that ships and the key is configured, this check is a no-op. Once both are in place: a missing or invalid token → `403` / `BOT_CHECK_FAILED`.

---

## Idempotency

`POST /api/reservations` accepts an optional `Idempotency-Key` header (any client-generated unique string, e.g. a UUID).

- **No header:** behaves exactly as if this feature didn't exist — every request is processed fresh. This is the only mode the customer UI needs to use until it's ready to adopt the header.
- **Same key, same body:** the first request is processed normally; every subsequent request with that key is replayed verbatim (same status code and body) without re-running validation, rate limits, Turnstile, or the booking RPC. Safe to retry on a network timeout.
- **Same key, different body:** `409` / `IDEMPOTENCY_KEY_REUSED`.
- **Same key, concurrent retry before the first finishes:** `409` / `REQUEST_IN_PROGRESS`.

Backed by `api_idempotency_keys` (`supabase/migrations/029_idempotency.sql`); keys expire after 24 hours.

---

## `GET /api/reservations/availability`

**Status:** live

Public (service-role only at the database level — see "Response compatibility"). Returns bookable `(service, time)` pairs for a party size on a date. Never exposes tables or guest data.

### Request

Query string:

| Param | Type | Required | Notes |
|---|---|---|---|
| `restaurant` | string | yes | Restaurant slug. |
| `date` | string | yes | `YYYY-MM-DD`. |
| `partySize` | integer | yes | 1–50. |

```
GET /api/reservations/availability?restaurant=angels-and-searchers&date=2026-11-01&partySize=4
```

### Response `200`

TS type: `AvailabilityResponse`.

```json
{
  "slots": [
    { "serviceId": "b2b9...", "serviceName": "Dinner", "time": "19:00", "requiresApproval": false },
    { "serviceId": "b2b9...", "serviceName": "Dinner", "time": "19:30", "requiresApproval": true }
  ]
}
```

A slot is only returned if it respects the restaurant's `min_lead_minutes`, `max_advance_days`, `last_seating_offset_minutes` and `max_covers_per_slot` policies, **and** some table option still leaves every unassigned staff booking seatable (the allocation engine, see `RESERVATIONS.md` §3).

`requiresApproval`: `true` when `party_size` is at/above the service's `large_party_threshold`, or the restaurant's `auto_confirm` policy is off — meaning `POST /api/reservations` for this slot/party will create a `pending` reservation (needs staff approval) rather than an instant `confirmed` one.

### Errors

| Code | When |
|---|---|
| `VALIDATION_ERROR` | Missing/malformed `restaurant`, `date`, or `partySize`. |
| `SERVICE_UNAVAILABLE` | Server misconfiguration. |
| `RATE_LIMITED` | See "Rate limits". |
| `INTERNAL_ERROR` | The availability RPC failed unexpectedly. |

---

## `POST /api/reservations`

**Status:** live

Public. Creates a reservation for an open slot.

### Request

Headers: `Idempotency-Key` (optional — see "Idempotency").

Body, TS type `CreateReservationRequest`:

```json
{
  "restaurantSlug": "angels-and-searchers",
  "serviceId": "b2b9...",
  "date": "2026-11-01",
  "time": "19:00",
  "partySize": 4,
  "guestName": "Asha Rao",
  "guestEmail": "asha@example.com",
  "guestPhone": "9876543210",
  "guestPhoneCode": "+91",
  "isWhatsApp": true,
  "specialRequests": "Window table if possible",
  "turnstileToken": "..."
}
```

`guestPhone`/`guestPhoneCode`/`isWhatsApp`/`specialRequests` are always optional. `guestEmail` is required unless the restaurant's `require_email` policy is off; `guestPhone` is required only if `require_phone` is on. `turnstileToken` is required only once Turnstile is enforced (see "Bot protection").

### Response `201`

TS type: `CreateReservationResponse`.

```json
{ "reservation": { "id": "f0b1...", "status": "confirmed", "manageToken": "8f3c1e2a..." } }
```

`reservation.id` is exactly where it was before P1B (unchanged). `status` and `manageToken` are **new, additive** fields:

- `status` is `"pending"` when the booking needs staff approval (large party, or the restaurant has `auto_confirm` off), otherwise `"confirmed"`.
- `manageToken` is the **raw**, one-time token for the guest's manage link (the customer UI owns the actual page, e.g. `/reserve/manage/<token>`). Only its sha256 hash is ever stored (`reservations.manage_token_hash`); the raw value is never logged and is returned exactly this once.

### Errors

| Code | When |
|---|---|
| `VALIDATION_ERROR` | Missing/malformed field (name, email format, date/time format, party size out of range, invalid JSON body). |
| `RESTAURANT_NOT_FOUND` | Unknown/inactive restaurant slug. |
| `SLOT_UNAVAILABLE` | Service/hours/interval mismatch, past date, or no table free (race lost, or an unassigned staff booking needs it). |
| `CONTACT_REQUIRED` | Restaurant policy requires a phone and/or email that wasn't provided. |
| `OUTSIDE_BOOKING_WINDOW` | Below `min_lead_minutes`, or beyond `max_advance_days`. |
| `BOT_CHECK_FAILED` | Turnstile verification failed (only when enforced). |
| `RATE_LIMITED` | See "Rate limits". |
| `IDEMPOTENCY_KEY_REUSED` / `REQUEST_IN_PROGRESS` | See "Idempotency". |
| `SERVICE_UNAVAILABLE` | Server misconfiguration. |
| `INTERNAL_ERROR` | Unexpected failure. |

---

## `GET /api/reservations/manage/{token}`

**Status:** live

Public (token-gated, not session-gated; rate limited — see "Rate limits"). Returns a booking summary for the guest to view, with no internal/staff data.

### Request

Path param `token`: the raw manage token from the create (or modify) response. The server hashes it (sha256) and looks it up by `reservations.manage_token_hash` — the raw token is never stored or logged.

### Response `200`

TS type: `ManageReservationSummary`.

```json
{
  "reservation": {
    "id": "f0b1...",
    "restaurantName": "Angels & Searchers",
    "restaurantSlug": "angels-and-searchers",
    "status": "confirmed",
    "date": "2026-11-01",
    "time": "19:00",
    "partySize": 4,
    "guestName": "Asha Rao",
    "specialRequests": "Window table if possible",
    "canCancel": true,
    "canModify": true
  }
}
```

No table, phone, email, or internal flag is ever included. `canCancel`/`canModify` are both `false` once the booking is inside `cancellation_cutoff_minutes` of its start time, or isn't `pending`/`confirmed` any more.

### Errors

| Code | When |
|---|---|
| `NOT_FOUND` | Token doesn't match any reservation. Deliberately the same code/message regardless of *why* — wrong, expired, mistyped, or belonging to a cancelled booking that's since been purged — so a guest can't learn anything by trying tokens. |
| `RATE_LIMITED` | See "Rate limits". |

---

## `POST /api/reservations/manage/{token}/cancel`

**Status:** live

Public (token-gated, rate limited). Cancels the booking if it's still `pending`/`confirmed` and outside the cancellation cutoff.

### Request

No body.

### Response `200`

TS type: `CancelReservationResponse`.

```json
{ "reservation": { "id": "f0b1...", "status": "cancelled" } }
```

### Errors

| Code | When |
|---|---|
| `NOT_FOUND` | Token doesn't match any reservation. |
| `CANCELLATION_CUTOFF_PASSED` | Inside `cancellation_cutoff_minutes`, or the booking is no longer `pending`/`confirmed` (already cancelled, completed, arrived, seated, or no-show). |
| `RATE_LIMITED` | See "Rate limits". |

---

## `POST /api/reservations/manage/{token}/modify`

**Status:** live

Public (token-gated, rate limited). Changes date, time and/or party size; re-runs the full policy and allocation check server-side (the same rules as `POST /api/reservations`, plus the cancellation cutoff) before applying the change. **Atomic:** on any error the booking is left completely unchanged — there's no partial move.

### Request

Body, TS type `ModifyReservationRequest` (all fields optional, at least one required — an omitted field keeps its current value):

```json
{ "date": "2026-11-02", "time": "20:00", "partySize": 5 }
```

### Response `200`

TS type: `ModifyReservationResponse` (= `ManageReservationSummary`, the full guest-safe summary after the change).

### Errors

| Code | When |
|---|---|
| `VALIDATION_ERROR` | No fields provided, or malformed date/time/party size. |
| `NOT_FOUND` | Token doesn't match any reservation. |
| `CANCELLATION_CUTOFF_PASSED` | Inside `cancellation_cutoff_minutes` of the **current** booking time, or it's no longer `pending`/`confirmed`. |
| `OUTSIDE_BOOKING_WINDOW` | The new date/time breaks `min_lead_minutes`/`max_advance_days`. |
| `SLOT_UNAVAILABLE` | The new date/time/party size has no free table (or breaks `max_covers_per_slot`/`last_seating_offset_minutes`/hours/interval). |
| `RATE_LIMITED` | See "Rate limits". |

A large party (at/above `large_party_threshold`) moved via modify can come back with `status: "pending"`, the same as a fresh booking.

---

## Response compatibility

Both live routes existed before P1B and are used by the current customer UI. Every change here is additive:

- `error` stayed a plain string; `code` was added alongside it, never replacing `error`.
- `POST /api/reservations`'s success body kept `reservation.id` exactly where it was; `status` and `manageToken` were added as new fields on the same `reservation` object.
- The availability response kept its exact `slots` shape; `requiresApproval` was added to each slot.
- Both routes moved from the anon-key client to a server-only service-role client (`src/lib/supabase/service.ts`); `get_available_restaurant_slots` and `create_restaurant_reservation` (the original functions) are revoked for `anon`/`authenticated` as of `025_public_rpcs_service_role.sql` and replaced by `create_public_reservation` as of `026_public_booking_v2.sql` — this is invisible to callers of the HTTP API, which never changed its own request/response shape because of it.
