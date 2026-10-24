import "server-only";

// Web Crypto (available in both the Node.js and Edge runtimes) rather than
// Node's "crypto" module, so this works regardless of route runtime.
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 32 random bytes, base64url-encoded -- used for the guest manage token
// (docs/agent-briefs/P1B-public-hardening.md task 7). Only its sha256 hex is
// ever stored; this raw value is returned to the caller exactly once.
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
