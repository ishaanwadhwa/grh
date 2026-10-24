import { getRestaurants } from "@/lib/supabase/queries";
import RestaurantsView from "./view";

export default async function RestaurantsPage() {
  return <RestaurantsView restaurants={await getRestaurants()} />;
}
