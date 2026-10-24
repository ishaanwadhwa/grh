// Client IP for rate limiting (docs/agent-briefs/P1B-public-hardening.md task 5).
// Vercel (and most proxies) set X-Forwarded-For to a comma-separated list
// with the original client first; Next.js route handlers don't expose a
// parsed IP of their own, so we read the header straight off the request.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  // Some platforms (Vercel included) also set this single-value header.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
