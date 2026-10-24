import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";
import { normalizePhoneForRateLimit } from "@/lib/reservations/phone";
import { isTurnstileEnforced, verifyTurnstile } from "@/lib/reservations/turnstile";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
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
    return Response.json({ error: "Please check the reservation details and try again." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return Response.json({ error: "Reservation service is not configured." }, { status: 503 });
  }

  const clientIp = getClientIp(request);

  // Enforced only once TURNSTILE_SECRET_KEY is configured -- the customer UI
  // doesn't send a token yet. See docs/RESERVATIONS-API.md.
  if (isTurnstileEnforced()) {
    const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : null;
    if (!(await verifyTurnstile(turnstileToken, clientIp))) {
      return Response.json({ error: "Please try again.", code: "BOT_CHECK_FAILED" }, { status: 403 });
    }
  }

  const ipLimit = RATE_LIMITS.createPerIp;
  if (!(await checkRateLimit(supabase, ipLimit.bucket, clientIp, ipLimit.windowSeconds, ipLimit.max))) {
    return Response.json({ error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const normalizedPhone = normalizePhoneForRateLimit(guestPhoneCode, guestPhone);
  if (normalizedPhone) {
    const phoneLimit = RATE_LIMITS.createPerPhone;
    if (!(await checkRateLimit(supabase, phoneLimit.bucket, normalizedPhone, phoneLimit.windowSeconds, phoneLimit.max))) {
      return Response.json({ error: "Too many bookings from this phone number today. Please call the restaurant directly.", code: "RATE_LIMITED" }, { status: 429 });
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
      return Response.json({ error: "That time was just booked. Please choose another available time." }, { status: 409 });
    }
    if (error.message.includes("RESTAURANT_NOT_FOUND")) {
      return Response.json({ error: "Restaurant not found." }, { status: 404 });
    }
    if (error.message.includes("INVALID_RESERVATION")) {
      return Response.json({ error: "Please check the reservation details and try again." }, { status: 400 });
    }
    console.error("Reservation creation failed:", error.message);
    return Response.json({ error: "Could not complete the reservation. Please try again." }, { status: 500 });
  }

  return Response.json({ reservation: { id: reservationId } }, { status: 201 });
}
