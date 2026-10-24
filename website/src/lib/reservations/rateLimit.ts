import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Calls the hit_rate_limit RPC (028_rate_limits.sql). Fails open (allows the
// request) if the RPC call itself errors, so a rate-limiter outage never
// takes the whole booking path down with it.
export async function checkRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  key: string,
  windowSeconds: number,
  max: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("Rate limit check failed:", error.message);
    return true;
  }
  return data !== false;
}
