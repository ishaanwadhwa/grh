import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/supabase/queries";
import RestaurantView from "./view";

// Restaurants live at the top level: /angels-and-searchers, /good-room, ...
export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const restaurant = await getRestaurantBySlug((await params).slug);
  if (!restaurant) notFound();

  return <RestaurantView restaurant={restaurant} />;
}
