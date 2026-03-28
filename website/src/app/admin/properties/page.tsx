"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface PropertyRow {
  id: string;
  name: string;
  slug: string;
  location: string;
  created_at: string;
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name, slug, location, created_at")
      .order("created_at")
      .then(({ data }) => {
        setProperties(data || []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("properties").delete().eq("id", deleteTarget.id);
    setProperties((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-text">Properties</h1>
          <p className="mt-1 text-sm text-text/40">Manage Good Room House locations</p>
        </div>
        <Link
          href="/admin/properties/new"
          className="px-4 py-2 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors"
        >
          + Add Property
        </Link>
      </div>

      <div className="bg-white border border-border-subtle">
        {loading ? (
          <p className="p-8 text-sm text-text/30">Loading...</p>
        ) : properties.length === 0 ? (
          <p className="p-8 text-sm text-text/30">No properties yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Name</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Slug</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Location</th>
                <th className="px-5 py-3 text-right text-xs uppercase tracking-widest text-text/40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((prop) => (
                <tr key={prop.id} className="border-b border-border-subtle/50 hover:bg-background transition-colors">
                  <td className="px-5 py-3 font-medium text-text">{prop.name}</td>
                  <td className="px-5 py-3 text-text/40 font-mono text-xs">{prop.slug}</td>
                  <td className="px-5 py-3 text-text/50">{prop.location}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/properties/${prop.id}/rooms`}
                        className="text-xs text-accent-gold hover:underline"
                      >
                        Rooms
                      </Link>
                      <Link
                        href={`/admin/properties/${prop.id}`}
                        className="text-xs text-text/50 hover:text-text transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(prop)}
                        className="text-xs text-accent hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Property"
        message={`Delete "${deleteTarget?.name}"? This will also delete all rooms. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
