"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setSaving(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Re-authenticate with current password first to verify identity
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("Could not verify current session.");
      setSaving(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInErr) {
      setError("Current password is incorrect.");
      setSaving(false);
      return;
    }

    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      setError(updateErr.message);
    } else {
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-md">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-text">Settings</h1>
        <p className="mt-1 text-sm text-text/40">Manage your account</p>
      </div>

      <div className="bg-white border border-border-subtle">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text">Change Password</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
              />
            </div>

            {error && <p className="text-xs text-accent">{error}</p>}
            {success && <p className="text-xs text-green-600">{success}</p>}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors disabled:opacity-40"
            >
              {saving ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
