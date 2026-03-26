import { NextRequest } from "next/server";
import { reservations, getRestaurantBySlug } from "@/lib/data/mock";
import type { Reservation } from "@/lib/data/schema";

export async function POST(request: Request) {
  const body = await request.json();
  const { restaurantSlug, date, time, partySize, guestName, guestEmail, specialRequests } = body;

  if (!restaurantSlug || !date || !time || !partySize || !guestName || !guestEmail) {
    return Response.json({ error: "Missing required reservation fields" }, { status: 400 });
  }

  const restaurant = getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    return Response.json({ error: "Restaurant not found" }, { status: 404 });
  }

  // Validate date is in the future
  const reservationDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (reservationDate < today) {
    return Response.json({ error: "Reservation date must be in the future" }, { status: 400 });
  }

  // Validate party size
  if (partySize < 1 || partySize > 20) {
    return Response.json({ error: "Party size must be between 1 and 20" }, { status: 400 });
  }

  const reservation: Reservation = {
    id: `RS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    restaurantId: restaurant.id,
    userId: "mock-user",
    guestName,
    guestEmail,
    date,
    time,
    partySize,
    status: "confirmed", // No payment needed for reservations
    specialRequests: specialRequests || undefined,
    source: "website",
    createdAt: new Date().toISOString(),
  };

  reservations.push(reservation);

  return Response.json(
    { reservation, restaurantName: restaurant.name },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  const activeReservations = reservations.filter((r) => r.status !== "cancelled");
  return Response.json({ reservations: activeReservations });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { reservationId, action } = body;

  if (!reservationId || !action) {
    return Response.json({ error: "Missing reservationId or action" }, { status: 400 });
  }

  const reservation = reservations.find((r) => r.id === reservationId);
  if (!reservation) {
    return Response.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (action === "cancel") {
    if (reservation.status === "cancelled") {
      return Response.json({ error: "Reservation is already cancelled" }, { status: 400 });
    }
    reservation.status = "cancelled";
    return Response.json({ reservation });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
