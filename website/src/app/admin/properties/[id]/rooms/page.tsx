"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface RoomRow {
  id: string;
  name: string;
  slug: string;
  bed_type: string;
  capacity: number;
  base_price_per_night: number;
  is_active: boolean;
  sort_order: number;
}

export default function AdminRoomsPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RoomRow | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    Promise.all([
      supabase.from("properties").select("name").eq("id", propertyId).single(),
      supabase
        .from("rooms")
        .select("id, name, slug, bed_type, capacity, base_price_per_night, is_active, sort_order")
        .eq("property_id", propertyId)
        .order("sort_order"),
    ]).then(([prop, roomsRes]) => {
      if (prop.data) setPropertyName(prop.data.name);
      setRooms(roomsRes.data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("rooms").delete().eq("id", deleteTarget.id);
    setRooms((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const toggleActive = async (room: RoomRow) => {
    const newValue = !room.is_active;
    await supabase.from("rooms").update({ is_active: newValue }).eq("id", room.id);
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, is_active: newValue } : r));
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/admin/properties/${propertyId}`} className="text-xs text-text/40 hover:text-text">← {propertyName}</Link>
            <span className="text-text/20">/</span>
            <span className="text-xs text-text/50">Rooms</span>
          </div>
          <h1 className="font-display text-2xl text-text">Rooms</h1>
        </div>
        <Link
          href={`/admin/properties/${propertyId}/rooms/new`}
          className="px-4 py-2 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors self-start shrink-0"
        >
          + Add Room
        </Link>
      </div>

      <div className="bg-white border border-border-subtle">
        {loading ? (
          <p className="p-8 text-sm text-text/30">Loading...</p>
        ) : rooms.length === 0 ? (
          <p className="p-8 text-sm text-text/30">No rooms yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">#</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Name</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Bed</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Guests</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Price/Night</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Status</th>
                <th className="px-5 py-3 text-right text-xs uppercase tracking-widest text-text/40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-border-subtle/50 hover:bg-background transition-colors">
                  <td className="px-5 py-3 text-text/30 text-xs">{room.sort_order}</td>
                  <td className="px-5 py-3 font-medium text-text">{room.name}</td>
                  <td className="px-5 py-3 text-text/50">{room.bed_type}</td>
                  <td className="px-5 py-3 text-text/50">{room.capacity}</td>
                  <td className="px-5 py-3 text-text/70">₹{room.base_price_per_night.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(room)}
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 transition-colors ${
                        room.is_active ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-red-50 text-red-500 hover:bg-red-100"
                      }`}
                    >
                      {room.is_active ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/admin/properties/${propertyId}/rooms/${room.id}`} className="text-xs text-text/50 hover:text-text">
                        Edit
                      </Link>
                      <button onClick={() => setDeleteTarget(room)} className="text-xs text-accent hover:underline">
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
        title="Delete Room"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
