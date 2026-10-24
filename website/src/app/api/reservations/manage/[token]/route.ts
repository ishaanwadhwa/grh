import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/reservations/clientIp";
import { checkRateLimit } from "@/lib/reservations/rateLimit";
import { RATE_LIMITS } from "@/lib/reservations/limits";
import { sha256Hex } from "@/lib/reservations/hash";
import { apiErrorResponse, mapDatabaseError, NOT_FOUND, RATE_LIMITED, SERVICE_NOT_CONFIGURED } from "@/lib/reservations/apiErrors";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NOT_FOUND();

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return SERVICE_NOT_CONFIGURED();
  }

  const clientIp = getClientIp(request);
  const limit = RATE_LIMITS.managePerIp;
  if (!(await checkRateLimit(supabase, limit.bucket, clientIp, limit.windowSeconds, limit.max))) {
    return RATE_LIMITED();
  }

  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase.rpc("get_reservation_by_token", { p_hash: tokenHash });

  if (error) {
    const mapped = mapDatabaseError(error.message);
    if (mapped.code === "INTERNAL_ERROR") console.error("Manage lookup failed:", error.message);
    return apiErrorResponse(mapped);
  }

  return Response.json({ reservation: data });
}
