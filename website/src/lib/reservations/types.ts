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

// --- Guests (016) ---

export interface Guest {
  id: string;
  phoneE164: string | null;
  email: string | null;
  name: string;
  notes: string | null;
  tags: string[];
  visitCount: number;
  noShowCount: number;
  whatsappOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Reservation events (017) ---

export const RESERVATION_EVENT_TYPES = [
  "created",
  "status_changed",
  "tables_assigned",
  "updated",
] as const;

export type ReservationEventType = (typeof RESERVATION_EVENT_TYPES)[number];

export const RESERVATION_EVENT_ACTOR_SOURCES = ["staff", "guest", "system", "import"] as const;

export type ReservationEventActorSource = (typeof RESERVATION_EVENT_ACTOR_SOURCES)[number];

export interface ReservationEvent {
  id: string;
  reservationId: string;
  eventType: ReservationEventType;
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus | null;
  actorId: string | null;
  actorSource: ReservationEventActorSource;
  payload: Record<string, unknown>;
  createdAt: string;
}

// --- Booking policy (015) ---

export interface RestaurantBookingPolicy {
  restaurantId: string;
  autoConfirm: boolean;
  requirePhone: boolean;
  requireEmail: boolean;
  largePartyThreshold: number | null;
  minLeadMinutes: number;
  maxAdvanceDays: number | null;
  lastSeatingOffsetMinutes: number | null;
  onlineHoldbackPct: number;
  cancellationCutoffMinutes: number;
  reminderOffsetsMinutes: number[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API contract (docs/RESERVATIONS-API.md)
// ============================================
// Request/response shapes for every endpoint in the contract doc. Fields
// marked "planned P1" are part of the contract but not returned by the
// live route yet -- see the doc for exactly what differs today.

export interface AvailabilitySlot {
  serviceId: string;
  serviceName: string;
  /** "HH:MM", 24-hour, in the restaurant's local time. */
  time: string;
  /** True when this slot would create a `pending` request, not an instant `confirmed` booking. Planned P1. */
  requiresApproval?: boolean;
}

export interface AvailabilityResponse {
  slots: AvailabilitySlot[];
}

export interface CreateReservationRequest {
  restaurantSlug: string;
  serviceId: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM", must match a slot returned by the availability endpoint. */
  time: string;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestPhoneCode?: string;
  isWhatsApp?: boolean;
  specialRequests?: string;
}

export interface CreateReservationResponse {
  id: string;
  /** `pending` once large-party/approval policies are enforced (P1). Always `confirmed` today. */
  status: Extract<ReservationStatus, "confirmed" | "pending">;
  /** Raw manage token, shown/sent once. Planned P1 -- not returned by the live route yet. */
  manageToken: string;
}

export interface ManageReservationSummary {
  id: string;
  restaurantName: string;
  status: ReservationStatus;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  specialRequests: string | null;
  canCancel: boolean;
  canModify: boolean;
}

export interface ModifyReservationRequest {
  date?: string;
  time?: string;
  partySize?: number;
}

export type ModifyReservationResponse = ManageReservationSummary;

export interface CancelReservationResponse {
  id: string;
  status: Extract<ReservationStatus, "cancelled">;
}

// --- Standard error envelope ---

export const RESERVATION_ERROR_CODES = [
  "VALIDATION_ERROR",
  "RESTAURANT_NOT_FOUND",
  "SERVICE_NOT_FOUND",
  "SLOT_UNAVAILABLE",
  "POLICY_VIOLATION",
  "RATE_LIMITED",
  "INVALID_TOKEN",
  "RESERVATION_NOT_FOUND",
  "CANCELLATION_WINDOW_PASSED",
  "FORBIDDEN",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ReservationErrorCode = (typeof RESERVATION_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ReservationErrorCode;
    message: string;
  };
}
