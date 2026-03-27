// ============================================
// GOOD ROOM HOUSE — Core Data Types
// ============================================
// These types define the shape of all data in the system.
// Currently backed by mock data. Will map to Supabase tables later.

export type Currency = "INR" | "USD" | "GBP";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type ReservationStatus = "pending" | "confirmed" | "cancelled";
export type BookingSource = "website" | "booking_com" | "airbnb" | "walkin" | "phone";

// --- Property ---

export interface Property {
  id: string;
  name: string;
  slug: string;
  location: string;
  address: string;
  phone: string;
  tagline: string;
  description: string;
  amenities: string[];
  images: string[];
  restaurantIds: string[];
  coordinates?: { lat: number; lng: number };
  mapUrl?: string;
}

// --- Room ---

export interface Room {
  id: string;
  propertyId: string;
  name: string;
  slug: string;
  description: string;
  personality: string; // story/character — what makes this room unique
  capacity: number;
  bedType: string;
  size: string; // e.g. "45 sqm"
  amenities: string[];
  images: string[];
  basePricePerNight: number; // in INR — the floor price, pricing API can override
}

// --- Restaurant ---

export interface Restaurant {
  id: string;
  propertyId: string;
  name: string;
  slug: string;
  cuisine: string;
  description: string;
  vibe: string;
  hours: string;
  images: string[];
}

// --- Booking ---

export interface Booking {
  id: string;
  roomId: string;
  propertyId: string;
  userId: string;
  guestName: string;
  guestEmail: string;
  checkIn: string; // ISO date "2026-04-01"
  checkOut: string;
  guests: number;
  totalAmount: number;
  currency: Currency;
  status: BookingStatus;
  source: BookingSource;
  specialRequests?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Restaurant Reservation ---

export interface Reservation {
  id: string;
  restaurantId: string;
  userId: string;
  guestName: string;
  guestEmail: string;
  date: string; // ISO date
  time: string; // "19:30"
  partySize: number;
  status: ReservationStatus;
  specialRequests?: string;
  source: BookingSource;
  createdAt: string;
}

// --- Pricing ---

export interface PricingRequest {
  roomId: string;
  checkIn: string;
  checkOut: string;
  currency: Currency;
  guestCount?: number;
}

export interface PricingBreakdownItem {
  date: string;
  price: number; // price for that specific night (supports dynamic per-night pricing)
}

export interface PricingResponse {
  roomId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number; // average or base
  subtotal: number;
  taxRate: number; // e.g. 0.18 for 18% GST
  taxes: number;
  totalAmount: number;
  currency: Currency;
  breakdown: PricingBreakdownItem[];
}

// --- Availability ---

export interface AvailabilityRequest {
  propertyId: string;
  checkIn: string;
  checkOut: string;
}

export interface AvailabilityResponse {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  availableRooms: Room[];
}
