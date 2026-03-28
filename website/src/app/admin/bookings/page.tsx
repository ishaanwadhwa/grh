"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface BookingRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_phone_code: string;
  is_whatsapp: boolean;
  check_in: string;
  check_out: string;
  guests: number;
  total_amount: number;
  currency: string;
  status: string;
  source: string;
  special_requests: string | null;
  created_at: string;
  rooms?: { name: string } | null;
  properties?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  cancelled: "bg-red-50 text-red-600",
  completed: "bg-blue-50 text-blue-700",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let query = supabase
      .from("bookings")
      .select("*, rooms(name), properties(name)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    query.then(({ data }) => {
      setBookings(data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", cancelTarget.id);
    setBookings((prev) => prev.map((b) => b.id === cancelTarget.id ? { ...b, status: "cancelled" } : b));
    setCancelTarget(null);
  };

  const nights = (checkIn: string, checkOut: string) =>
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl text-text">Bookings</h1>
          <p className="mt-1 text-sm text-text/40">{bookings.length} total</p>
        </div>
        {/* Filter */}
        <div className="flex flex-wrap gap-1 border border-border-subtle p-0.5">
          {["all", "confirmed", "pending", "cancelled", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs capitalize transition-all ${filter === s ? "bg-text text-text-inverse" : "text-text/50 hover:text-text"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border-subtle overflow-x-auto">
        {loading ? (
          <p className="p-8 text-sm text-text/30">Loading...</p>
        ) : bookings.length === 0 ? (
          <p className="p-8 text-sm text-text/30">No bookings found.</p>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border-subtle">
                {["Guest", "Room", "Dates", "Guests", "Amount", "Source", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-text/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-border-subtle/50 hover:bg-background transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{b.guest_name}</p>
                    <p className="text-xs text-text/40">{b.guest_email}</p>
                    {b.guest_phone && (
                      <p className="text-xs text-text/30 flex items-center gap-1">
                        {b.guest_phone_code} {b.guest_phone}
                        {b.is_whatsapp && <span className="text-green-500">·WA</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text/60 text-xs">{b.rooms?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text/70">{b.check_in} → {b.check_out}</p>
                    <p className="text-xs text-text/30">{nights(b.check_in, b.check_out)} nights</p>
                  </td>
                  <td className="px-4 py-3 text-text/50 text-center">{b.guests}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text font-medium">{b.currency} {b.total_amount.toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3 text-text/40 text-xs capitalize">{b.source}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 ${STATUS_COLORS[b.status] || "bg-background text-text/40"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {b.status !== "cancelled" && b.status !== "completed" && (
                      <button
                        onClick={() => setCancelTarget(b)}
                        className="text-xs text-accent hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Booking"
        message={`Cancel booking for "${cancelTarget?.guest_name}"? This will free up the room.`}
        confirmLabel="Cancel Booking"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
