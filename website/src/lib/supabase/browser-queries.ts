"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Property, Room, Restaurant } from "@/lib/data/schema";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProperty(row: any): Property {
  return {
    id: row.id, name: row.name, slug: row.slug, location: row.location,
    address: row.address, phone: row.phone, tagline: row.tagline,
    description: row.description, amenities: row.amenities || [],
    images: row.images || [], restaurantIds: [],
    coordinates: row.coordinates, mapUrl: row.map_url,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoom(row: any): Room {
  return {
    id: row.id, propertyId: row.property_id, name: row.name, slug: row.slug,
    description: row.description, personality: row.personality,
    capacity: row.capacity, bedType: row.bed_type, size: row.size,
    amenities: row.amenities || [], images: row.images || [],
    basePricePerNight: row.base_price_per_night,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRestaurant(row: any): Restaurant {
  return {
    id: row.id, propertyId: row.property_id, name: row.name, slug: row.slug,
    cuisine: row.cuisine, description: row.description, vibe: row.vibe,
    hours: row.hours, images: row.images || [],
  };
}

export async function fetchPropertyBySlug(slug: string): Promise<Property | null> {
  const supabase = getClient();
  const { data, error } = await supabase.from("properties").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return mapProperty(data);
}

export async function fetchRoomsByPropertyId(propertyId: string): Promise<Room[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("rooms").select("*").eq("property_id", propertyId).eq("is_active", true).order("sort_order");
  if (error) return [];
  return (data || []).map(mapRoom);
}

export async function fetchRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const supabase = getClient();
  const { data, error } = await supabase.from("restaurants").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return mapRestaurant(data);
}

export async function fetchRestaurants(featuredOnly = false): Promise<Restaurant[]> {
  const supabase = getClient();
  let query = supabase.from("restaurants").select("*").eq("is_active", true).order("sort_order").order("created_at");
  if (featuredOnly) query = query.eq("featured", true);
  const { data, error } = await query;
  if (error) return [];
  return (data || []).map(mapRestaurant);
}

export async function fetchFeaturedProperty(): Promise<Property | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("properties").select("*").eq("featured", true).limit(1).single();
  if (error || !data) return null;
  return mapProperty(data);
}

export async function fetchProperties(): Promise<Property[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from("properties").select("*").order("created_at");
  if (error) return [];
  return (data || []).map(mapProperty);
}
