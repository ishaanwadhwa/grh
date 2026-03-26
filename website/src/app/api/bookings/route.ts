import { NextRequest } from "next/server";
import { bookings, getRoomById, isRoomAvailable } from "@/lib/data/mock";
import type { Booking } from "@/lib/data/schema";

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
    specialRequests,
  } = body;

  // Validate required fields
  if (!roomId || !propertyId || !checkIn || !checkOut || !guests || !totalAmount || !guestName || !guestEmail) {
    return Response.json({ error: "Missing required booking fields" }, { status: 400 });
  }

  // Validate room exists
  const room = getRoomById(roomId);
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  // Validate availability (prevent double booking)
  if (!isRoomAvailable(roomId, checkIn, checkOut)) {
    return Response.json({ error: "Room is no longer available for these dates" }, { status: 409 });
  }

  // Validate guest count
  if (guests > room.capacity) {
    return Response.json(
      { error: `Room capacity is ${room.capacity} guests` },
      { status: 400 }
    );
  }

  // Create booking
  const booking: Booking = {
    id: `BK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    roomId,
    propertyId,
    userId: "mock-user", // Will be real user ID when auth is connected
    guestName,
    guestEmail,
    checkIn,
    checkOut,
    guests,
    totalAmount,
    currency: currency || "INR",
    status: "confirmed", // Mock: skip pending → confirmed (no real payment yet)
    source: "website",
    specialRequests: specialRequests || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  bookings.push(booking);

  return Response.json({ booking }, { status: 201 });
}

export async function GET(request: NextRequest) {
  // In production: filter by authenticated user ID
  // Mock: return all bookings
  const activeBookings = bookings.filter((b) => b.status !== "cancelled");

  return Response.json({ bookings: activeBookings });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { bookingId, action } = body;

  if (!bookingId || !action) {
    return Response.json({ error: "Missing bookingId or action" }, { status: 400 });
  }

  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  if (action === "cancel") {
    if (booking.status === "cancelled") {
      return Response.json({ error: "Booking is already cancelled" }, { status: 400 });
    }
    booking.status = "cancelled";
    booking.updatedAt = new Date().toISOString();
    return Response.json({ booking });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
