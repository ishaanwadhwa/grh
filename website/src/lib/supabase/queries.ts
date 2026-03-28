import { createClient } from "@supabase/supabase-js";
import type {
  Property,
  Room,
  Restaurant,
  Booking,
  Reservation,
} from "@/lib/data/schema";

// Server-side client using service role for admin operations
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Public client using anon key (respects RLS)
function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================
// Mappers — convert DB snake_case → app camelCase
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProperty(row: any): Property {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    location: row.location,
    address: row.address,
    phone: row.phone,
    tagline: row.tagline,
    description: row.description,
    amenities: row.amenities || [],
    images: row.images || [],
    restaurantIds: [], // populated separately
    coordinates: row.coordinates,
    mapUrl: row.map_url,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoom(row: any): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    personality: row.personality,
    capacity: row.capacity,
    bedType: row.bed_type,
    size: row.size,
    amenities: row.amenities || [],
    images: row.images || [],
    basePricePerNight: row.base_price_per_night,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRestaurant(row: any): Restaurant {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    slug: row.slug,
    cuisine: row.cuisine,
    description: row.description,
    vibe: row.vibe,
    hours: row.hours,
    images: row.images || [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBooking(row: any): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    propertyId: row.property_id,
    userId: row.user_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests,
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    status: row.status,
    source: row.source,
    specialRequests: row.special_requests,
    paymentId: row.payment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReservation(row: any): Reservation {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    userId: row.user_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    date: row.date,
    time: row.time,
    partySize: row.party_size,
    status: row.status,
    specialRequests: row.special_requests,
    source: row.source,
    createdAt: row.created_at,
  };
}

// ============================================
// Properties
// ============================================

export async function getProperties(): Promise<Property[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at");

  if (error) throw error;

  const properties = (data || []).map(mapProperty);

  // Populate restaurantIds
  for (const prop of properties) {
    const { data: rests } = await supabase
      .from("restaurants")
      .select("id")
      .eq("property_id", prop.id);
    prop.restaurantIds = (rests || []).map((r) => r.id);
  }

  return properties;
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  const property = mapProperty(data);

  const { data: rests } = await supabase
    .from("restaurants")
    .select("id")
    .eq("property_id", property.id);
  property.restaurantIds = (rests || []).map((r) => r.id);

  return property;
}

// ============================================
// Rooms
// ============================================

export async function getRoomsByPropertyId(propertyId: string): Promise<Room[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return (data || []).map(mapRoom);
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error || !data) return null;
  return mapRoom(data);
}

export async function getAvailableRooms(
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<Room[]> {
  const supabase = getPublicClient();

  // Get all active rooms for the property
  const { data: allRooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("sort_order");

  if (roomsErr) throw roomsErr;

  // Get bookings that overlap with the requested dates
  const { data: conflicting } = await supabase
    .from("bookings")
    .select("room_id")
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  const bookedRoomIds = new Set((conflicting || []).map((b) => b.room_id));

  return (allRooms || [])
    .filter((room) => !bookedRoomIds.has(room.id))
    .map(mapRoom);
}

// ============================================
// Restaurants
// ============================================

export async function getRestaurants(propertyId?: string): Promise<Restaurant[]> {
  const supabase = getPublicClient();
  let query = supabase
    .from("restaurants")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapRestaurant);
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return mapRestaurant(data);
}

// ============================================
// Events
// ============================================

export interface Event {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  date: string | null;
  time: string | null;
  tag: string;
  images: string[];
  isPublished: boolean;
}

export async function getEvents(propertyId?: string): Promise<Event[]> {
  const supabase = getPublicClient();
  let query = supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .order("date", { ascending: true, nullsFirst: false });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    tag: row.tag || "",
    images: row.images || [],
    isPublished: row.is_published,
  }));
}

// ============================================
// Bookings
// ============================================

export async function createBooking(data: {
  roomId: string;
  propertyId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestPhoneCode?: string;
  isWhatsApp?: boolean;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  currency: string;
  specialRequests?: string;
  source?: string;
}): Promise<Booking> {
  const supabase = getServiceClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      room_id: data.roomId,
      property_id: data.propertyId,
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      guest_phone: data.guestPhone || "",
      guest_phone_code: data.guestPhoneCode || "+91",
      is_whatsapp: data.isWhatsApp ?? true,
      check_in: data.checkIn,
      check_out: data.checkOut,
      guests: data.guests,
      total_amount: data.totalAmount,
      currency: data.currency || "INR",
      status: "confirmed",
      source: data.source || "website",
      special_requests: data.specialRequests,
    })
    .select()
    .single();

  if (error) throw error;
  return mapBooking(booking);
}

export async function getBookings(): Promise<Booking[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapBooking);
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .select()
    .single();

  if (error) throw error;
  return mapBooking(data);
}

// ============================================
// Reservations
// ============================================

export async function createReservation(data: {
  restaurantId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestPhoneCode?: string;
  isWhatsApp?: boolean;
  date: string;
  time: string;
  partySize: number;
  specialRequests?: string;
  source?: string;
}): Promise<Reservation> {
  const supabase = getServiceClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .insert({
      restaurant_id: data.restaurantId,
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      guest_phone: data.guestPhone || "",
      guest_phone_code: data.guestPhoneCode || "+91",
      is_whatsapp: data.isWhatsApp ?? true,
      date: data.date,
      time: data.time,
      party_size: data.partySize,
      status: "confirmed",
      source: data.source || "website",
      special_requests: data.specialRequests,
    })
    .select()
    .single();

  if (error) throw error;
  return mapReservation(reservation);
}

export async function getReservations(): Promise<Reservation[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapReservation);
}

export async function cancelReservation(reservationId: string): Promise<Reservation> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId)
    .select()
    .single();

  if (error) throw error;
  return mapReservation(data);
}

// ============================================
// Image Upload (Supabase Storage)
// ============================================

export async function uploadImage(
  bucket: string,
  filePath: string,
  file: File | Buffer,
  contentType?: string
): Promise<string> {
  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: contentType || "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return urlData.publicUrl;
}

export async function deleteImage(bucket: string, filePath: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) throw error;
}
