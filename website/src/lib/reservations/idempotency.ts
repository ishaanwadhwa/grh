import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "./hash";

export type IdempotencyClaim =
  | { state: "claimed" }
  | { state: "in_progress" }
  | { state: "conflict" }
  | { state: "replay"; statusCode: number; response: unknown };

// Insert-first claiming via claim_idempotency_key (029_idempotency.sql). On
// an RPC error, fails open (treats it as a fresh "claimed" request) rather
// than blocking bookings because the idempotency store had a hiccup.
export async function claimIdempotencyKey(supabase: SupabaseClient, key: string, rawBody: string): Promise<IdempotencyClaim> {
  const hash = await sha256Hex(rawBody);
  const { data, error } = await supabase.rpc("claim_idempotency_key", { p_key: key, p_request_hash: hash });
  if (error) {
    console.error("Idempotency key claim failed:", error.message);
    return { state: "claimed" };
  }
  const result = data as { state: string; status_code?: number; response?: unknown };
  if (result.state === "replay") {
    return { state: "replay", statusCode: result.status_code ?? 500, response: result.response };
  }
  return { state: result.state as "claimed" | "in_progress" | "conflict" };
}

export async function completeIdempotencyKey(supabase: SupabaseClient, key: string, statusCode: number, response: unknown): Promise<void> {
  const { error } = await supabase.rpc("complete_idempotency_key", { p_key: key, p_status_code: statusCode, p_response: response });
  if (error) console.error("Idempotency key completion failed:", error.message);
}
