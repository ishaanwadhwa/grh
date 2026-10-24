// ============================================
// Reservation system — shared types
// ============================================
// These mirror the CHECK constraints and tables added in
// supabase/migrations/014_*.sql onward. Keep them in sync with the
// migrations; this file (not src/lib/data/schema.ts) is the source of
// truth for reservation-system types. `src/lib/data/schema.ts` still
// defines `BookingSource`/`ReservationStatus` for the legacy mock data
// used by hotel bookings — do not change those from here.
//
// See docs/RESERVATIONS-API.md for the request/response contract these
// types back.

// --- Reservation core (014) ---

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "arrived",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_SOURCES = [
  "website",
  "phone",
  "walk_in",
  "eazydiner",
  "other",
] as const;

export type ReservationSource = (typeof RESERVATION_SOURCES)[number];
