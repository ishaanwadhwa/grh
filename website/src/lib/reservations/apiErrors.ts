import "server-only";

// Shared { error, code } response format and database-error mapping for
// every /api/reservations* route (docs/agent-briefs/P1B-public-hardening.md
// task 8). `error` is always a plain-language string (unchanged shape from
// before P1B); `code` is new and additive -- see docs/RESERVATIONS-API.md.

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

// Every RPC in supabase/migrations/*.sql raises a bare message via
// `RAISE EXCEPTION USING MESSAGE = '<CODE>', ERRCODE = ...`, which
// PostgREST/supabase-js surfaces as error.message containing that code as a
// substring. Matching on substring (rather than parsing ERRCODE) keeps this
// list the single place that knows about every RPC error code, independent
// of which Postgres ERRCODE family each one happens to use.
//
// INVALID_TOKEN is deliberately renamed to the public code NOT_FOUND here:
// internally it's specific ("no reservation has this manage token"), but the
// guest-facing contract says any unknown/expired token is just "not found"
// (docs/agent-briefs/P1B-public-hardening.md task 7 note: "don't reveal
// anything else").
const DATABASE_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  SLOT_UNAVAILABLE: { status: 409, code: "SLOT_UNAVAILABLE", message: "That time was just booked. Please choose another available time." },
  RESTAURANT_NOT_FOUND: { status: 404, code: "RESTAURANT_NOT_FOUND", message: "Restaurant not found." },
  SERVICE_NOT_FOUND: { status: 404, code: "SERVICE_NOT_FOUND", message: "Choose a different service." },
  INVALID_RESERVATION: { status: 400, code: "VALIDATION_ERROR", message: "Please check the reservation details and try again." },
  CONTACT_REQUIRED: { status: 422, code: "CONTACT_REQUIRED", message: "Please provide the required contact details." },
  OUTSIDE_BOOKING_WINDOW: { status: 422, code: "OUTSIDE_BOOKING_WINDOW", message: "That date or time isn't bookable online right now." },
  CANCELLATION_CUTOFF_PASSED: { status: 422, code: "CANCELLATION_CUTOFF_PASSED", message: "This booking can no longer be changed online. Please call the restaurant directly." },
  INVALID_TOKEN: { status: 404, code: "NOT_FOUND", message: "That link is invalid or has expired." },
};

export function mapDatabaseError(message: string): ApiError {
  for (const [rpcCode, mapped] of Object.entries(DATABASE_ERROR_MAP)) {
    if (message.includes(rpcCode)) return mapped;
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
}

export function apiErrorResponse(error: ApiError): Response {
  return Response.json({ error: error.message, code: error.code }, { status: error.status });
}

export function apiError(status: number, code: string, message: string): Response {
  return apiErrorResponse({ status, code, message });
}

// Convenience wrappers for the handful of errors every route can hit outside
// any RPC call.
export const SERVICE_NOT_CONFIGURED = (): Response => apiError(503, "SERVICE_UNAVAILABLE", "Reservation service is not configured.");
export const RATE_LIMITED = (message = "Too many requests. Please slow down and try again shortly."): Response => apiError(429, "RATE_LIMITED", message);
export const NOT_FOUND = (message = "That link is invalid or has expired."): Response => apiError(404, "NOT_FOUND", message);
export const VALIDATION_ERROR = (message: string): Response => apiError(400, "VALIDATION_ERROR", message);
