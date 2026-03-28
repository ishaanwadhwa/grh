import {
  createBooking,
  getBookings,
  cancelBooking,
  getRoomById,
  getAvailableRooms,
} from "@/lib/supabase/queries";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    roomId,
    propertyId,
    checkIn,
    checkOut,
    guests,
    totalAmount,
    currency,
    guestName,
    guestEmail,
    guestPhone,
    guestPhoneCode,
    isWhatsApp,
    specialRequests,
  } = body;

  if (!roomId || !propertyId || !checkIn || !checkOut || !guests || !totalAmount || !guestName || !guestEmail) {
    return Response.json({ error: "Missing required booking fields" }, { status: 400 });
  }

  const room = await getRoomById(roomId);
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  // Check availability
  const available = await getAvailableRooms(propertyId, checkIn, checkOut);
  if (!available.some((r) => r.id === roomId)) {
    return Response.json({ error: "Room is no longer available for these dates" }, { status: 409 });
  }

  if (guests > room.capacity) {
    return Response.json({ error: `Room capacity is ${room.capacity} guests` }, { status: 400 });
  }

  try {
    const booking = await createBooking({
      roomId,
      propertyId,
      guestName,
      guestEmail,
      guestPhone,
      guestPhoneCode,
      isWhatsApp,
      checkIn,
      checkOut,
      guests,
      totalAmount,
      currency: currency || "INR",
      specialRequests,
    });

    return Response.json({ booking }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const bookings = await getBookings();
    return Response.json({ bookings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch bookings";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { bookingId, action } = body;

  if (!bookingId || !action) {
    return Response.json({ error: "Missing bookingId or action" }, { status: 400 });
  }

  if (action === "cancel") {
    try {
      const booking = await cancelBooking(bookingId);
      return Response.json({ booking });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancel failed";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
