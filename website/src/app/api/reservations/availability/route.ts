import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const restaurant = searchParams.get("restaurant")?.trim();
  const date = searchParams.get("date");
  const partySize = Number(searchParams.get("partySize"));

  if (!restaurant || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(partySize)) {
    return Response.json({ error: "Restaurant, date, and party size are required." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return Response.json({ error: "Reservation service is not configured." }, { status: 503 });
  }

  const clientIp = getClientIp(request);
  const { bucket, windowSeconds, max } = RATE_LIMITS.availabilityPerIp;
  if (!(await checkRateLimit(supabase, bucket, clientIp, windowSeconds, max))) {
    return Response.json({ error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const { data, error } = await supabase.rpc("get_available_restaurant_slots", {
    p_restaurant_slug: restaurant,
    p_service_date: date,
    p_party_size: partySize,
  });

  if (error) {
    console.error("Availability lookup failed:", error.message);
    return Response.json({ error: "Could not check availability. Please try again." }, { status: 500 });
  }

  const slots = ((data || []) as Array<{ service_id: string; service_name: string; slot_time: string; requires_approval: boolean }>).map((slot) => ({
    serviceId: slot.service_id,
    serviceName: slot.service_name,
    time: String(slot.slot_time).slice(0, 5),
    requiresApproval: slot.requires_approval,
  }));

  return Response.json({ slots });
}
