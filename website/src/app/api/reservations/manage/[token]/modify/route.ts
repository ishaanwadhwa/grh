import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";
import { sha256Hex } from "@/lib/reservations/hash";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) {
    return Response.json({ error: "That link is invalid.", code: "NOT_FOUND" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const partySize = Number(body.partySize);

  if (!date && !time && body.partySize === undefined) {
    return Response.json({ error: "Provide at least one of date, time or partySize to change.", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (
    (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
    || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    || (body.partySize !== undefined && (!Number.isInteger(partySize) || partySize < 1 || partySize > 50))
  ) {
    return Response.json({ error: "Please check the new date, time and party size.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return Response.json({ error: "Reservation service is not configured." }, { status: 503 });
  }

  const clientIp = getClientIp(request);
  const limit = RATE_LIMITS.managePerIp;
  if (!(await checkRateLimit(supabase, limit.bucket, clientIp, limit.windowSeconds, limit.max))) {
    return Response.json({ error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const tokenHash = await sha256Hex(token);

  // Partial updates (date/time/partySize optional) apply on top of the
  // current booking -- look it up first so an omitted field means "unchanged".
  const { data: current, error: lookupError } = await supabase.rpc("get_reservation_by_token", { p_hash: tokenHash });
  if (lookupError || !current) {
    return Response.json({ error: "That link is invalid or has expired.", code: "NOT_FOUND" }, { status: 404 });
  }
  const currentSummary = current as { date: string; time: string; partySize: number };

  const { data, error } = await supabase.rpc("modify_reservation_by_token", {
    p_hash: tokenHash,
    p_date: date || currentSummary.date,
    p_time: time || currentSummary.time,
    p_party_size: body.partySize !== undefined ? partySize : currentSummary.partySize,
  });

  if (error) {
    if (error.message.includes("INVALID_TOKEN")) {
      return Response.json({ error: "That link is invalid or has expired.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (error.message.includes("CANCELLATION_CUTOFF_PASSED")) {
      return Response.json(
        { error: "This booking can no longer be changed online. Please call the restaurant directly.", code: "CANCELLATION_CUTOFF_PASSED" },
        { status: 422 }
      );
    }
    if (error.message.includes("OUTSIDE_BOOKING_WINDOW")) {
      return Response.json({ error: "That date or time isn't bookable online right now.", code: "OUTSIDE_BOOKING_WINDOW" }, { status: 422 });
    }
    if (error.message.includes("SLOT_UNAVAILABLE")) {
      return Response.json({ error: "That time is no longer available. Please choose another.", code: "SLOT_UNAVAILABLE" }, { status: 409 });
    }
    console.error("Manage modify failed:", error.message);
    return Response.json({ error: "Could not change this reservation. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  const result = data as { reservation_id: string; status: string };

  // Return the fresh, full guest-safe summary (the contract's
  // ManageReservationSummary shape) rather than just {id, status}.
  const { data: updated } = await supabase.rpc("get_reservation_by_token", { p_hash: tokenHash });
  return Response.json({ reservation: updated || { id: result.reservation_id, status: result.status } });
}
