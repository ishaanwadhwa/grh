import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const restaurant = searchParams.get("restaurant")?.trim();
  const date = searchParams.get("date");
  const partySize = Number(searchParams.get("partySize"));

  if (!restaurant || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(partySize)) {
    return Response.json({ error: "Restaurant, date, and party size are required." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ error: "Reservation service is not configured." }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("get_available_restaurant_slots", {
    p_restaurant_slug: restaurant,
    p_service_date: date,
    p_party_size: partySize,
  });

  if (error) {
    console.error("Availability lookup failed:", error.message);
    return Response.json({ error: "Could not check availability. Please try again." }, { status: 500 });
  }

  const slots = ((data || []) as Array<{ service_id: string; service_name: string; slot_time: string }>).map((slot) => ({
    serviceId: slot.service_id,
    serviceName: slot.service_name,
    time: String(slot.slot_time).slice(0, 5),
  }));

  return Response.json({ slots });
}
