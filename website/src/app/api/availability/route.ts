import { NextRequest } from "next/server";
import { getPropertyBySlug, getAvailableRooms } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const propertySlug = searchParams.get("property");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");

  if (!propertySlug || !checkIn || !checkOut) {
    return Response.json(
      { error: "Missing required params: property, checkIn, checkOut" },
      { status: 400 }
    );
  }

  const property = await getPropertyBySlug(propertySlug);
  if (!property) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkInDate < today) {
    return Response.json({ error: "Check-in date must be in the future" }, { status: 400 });
  }
  if (checkOutDate <= checkInDate) {
    return Response.json({ error: "Check-out must be after check-in" }, { status: 400 });
  }

  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const availableRooms = await getAvailableRooms(property.id, checkIn, checkOut);

  return Response.json({
    propertyId: property.id,
    propertyName: property.name,
    checkIn,
    checkOut,
    nights,
    availableRooms,
  });
}
