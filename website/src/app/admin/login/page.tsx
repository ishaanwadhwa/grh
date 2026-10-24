"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminInput, FormField } from "@/components/admin/FormField";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // Accept either a username or full email. Keep legacy username aliases working
    // while existing admin accounts are migrated to the new brand domain.
    const emailCandidates = username.includes("@")
      ? [username]
      : [`${username}@sundayroseclub.com`, `${username}@goodroomhouse.com`];
    let authSucceeded = false;
    let authErrorMessage = "";

    for (const email of emailCandidates) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError) {
        authSucceeded = true;
        break;
      }
      authErrorMessage = authError.message;
    }

    if (!authSucceeded) {
      setError(authErrorMessage === "Invalid login credentials" ? "That username and password don't match." : authErrorMessage);
      setLoading(false);
      return;
    }

    // Verify admin access
    const res = await fetch("/api/admin/check");
    const data = await res.json();

    if (!data.isAdmin) {
      await supabase.auth.signOut();
      setError("This account doesn't have admin access.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
  };

  return (
    <main className="grid min-h-svh place-items-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-4 text-center">
          <p className="wordmark" style={{ padding: 0 }}>Sunday Rose Club</p>
          <p className="t-cap">Admin</p>
        </div>

        <form onSubmit={handleLogin} className="card form">
          <FormField label="Username">
            <AdminInput
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="sahar"
            />
          </FormField>
          <FormField label="Password">
            <AdminInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </FormField>

          {error && <p className="hint error -mt-2" role="alert">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
