"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { AdminInput, FormField } from "@/components/admin/FormField";
import { Empty, Loading, PageHeader, useNotice } from "@/components/admin/ui";

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
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const { say, fail, clear, snackbar } = useNotice();

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  useEffect(() => {
    // State is set after the fetch resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    setAdding(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      fail(data.error || "Couldn't add them. Try again.");
    } else {
      say(`${username} can now sign in.`);
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
      fail(data.error);
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const usernameFromEmail = (email: string) =>
    email.replace(/@(sundayroseclub|goodroomhouse)\.com$/i, "");

  return (
    <div className="page page-narrow">
      <PageHeader title="Team" sub="People who can sign in to this admin" />

      <div className="card flush rows">
        {loading ? (
          <Loading />
        ) : users.length === 0 ? (
          <Empty title="No one here yet" sub="Add someone below to give them access." />
        ) : (
          users.map((user) => (
            <div key={user.id} className="row">
              <div className="row-main">
                <p className="row-title truncate">{usernameFromEmail(user.email)}</p>
                <p className="row-sub truncate">{user.email}</p>
              </div>
              <span className="tag capitalize">{user.role}</span>
              <button type="button" onClick={() => setDeleteTarget(user)} className="btn btn-danger btn-sm">
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <section className="card mt-6">
        <h2 className="t-h4">Add someone</h2>
        <p className="t-sub mt-1 mb-6">Their username becomes username@sundayroseclub.com</p>
        <form onSubmit={handleAdd} className="form">
          <div className="form-2">
            <FormField label="Username" required>
              <AdminInput
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                required
                placeholder="ajay"
              />
            </FormField>
            <FormField label="Password" required>
              <AdminInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </FormField>
          </div>
          <div>
            <button type="submit" disabled={adding} className="btn btn-primary">
              {adding ? "Adding…" : "Add to team"}
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove from team?"
        message={`${usernameFromEmail(deleteTarget?.email || "")} won't be able to sign in to the admin anymore.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {snackbar}
    </div>
  );
}
