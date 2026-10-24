import { getRestaurantBySlug } from "@/lib/supabase/queries";
import ReserveView from "./view";

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const slug = (await searchParams).restaurant;
  return <ReserveView restaurant={slug ? await getRestaurantBySlug(slug) : null} />;
}
