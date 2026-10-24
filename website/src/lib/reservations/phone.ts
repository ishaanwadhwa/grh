// Mirrors supabase/migrations/020_guest_fixes.sql's normalize_phone_e164 so
// the per-phone rate limit (docs/agent-briefs/P1B-public-hardening.md task 5)
// buckets the same way the database would dedupe a guest. Used for rate
// limiting only -- the database function remains the source of truth for
// guest identity.
export function normalizePhoneForRateLimit(code: string | undefined, phone: string | undefined): string | null {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits) return null;

  let codeDigits = (code || "").replace(/\D/g, "");
  if (!codeDigits) codeDigits = "91";

  if (digits.length > 10 && digits.startsWith(codeDigits)) {
    return `+${digits}`;
  }
  return `+${codeDigits}${digits}`;
}
