import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";
import { sha256Hex } from "@/lib/reservations/hash";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) {
    return Response.json({ error: "That link is invalid.", code: "NOT_FOUND" }, { status: 404 });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return Response.json({ error: "Reservation service is not configured." }, { status: 503 });
  }

  const clientIp = getClientIp(request);
  const limit = RATE_LIMITS.managePerIp;
  if (!(await checkRateLimit(supabase, limit.bucket, clientIp, limit.windowSeconds, limit.max))) {
    return Response.json({ error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase.rpc("cancel_reservation_by_token", { p_hash: tokenHash });

  if (error) {
    if (error.message.includes("INVALID_TOKEN")) {
      return Response.json({ error: "That link is invalid or has expired.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (error.message.includes("CANCELLATION_CUTOFF_PASSED")) {
      return Response.json(
        { error: "This booking can no longer be cancelled online. Please call the restaurant directly.", code: "CANCELLATION_CUTOFF_PASSED" },
        { status: 422 }
      );
    }
    console.error("Manage cancel failed:", error.message);
    return Response.json({ error: "Could not cancel this reservation. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  const result = data as { reservation_id: string; status: string };
  return Response.json({ reservation: { id: result.reservation_id, status: result.status } });
}
