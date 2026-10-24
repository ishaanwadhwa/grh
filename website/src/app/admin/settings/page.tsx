"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminInput, FormField } from "@/components/admin/FormField";
import { PageHeader, useNotice } from "@/components/admin/ui";

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { say, fail, clear, snackbar } = useNotice();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();

    if (newPassword !== confirmPassword) {
      fail("The new passwords don't match.");
      return;
    }
    if (newPassword.length < 4) {
      fail("Password must be at least 4 characters.");
      return;
    }

    setSaving(true);

    const supabase = createClient();

    // Re-authenticate with current password first to verify identity
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      fail("We couldn't check your session. Sign in again and retry.");
      setSaving(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInErr) {
      fail("Your current password isn't right.");
      setSaving(false);
      return;
    }

    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      fail(updateErr.message);
    } else {
      say("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setSaving(false);
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Settings" sub="Your account" />

      <section className="card">
        <h2 className="t-h4 mb-6">Change password</h2>
        <form onSubmit={handleChangePassword} className="form">
          <FormField label="Current password" required>
            <AdminInput type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="••••••••" />
          </FormField>
          <FormField label="New password" required hint="At least 4 characters.">
            <AdminInput type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••" />
          </FormField>
          <FormField label="Confirm new password" required>
            <AdminInput type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
          </FormField>
          <div>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>

      {snackbar}
    </div>
  );
}
