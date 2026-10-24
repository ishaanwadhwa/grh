import { notFound } from "next/navigation";
import { getPropertyBySlug, getRoomsByPropertyId } from "@/lib/supabase/queries";
import PropertyView from "./view";

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const property = await getPropertyBySlug((await params).slug);
  if (!property) notFound();

  return <PropertyView property={property} rooms={await getRoomsByPropertyId(property.id)} />;
}
