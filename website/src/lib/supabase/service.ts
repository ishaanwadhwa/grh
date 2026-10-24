import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for the public reservation API routes
// (docs/agent-briefs/P1B-public-hardening.md task 2). `import "server-only"`
// makes it a Next.js build error to import this module from a Client
// Component, so SUPABASE_SERVICE_ROLE_KEY can never end up in a browser bundle.
//
// This key bypasses RLS entirely. Only call it from route handlers, and only
// to invoke RPCs that are themselves locked down to `service_role`
// (025_public_rpcs_service_role.sql onward) -- never expose it to `.from()`
// table access on behalf of an untrusted request.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service client is not configured.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
