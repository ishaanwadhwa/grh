import "server-only";

// Cloudflare Turnstile verification for POST /api/reservations
// (docs/agent-briefs/P1B-public-hardening.md task 5). Enforced only when
// TURNSTILE_SECRET_KEY is set: the customer UI doesn't send a token yet, so
// until the widget ships and the key is configured, this is a no-op.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileEnforced(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string | null | undefined, remoteIp: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not enforced -- see isTurnstileEnforced().
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification failed:", error);
    return false;
  }
}
