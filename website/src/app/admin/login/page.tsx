"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

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

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Accept either "sahar" (username) or full email
    const email = username.includes("@") ? username : `${username}@goodroomhouse.com`;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Verify admin access
    const res = await fetch("/api/admin/check");
    const data = await res.json();

    if (!data.isAdmin) {
      await supabase.auth.signOut();
      setError("You do not have admin access.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="font-display text-2xl text-text tracking-[0.15em]">GOOD ROOM HOUSE</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-accent-gold/60">Admin Panel</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="sahar"
              className="w-full border border-border-subtle bg-white px-4 py-3 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full border border-border-subtle bg-white px-4 py-3 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-accent text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-text text-text-inverse py-3 text-xs uppercase tracking-widest font-medium hover:bg-text/80 transition-colors disabled:opacity-40"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
