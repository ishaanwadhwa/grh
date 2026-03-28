import {
  createReservation,
  getReservations,
  cancelReservation,
  getRestaurantBySlug,
} from "@/lib/supabase/queries";

export async function POST(request: Request) {
  const body = await request.json();
  const { restaurantSlug, date, time, partySize, guestName, guestEmail, guestPhone, guestPhoneCode, isWhatsApp, specialRequests } = body;

  if (!restaurantSlug || !date || !time || !partySize || !guestName || !guestEmail) {
    return Response.json({ error: "Missing required reservation fields" }, { status: 400 });
  }

  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    return Response.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const reservationDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (reservationDate < today) {
    return Response.json({ error: "Reservation date must be in the future" }, { status: 400 });
  }

  if (partySize < 1 || partySize > 20) {
    return Response.json({ error: "Party size must be between 1 and 20" }, { status: 400 });
  }

  try {
    const reservation = await createReservation({
      restaurantId: restaurant.id,
      guestName,
      guestEmail,
      guestPhone,
      guestPhoneCode,
      isWhatsApp,
      date,
      time,
      partySize,
      specialRequests,
    });

    return Response.json({ reservation, restaurantName: restaurant.name }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reservation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const reservations = await getReservations();
    return Response.json({ reservations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch reservations";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { reservationId, action } = body;

  if (!reservationId || !action) {
    return Response.json({ error: "Missing reservationId or action" }, { status: 400 });
  }

  if (action === "cancel") {
    try {
      const reservation = await cancelReservation(reservationId);
      return Response.json({ reservation });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancel failed";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
