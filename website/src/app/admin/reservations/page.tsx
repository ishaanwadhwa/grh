"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface ReservationRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_phone_code: string;
  is_whatsapp: boolean;
  date: string;
  time: string;
  party_size: number;
  status: string;
  source: string;
  special_requests: string | null;
  created_at: string;
  restaurants?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  cancelled: "bg-red-50 text-red-600",
};

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<ReservationRow | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let query = supabase
      .from("reservations")
      .select("*, restaurants(name)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    query.then(({ data }) => {
      setReservations(data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await supabase.from("reservations").update({ status: "cancelled" }).eq("id", cancelTarget.id);
    setReservations((prev) => prev.map((r) => r.id === cancelTarget.id ? { ...r, status: "cancelled" } : r));
    setCancelTarget(null);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl text-text">Reservations</h1>
          <p className="mt-1 text-sm text-text/40">{reservations.length} total</p>
        </div>
        <div className="flex flex-wrap gap-1 border border-border-subtle p-0.5">
          {["all", "confirmed", "pending", "cancelled"].map((s) => (
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
        ) : reservations.length === 0 ? (
          <p className="p-8 text-sm text-text/30">No reservations found.</p>
        ) : (
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border-subtle">
                {["Guest", "Restaurant", "Date & Time", "Party", "Source", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-text/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle/50 hover:bg-background transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{r.guest_name}</p>
                    <p className="text-xs text-text/40">{r.guest_email}</p>
                    {r.guest_phone && (
                      <p className="text-xs text-text/30 flex items-center gap-1">
                        {r.guest_phone_code} {r.guest_phone}
                        {r.is_whatsapp && <span className="text-green-500">·WA</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text/60 text-xs">{r.restaurants?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text/70">{r.date}</p>
                    <p className="text-xs text-text/40">{r.time}</p>
                  </td>
                  <td className="px-4 py-3 text-text/50 text-center">{r.party_size}</td>
                  <td className="px-4 py-3 text-text/40 text-xs capitalize">{r.source}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 ${STATUS_COLORS[r.status] || "bg-background text-text/40"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== "cancelled" && (
                      <button onClick={() => setCancelTarget(r)} className="text-xs text-accent hover:underline">
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
        title="Cancel Reservation"
        message={`Cancel reservation for "${cancelTarget?.guest_name}"?`}
        confirmLabel="Cancel Reservation"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
