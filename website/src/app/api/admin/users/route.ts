import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function getRequestingAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await adminClient
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ? user : null;
}

// GET — list all admin users
export async function GET() {
  const requestor = await getRequestingAdmin();
  if (!requestor) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles } = await adminClient
    .from("admin_profiles")
    .select("id, email, role, created_at")
    .order("created_at");

  return Response.json({ users: profiles || [] });
}

// POST — create a new admin user
export async function POST(request: Request) {
  const requestor = await getRequestingAdmin();
  if (!requestor) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { username, password } = await request.json();

  if (!username || !password) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }

  if (password.length < 4) {
    return Response.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }

  const email = username.includes("@") ? username : `${username}@goodroomhouse.com`;

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create auth user
  const { data: userData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return Response.json({ error: authError.message }, { status: 400 });
  }

  // Add to admin_profiles
  const { error: profileError } = await adminClient.from("admin_profiles").insert({
    id: userData.user.id,
    email,
    role: "admin",
  });

  if (profileError) {
    // Rollback auth user
    await adminClient.auth.admin.deleteUser(userData.user.id);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  return Response.json({
    user: { id: userData.user.id, email, username, role: "admin" },
  }, { status: 201 });
}

// DELETE — remove an admin user
export async function DELETE(request: Request) {
  const requestor = await getRequestingAdmin();
  if (!requestor) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await request.json();

  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  // Prevent self-deletion
  if (userId === requestor.id) {
    return Response.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await adminClient.from("admin_profiles").delete().eq("id", userId);
  await adminClient.auth.admin.deleteUser(userId);

  return Response.json({ success: true });
}
