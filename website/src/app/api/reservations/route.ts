import { createServiceClient } from "@/lib/supabase/service";

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

  const { data: reservationId, error } = await supabase.rpc("create_restaurant_reservation", {
    p_restaurant_slug: restaurantSlug,
    p_service_id: serviceId,
    p_service_date: date,
    p_slot_time: time,
    p_party_size: partySize,
    p_guest_name: guestName,
    p_guest_email: guestEmail,
    p_guest_phone: typeof body.guestPhone === "string" ? body.guestPhone.trim() : "",
    p_guest_phone_code: typeof body.guestPhoneCode === "string" ? body.guestPhoneCode : "+91",
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
