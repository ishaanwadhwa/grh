import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";
import { normalizePhoneForRateLimit } from "@/lib/reservations/phone";
import { isTurnstileEnforced, verifyTurnstile } from "@/lib/reservations/turnstile";
import { claimIdempotencyKey, completeIdempotencyKey } from "@/lib/reservations/idempotency";

interface JsonResult {
  status: number;
  body: Record<string, unknown>;
}

// The actual booking attempt. Returns a plain {status, body} pair rather
// than a Response so the caller can both send it and (for an
// Idempotency-Key request) store it verbatim for replay.
async function handleCreate(request: Request, rawBody: string): Promise<JsonResult> {
  let body: Record<string, unknown>;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { status: 400, body: { error: "Invalid request body." } };
  }

  const restaurantSlug = typeof body.restaurantSlug === "string" ? body.restaurantSlug.trim() : "";
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const partySize = Number(body.partySize);
  const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";
  const guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim() : "";
  const guestPhone = typeof body.guestPhone === "string" ? body.guestPhone.trim() : "";
  const guestPhoneCode = typeof body.guestPhoneCode === "string" ? body.guestPhoneCode : "+91";

  if (
    !restaurantSlug || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    || !Number.isInteger(partySize) || partySize < 1 || partySize > 50
    || !guestName || guestName.length > 120
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)
  ) {
    return { status: 400, body: { error: "Please check the reservation details and try again." } };
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return { status: 503, body: { error: "Reservation service is not configured." } };
  }

  const clientIp = getClientIp(request);

  // Enforced only once TURNSTILE_SECRET_KEY is configured -- the customer UI
  // doesn't send a token yet. See docs/RESERVATIONS-API.md.
  if (isTurnstileEnforced()) {
    const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : null;
    if (!(await verifyTurnstile(turnstileToken, clientIp))) {
      return { status: 403, body: { error: "Please try again.", code: "BOT_CHECK_FAILED" } };
    }
  }

  const ipLimit = RATE_LIMITS.createPerIp;
  if (!(await checkRateLimit(supabase, ipLimit.bucket, clientIp, ipLimit.windowSeconds, ipLimit.max))) {
    return { status: 429, body: { error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" } };
  }

  const normalizedPhone = normalizePhoneForRateLimit(guestPhoneCode, guestPhone);
  if (normalizedPhone) {
    const phoneLimit = RATE_LIMITS.createPerPhone;
    if (!(await checkRateLimit(supabase, phoneLimit.bucket, normalizedPhone, phoneLimit.windowSeconds, phoneLimit.max))) {
      return { status: 429, body: { error: "Too many bookings from this phone number today. Please call the restaurant directly.", code: "RATE_LIMITED" } };
    }
  }

  const { data: reservationId, error } = await supabase.rpc("create_restaurant_reservation", {
    p_restaurant_slug: restaurantSlug,
    p_service_id: serviceId,
    p_service_date: date,
    p_slot_time: time,
    p_party_size: partySize,
    p_guest_name: guestName,
    p_guest_email: guestEmail,
    p_guest_phone: guestPhone,
    p_guest_phone_code: guestPhoneCode,
    p_is_whatsapp: body.isWhatsApp === true,
    p_special_requests: typeof body.specialRequests === "string" ? body.specialRequests.trim() : null,
  });

  if (error) {
    if (error.message.includes("SLOT_UNAVAILABLE")) {
      return { status: 409, body: { error: "That time was just booked. Please choose another available time." } };
    }
    if (error.message.includes("RESTAURANT_NOT_FOUND")) {
      return { status: 404, body: { error: "Restaurant not found." } };
    }
    if (error.message.includes("INVALID_RESERVATION")) {
      return { status: 400, body: { error: "Please check the reservation details and try again." } };
    }
    console.error("Reservation creation failed:", error.message);
    return { status: 500, body: { error: "Could not complete the reservation. Please try again." } };
  }

  return { status: 201, body: { reservation: { id: reservationId } } };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();

  // No key: behave exactly as before (every request processed fresh).
  if (!idempotencyKey) {
    const result = await handleCreate(request, rawBody);
    return Response.json(result.body, { status: result.status });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return Response.json({ error: "Reservation service is not configured." }, { status: 503 });
  }

  const claim = await claimIdempotencyKey(supabase, idempotencyKey, rawBody);

  if (claim.state === "replay") {
    return Response.json(claim.response, { status: claim.statusCode });
  }
  if (claim.state === "conflict") {
    return Response.json(
      { error: "This Idempotency-Key was already used with a different request.", code: "IDEMPOTENCY_KEY_REUSED" },
      { status: 409 }
    );
  }
  if (claim.state === "in_progress") {
    return Response.json(
      { error: "This request is already being processed. Please wait and try again.", code: "REQUEST_IN_PROGRESS" },
      { status: 409 }
    );
  }

  // claim.state === "claimed": process fresh, then store the outcome
  // (success or error alike) so a genuine retry replays it verbatim.
  const result = await handleCreate(request, rawBody);
  await completeIdempotencyKey(supabase, idempotencyKey, result.status, result.body);
  return Response.json(result.body, { status: result.status });
}
