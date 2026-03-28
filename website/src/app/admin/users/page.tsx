"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setAdding(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create user");
    } else {
      setSuccess(`Admin "${username}" created successfully.`);
      setUsername("");
      setPassword("");
      loadUsers();
    }

    setAdding(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: deleteTarget.id }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const usernameFromEmail = (email: string) =>
    email.replace("@goodroomhouse.com", "");

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-text">Admin Users</h1>
        <p className="mt-1 text-sm text-text/40">Manage who has access to this panel</p>
      </div>

      {/* Existing admins */}
      <div className="bg-white border border-border-subtle mb-10">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text">Current Admins</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-text/30">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Username</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Email</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Role</th>
                <th className="px-5 py-3 text-right text-xs uppercase tracking-widest text-text/40"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border-subtle/50">
                  <td className="px-5 py-3 font-medium text-text">
                    {usernameFromEmail(user.email)}
                  </td>
                  <td className="px-5 py-3 text-text/40 text-xs">{user.email}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-accent-gold/10 text-accent-gold">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="text-xs text-accent hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add new admin */}
      <div className="bg-white border border-border-subtle">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text">Add New Admin</h2>
          <p className="mt-0.5 text-xs text-text/40">
            Username becomes <span className="font-mono">username@goodroomhouse.com</span>
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                  required
                  placeholder="ajay"
                  className="w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
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
                  className="w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                />
              </div>
            </div>

            {error && <p className="text-xs text-accent">{error}</p>}
            {success && <p className="text-xs text-green-600">{success}</p>}

            <button
              type="submit"
              disabled={adding}
              className="px-6 py-2.5 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors disabled:opacity-40"
            >
              {adding ? "Creating..." : "Create Admin"}
            </button>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Admin"
        message={`Remove "${usernameFromEmail(deleteTarget?.email || "")}" from admin access? They will no longer be able to log in.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
