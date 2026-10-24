# Reservations API Contract

The contract the customer UI builds against. Backed by shared TS types in
`src/lib/reservations/types.ts`. Background: `RESERVATIONS.md`. Plan:
`RESERVATIONS-PLAN.md`.

**Status:** P0 draft · **Last updated:** 2026-10

Every endpoint below has a **status** label:

- **live** — the route exists today. Where its current response differs from
  the contract documented here, that's called out under "Live vs contract"
  for that endpoint; the fix lands in P1 (see `RESERVATIONS-PLAN.md` Phase P1).
- **planned P1** — does not exist yet. Documented now so the UI can be built
  against the final shape; wire-up is a P1 task.

All request/response bodies are JSON. All endpoints are under `/api/reservations`.

---

## Standard error format

Every error response (once P1 lands) uses:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "That time was just booked. Please choose another available time." } }
```

`code` is a stable machine-readable string from the table below; `message` is
safe to show to a guest. TS type: `ApiErrorBody` in `src/lib/reservations/types.ts`.

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body/query failed basic validation (missing/malformed field). |
| `RESTAURANT_NOT_FOUND` | 404 | The restaurant slug doesn't exist or isn't active. |
| `SERVICE_NOT_FOUND` | 404 | The service id doesn't exist, isn't active, or doesn't belong to the restaurant. |
| `SLOT_UNAVAILABLE` | 409 | The requested date/time no longer has a free table, is outside opening hours, doesn't align to the service's slot interval, or is in the past. |
| `POLICY_VIOLATION` | 422 | Request violates a restaurant booking policy (lead time, advance window, required phone/email). See `restaurant_booking_policies` (P0 schema, enforced in P1). |
| `RATE_LIMITED` | 429 | Too many requests from this IP/phone. Planned P1. |
| `INVALID_TOKEN` | 404 | The manage token doesn't match any reservation (wrong, expired, or already rotated). |
| `RESERVATION_NOT_FOUND` | 404 | No reservation matches the given id (admin routes/RPCs). |
| `CANCELLATION_WINDOW_PASSED` | 422 | Guest tried to cancel/modify inside `cancellation_cutoff_minutes` of the booking. |
| `FORBIDDEN` | 403 | Caller isn't allowed to perform this action (e.g. non-admin calling a staff-only RPC). |
| `CONFLICT` | 409 | A retried request with the same `Idempotency-Key` but a different body, or another non-slot conflict. |
| `INTERNAL_ERROR` | 500 | Unexpected server error. Logged server-side; never leaks internals to the client. |

**Today (live routes):** errors are `{ "error": "<human string>" }` with no
`code`, and status codes are a subset of the above (400/404/409/500 — see
each endpoint's "Live vs contract" note). The UI should not depend on the new
envelope until the P1 migration note below is resolved.

---

## `GET /api/reservations/availability`

**Status:** live

Public. Returns bookable `(service, time)` pairs for a party size on a date.
Never exposes tables or guest data.

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
    { "serviceId": "b2b9...", "serviceName": "Dinner", "time": "19:00" },
    { "serviceId": "b2b9...", "serviceName": "Dinner", "time": "19:30", "requiresApproval": true }
  ]
}
```

`requiresApproval` (planned P1): `true` when the party size is above that
service's `large_party_threshold`, meaning `POST /api/reservations` would
create a `pending` reservation instead of an instant `confirmed` one.

### Errors

| Code | When |
|---|---|
| `VALIDATION_ERROR` | Missing/malformed `restaurant`, `date`, or `partySize`. |
| `INTERNAL_ERROR` | The availability RPC failed. |

### Live vs contract

- Today's error body is `{ "error": "Restaurant, date, and party size are required." }` (400) or `{ "error": "Could not check availability. Please try again." }` (500) — no `code` field. **P1 migration note:** wrap in `{ error: { code, message } }`.
- `requiresApproval` is never present today (no policy enforcement yet). **P1 migration note:** add once `restaurant_booking_policies.large_party_threshold` is read by the availability RPC.
- Response shape (`{ slots: [...] }`) and slot fields otherwise match the live route exactly today — no change needed there.

---

## `POST /api/reservations`

**Status:** live (response/body differences — see below)

Public. Creates a reservation for an open slot.

### Request

Headers: `Idempotency-Key` (planned P1) — a client-generated UUID; retrying
the same key returns the original result instead of creating a duplicate.

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
  "specialRequests": "Window table if possible"
}
```

`guestPhone`/`guestPhoneCode`/`isWhatsApp`/`specialRequests` are optional.

### Response `201`

TS type: `CreateReservationResponse`.

```json
{ "id": "f0b1...", "status": "confirmed", "manageToken": "8f3c1e2a..." }
```

`status` is `pending` when the booking needs staff approval (large party —
P1 policy enforcement). `manageToken` is the **raw**, one-time token for the
guest's manage link (`/reserve/manage/<token>`, UI-owned route); only its
sha256 hash is stored (`reservations.manage_token_hash`).

### Errors

| Code | When |
|---|---|
| `VALIDATION_ERROR` | Missing/malformed field (name, email format, date/time format, party size out of range). |
| `RESTAURANT_NOT_FOUND` | Unknown/inactive restaurant slug. |
| `SLOT_UNAVAILABLE` | Service/hours/interval mismatch, past date, or no table free (race lost). |
| `POLICY_VIOLATION` | Below `min_lead_minutes`, beyond `max_advance_days`, or a required phone/email is missing. Planned P1. |
| `RATE_LIMITED` | Too many attempts from this IP/phone. Planned P1. |
| `CONFLICT` | Same `Idempotency-Key`, different body. Planned P1. |
| `INTERNAL_ERROR` | Unexpected failure. |

### Live vs contract

- Today's success response is `{ "reservation": { "id": "<uuid>" } }` with status `201` and no `status` or `manageToken` field. **P1 migration note:** change to `{ id, status, manageToken }`; generate and hash the manage token when the reservation is created.
- Today's error body is `{ "error": "<string>" }`, no `code`. Status codes already used: `400` (validation), `404` (restaurant), `409` (slot taken), `500` (other). **P1 migration note:** adopt `{ error: { code, message } }`.
- `Idempotency-Key` is not read today. **P1 migration note:** store it (new table or column) and short-circuit retries.
- No rate limiting or CAPTCHA today — tracked as a P1 launch blocker in `RESERVATIONS.md` §3, not specific to this contract.

---

## `GET /api/reservations/manage/{token}`

**Status:** planned P1

Public (token-gated, not session-gated). Returns a booking summary for the
guest to view, with no internal/staff data.

### Request

Path param `token`: the raw manage token from the create response. The
server looks it up by `sha256(token) = reservations.manage_token_hash`.

### Response `200`

TS type: `ManageReservationSummary`.

```json
{
  "id": "f0b1...",
  "restaurantName": "Angels & Searchers",
  "status": "confirmed",
  "date": "2026-11-01",
  "time": "19:00",
  "partySize": 4,
  "guestName": "Asha Rao",
  "specialRequests": "Window table if possible",
  "canCancel": true,
  "canModify": true
}
```

`canCancel`/`canModify` are `false` once the booking is inside
`cancellation_cutoff_minutes` of its start time, or already
`completed`/`cancelled`/`no_show`.

### Errors

| Code | When |
|---|---|
| `INVALID_TOKEN` | Token doesn't match any reservation. |

---

## `POST /api/reservations/manage/{token}/cancel`

**Status:** planned P1

Public (token-gated). Cancels the booking if outside the cancellation cutoff.

### Request

No body.

### Response `200`

TS type: `CancelReservationResponse`.

```json
{ "id": "f0b1...", "status": "cancelled" }
```

### Errors

| Code | When |
|---|---|
| `INVALID_TOKEN` | Token doesn't match any reservation. |
| `CANCELLATION_WINDOW_PASSED` | Inside `cancellation_cutoff_minutes`, or already completed/cancelled/no-show. |

---

## `POST /api/reservations/manage/{token}/modify`

**Status:** planned P1

Public (token-gated). Changes date/time/party size; re-runs the full
availability check server-side (same rules as creating a new booking) before
applying the change.

### Request

Body, TS type `ModifyReservationRequest` (all fields optional, at least one required):

```json
{ "date": "2026-11-02", "time": "20:00", "partySize": 5 }
```

### Response `200`

TS type: `ModifyReservationResponse` (= `ManageReservationSummary`).

### Errors

| Code | When |
|---|---|
| `VALIDATION_ERROR` | No fields provided, or malformed date/time/party size. |
| `INVALID_TOKEN` | Token doesn't match any reservation. |
| `CANCELLATION_WINDOW_PASSED` | Inside `cancellation_cutoff_minutes` (same cutoff governs modify and cancel). |
| `SLOT_UNAVAILABLE` | The new date/time/party size has no free table. |
| `POLICY_VIOLATION` | New request breaks a booking policy (lead time, advance window). |

---

## P1 migration notes (summary)

Collected from the "Live vs contract" sections above, for whoever picks up P1:

1. Wrap every error response in `{ error: { code, message } }`; retire the bare-string error bodies in both live routes.
2. Change `POST /api/reservations`'s success body to `{ id, status, manageToken }`; generate the raw token, store only its sha256 hash, and return the raw token exactly once.
3. Read `restaurant_booking_policies` in both the availability RPC (to set `requiresApproval`) and the booking RPC (to enforce lead time/advance window/required contact fields/large-party → `pending`).
4. Accept and persist `Idempotency-Key` on `POST /api/reservations`; short-circuit retries.
5. Implement the three `manage/[token]` routes and their underlying RPCs (token lookup by hash, cancel, modify-with-recheck).
6. Add rate limiting/CAPTCHA to `POST /api/reservations` (launch blocker, see `RESERVATIONS.md` §3).
