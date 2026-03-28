"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  cuisine: string;
  hours: string;
  is_active: boolean;
  featured: boolean;
  sort_order: number;
}

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantRow | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("id, name, slug, cuisine, hours, is_active, featured, sort_order")
      .order("sort_order")
      .order("created_at")
      .then(({ data }) => {
        setRestaurants(data || []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= restaurants.length) return;

    setSaving(true);
    const updated = [...restaurants];
    // Swap sort_order values
    const aOrder = updated[index].sort_order;
    const bOrder = updated[swapIndex].sort_order;
    updated[index] = { ...updated[index], sort_order: bOrder };
    updated[swapIndex] = { ...updated[swapIndex], sort_order: aOrder };

    // If sort_orders are equal, assign distinct values
    if (aOrder === bOrder) {
      updated.forEach((r, i) => { r.sort_order = i + 1; });
    }

    // Persist both updates
    await Promise.all([
      supabase.from("restaurants").update({ sort_order: updated[index].sort_order }).eq("id", updated[index].id),
      supabase.from("restaurants").update({ sort_order: updated[swapIndex].sort_order }).eq("id", updated[swapIndex].id),
    ]);

    // Re-sort locally and update state
    updated.sort((a, b) => a.sort_order - b.sort_order);
    setRestaurants(updated);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("restaurants").delete().eq("id", deleteTarget.id);
    setRestaurants((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-text">Restaurants</h1>
          <p className="mt-1 text-sm text-text/40">
            Manage dining experiences · drag to reorder
          </p>
        </div>
        <Link
          href="/admin/restaurants/new"
          className="px-4 py-2 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors"
        >
          + Add Restaurant
        </Link>
      </div>

      <div className="bg-white border border-border-subtle">
        {loading ? (
          <p className="p-8 text-sm text-text/30">Loading...</p>
        ) : restaurants.length === 0 ? (
          <p className="p-8 text-sm text-text/30">No restaurants yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40 w-20">Order</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Name</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Cuisine</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Status</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Featured</th>
                <th className="px-5 py-3 text-right text-xs uppercase tracking-widest text-text/40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r, i) => (
                <tr key={r.id} className="border-b border-border-subtle/50 hover:bg-background transition-colors">
                  {/* Order controls */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-text/20 w-5 text-center">{i + 1}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => move(i, "up")}
                          disabled={i === 0 || saving}
                          className="text-text/25 hover:text-text disabled:opacity-10 transition-colors leading-none px-1"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => move(i, "down")}
                          disabled={i === restaurants.length - 1 || saving}
                          className="text-text/25 hover:text-text disabled:opacity-10 transition-colors leading-none px-1"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-text">{r.name}</td>
                  <td className="px-5 py-3 text-text/50">{r.cuisine}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 ${r.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {r.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.featured && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-accent-gold/10 text-accent-gold">
                        Homepage
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/admin/restaurants/${r.id}`} className="text-xs text-text/50 hover:text-text">Edit</Link>
                      <button onClick={() => setDeleteTarget(r)} className="text-xs text-accent hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {saving && (
          <p className="px-5 py-2 text-xs text-text/30 border-t border-border-subtle">Saving order...</p>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Restaurant"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
