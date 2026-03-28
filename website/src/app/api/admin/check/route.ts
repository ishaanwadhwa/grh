import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // read-only in GET
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ isAdmin: false, user: null }, { status: 401 });
  }

  // Check admin_profiles table
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await adminClient
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return Response.json({
    isAdmin: !!profile,
    user: { id: user.id, email: user.email },
    role: profile?.role,
  });
}
