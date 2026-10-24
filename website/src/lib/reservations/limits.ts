// Rate limit constants for the public reservation API
// (docs/agent-briefs/P1B-public-hardening.md task 5). Enforced via the
// Postgres hit_rate_limit() RPC (028_rate_limits.sql), called with the
// service-role client.

export const RATE_LIMITS = {
  /** GET /api/reservations/availability, per IP. */
  availabilityPerIp: { bucket: "availability_ip", windowSeconds: 60, max: 60 },
  /** POST /api/reservations, per IP. */
  createPerIp: { bucket: "create_ip", windowSeconds: 600, max: 5 },
  /** POST /api/reservations, per normalised phone number. */
  createPerPhone: { bucket: "create_phone", windowSeconds: 86400, max: 3 },
  /** Every /api/reservations/manage/[token]* route, per IP. */
  managePerIp: { bucket: "manage_ip", windowSeconds: 60, max: 20 },
} as const;
