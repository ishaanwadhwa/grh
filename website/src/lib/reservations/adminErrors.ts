// Plain-language text for the suggest_tables warnings and the staff RPC
// error codes (docs/agent-briefs/P1A-booking-engine.md task 6: "Error
// messages are mapped to plain language -- no raw Postgres errors shown to
// the hostess"). Shared by NewBookingPanel, the service "Needs a table" tray,
// and the admin reservations table picker.

export const WARNING_TEXT: Record<string, string> = {
  OUTSIDE_SERVICE_HOURS: "This time is outside the service's normal hours.",
  NO_TABLE_FITS: "No table is big enough for this party size.",
  UNASSIGNED_WOULD_NOT_FIT: "Leaving this unassigned would overcommit the night \u2014 another booking could lose its table.",
};

export const ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_STAFF_RESERVATION: "Check the guest name, date, time and party size.",
  INVALID_SOURCE: "Choose a valid booking source.",
  INVALID_TABLE_MODE: "Choose how to handle the table first.",
  EXTERNAL_REFERENCE_REQUIRED: "Enter the EazyDiner booking ID.",
  RESTAURANT_NOT_FOUND: "Restaurant not found.",
  SERVICE_NOT_FOUND: "Choose a service.",
  RESERVATION_NOT_FOUND: "That reservation could not be found. Refresh and try again.",
  NO_TABLE_AVAILABLE: "No table is free for this party right now. Pick one manually or save with no table.",
  TABLE_ALREADY_RESERVED: "One of those tables is already taken at this time.",
  OVER_CAPACITY: "Those tables can't seat this many guests.",
  CAPACITY_EXCEEDED: "This would overcommit the night \u2014 another booking could lose its table.",
  TABLE_NOT_AVAILABLE: "One of those tables isn't available.",
  DUPLICATE_TABLE: "The same table was selected twice.",
  SELECT_AT_LEAST_ONE_TABLE: "Choose at least one table.",
  OUTSIDE_SERVICE_HOURS: "This time is outside the service's normal hours.",
  RESERVATION_NOT_ACTIVE: "This booking has already been completed, cancelled or marked no-show, so its table can't be changed.",
  RESERVATION_NOT_PENDING: "This request has already been reviewed.",
};

// Raw Postgres errors that mean the same thing as one of our codes (e.g. two
// staff grabbing the same table at once trips the exclusion constraint).
const ALIASES: Record<string, string> = {
  reservation_table_no_overlap: "TABLE_ALREADY_RESERVED",
};

// Only these are safe to retry with p_allow_override = true -- a physical
// overlap (TABLE_ALREADY_RESERVED) is never overridable.
export const OVERRIDABLE_CODES = new Set(["OVER_CAPACITY", "CAPACITY_EXCEEDED", "NO_TABLE_AVAILABLE", "OUTSIDE_SERVICE_HOURS"]);

export interface FriendlyError {
  code: string;
  text: string;
  overridable: boolean;
}

export function friendlyError(message: string): FriendlyError {
  const alias = Object.keys(ALIASES).find((key) => message.includes(key));
  const code = alias ? ALIASES[alias] : Object.keys(ERROR_TEXT).find((key) => message.includes(key)) || "";
  return {
    code,
    text: ERROR_TEXT[code] || "Could not save this. Please try again.",
    overridable: OVERRIDABLE_CODES.has(code),
  };
}
