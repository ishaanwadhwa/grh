import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";
import { sha256Hex } from "@/lib/reservations/hash";
import { apiErrorResponse, mapDatabaseError, NOT_FOUND, RATE_LIMITED, SERVICE_NOT_CONFIGURED, VALIDATION_ERROR } from "@/lib/reservations/apiErrors";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NOT_FOUND();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return VALIDATION_ERROR("Invalid request body.");
  }

  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const partySize = Number(body.partySize);

  if (!date && !time && body.partySize === undefined) {
    return VALIDATION_ERROR("Provide at least one of date, time or partySize to change.");
  }
  if (
    (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
    || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    || (body.partySize !== undefined && (!Number.isInteger(partySize) || partySize < 1 || partySize > 50))
  ) {
    return VALIDATION_ERROR("Please check the new date, time and party size.");
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return SERVICE_NOT_CONFIGURED();
  }

  const clientIp = getClientIp(request);
  const limit = RATE_LIMITS.managePerIp;
  if (!(await checkRateLimit(supabase, limit.bucket, clientIp, limit.windowSeconds, limit.max))) {
    return RATE_LIMITED();
  }

  const tokenHash = await sha256Hex(token);

  // Partial updates (date/time/partySize optional) apply on top of the
  // current booking -- look it up first so an omitted field means "unchanged".
  const { data: current, error: lookupError } = await supabase.rpc("get_reservation_by_token", { p_hash: tokenHash });
  if (lookupError || !current) return NOT_FOUND();
  const currentSummary = current as { date: string; time: string; partySize: number };

  const { data, error } = await supabase.rpc("modify_reservation_by_token", {
    p_hash: tokenHash,
    p_date: date || currentSummary.date,
    p_time: time || currentSummary.time,
    p_party_size: body.partySize !== undefined ? partySize : currentSummary.partySize,
  });

  if (error) {
    const mapped = mapDatabaseError(error.message);
    if (mapped.code === "INTERNAL_ERROR") console.error("Manage modify failed:", error.message);
    return apiErrorResponse(mapped);
  }

  const result = data as { reservation_id: string; status: string };

  // Return the fresh, full guest-safe summary (the contract's
  // ManageReservationSummary shape) rather than just {id, status}.
  const { data: updated } = await supabase.rpc("get_reservation_by_token", { p_hash: tokenHash });
  return Response.json({ reservation: updated || { id: result.reservation_id, status: result.status } });
}
