"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface TableOption {
  id: string;
  restaurant_id: string;
  label: string;
  max_capacity: number;
  zone: string;
}

interface ReservationRow {
  id: string;
  restaurant_id: string;
  starts_at: string | null;
  ends_at: string | null;
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

interface AssignmentRow {
  reservation_id: string;
  table_id: string;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  cancelled: "bg-red-50 text-red-600",
};

export default function AdminReservationsPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<ReservationRow | null>(null);
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    let query = supabase
      .from("reservations")
      .select("*, restaurants(name)")
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (filter !== "all") query = query.eq("status", filter);

    const [{ data: rows, error }, { data: tableRows }] = await Promise.all([
      query,
      supabase.from("restaurant_tables").select("id, restaurant_id, label, max_capacity, zone").eq("is_active", true).order("label"),
    ]);
    if (error) {
      setNotice(error.message);
      setReservations([]);
      setLoading(false);
      return;
    }

    const reservationRows = (rows || []) as ReservationRow[];
    setReservations(reservationRows);
    setTables((tableRows || []) as TableOption[]);

    if (reservationRows.length) {
      const { data: assignedRows } = await supabase
        .from("reservation_table_assignments")
        .select("reservation_id, table_id")
        .is("released_at", null)
        .in("reservation_id", reservationRows.map((row) => row.id));
      const next: Record<string, string[]> = {};
      for (const assignment of (assignedRows || []) as AssignmentRow[]) {
        next[assignment.reservation_id] = [...(next[assignment.reservation_id] || []), assignment.table_id];
      }
      setAssignments(next);
      setSelection(next);
    } else {
      setAssignments({});
      setSelection({});
    }
    setLoading(false);
  }, [filter, supabase]);

  // Loading remote reservation data is an intentional effect-driven state sync.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const toggleTable = (reservationId: string, tableId: string) => {
    setSelection((current) => {
      const chosen = current[reservationId] || [];
      const updated = chosen.includes(tableId)
        ? chosen.filter((id) => id !== tableId)
        : [...chosen, tableId];
      return { ...current, [reservationId]: updated };
    });
  };

  const saveAssignment = async (reservation: ReservationRow) => {
    const tableIds = selection[reservation.id] || [];
    if (!tableIds.length) {
      setNotice("Select at least one table. To free a table, cancel the reservation or select a replacement first.");
      return;
    }
    setSavingId(reservation.id);
    setNotice("");
    const { error } = await supabase.rpc("assign_reservation_tables", {
      p_reservation_id: reservation.id,
      p_table_ids: tableIds,
    });
    if (error) {
      setNotice(error.message.includes("reservation_table_no_overlap")
        ? "One of those tables is already assigned during this time. Choose another table."
        : error.message);
    } else {
      setAssignments((current) => ({ ...current, [reservation.id]: tableIds }));
      setNotice(`Tables saved for ${reservation.guest_name}.`);
    }
    setSavingId("");
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", cancelTarget.id);
    if (error) setNotice(error.message);
    else {
      setReservations((current) => current.map((row) => row.id === cancelTarget.id ? { ...row, status: "cancelled" } : row));
      setAssignments((current) => ({ ...current, [cancelTarget.id]: [] }));
      setSelection((current) => ({ ...current, [cancelTarget.id]: [] }));
      setNotice("Reservation cancelled and its table released.");
    }
    setCancelTarget(null);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 pb-12 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-text">Reservations</h1>
          <p className="mt-1 text-sm text-text/40">{reservations.length} reservations · assign tables below</p>
        </div>
        <div className="flex flex-wrap gap-1 border border-border-subtle p-0.5">
          {["all", "confirmed", "pending", "cancelled"].map((status) => (
            <button key={status} onClick={() => { setLoading(true); setFilter(status); }} className={`min-h-10 px-3 text-xs capitalize ${filter === status ? "bg-text text-white" : "text-text/50"}`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      {notice && <p className="mb-4 rounded border border-border-subtle bg-white p-3 text-sm text-text/60" role="status">{notice}</p>}

      {loading ? <p className="rounded border border-border-subtle bg-white p-6 text-sm text-text/40">Loading reservations…</p>
        : reservations.length === 0 ? <p className="rounded border border-border-subtle bg-white p-6 text-sm text-text/40">No reservations found.</p>
          : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {reservations.map((reservation) => {
              const assignedIds = assignments[reservation.id] || [];
              const restaurantTables = tables.filter((table) => table.restaurant_id === reservation.restaurant_id);
              const dirty = JSON.stringify([...(selection[reservation.id] || [])].sort()) !== JSON.stringify([...assignedIds].sort());
              return (
                <article key={reservation.id} className="rounded border border-border-subtle bg-white p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-text">{reservation.guest_name}</h2>
                      <p className="mt-1 break-all text-xs text-text/50">{reservation.guest_email}</p>
                      {reservation.guest_phone && <p className="mt-1 text-xs text-text/40">{reservation.guest_phone_code} {reservation.guest_phone}{reservation.is_whatsapp ? " · WhatsApp" : ""}</p>}
                    </div>
                    <span className={`shrink-0 rounded px-2 py-1 text-[10px] uppercase tracking-wider ${STATUS_COLORS[reservation.status] || "bg-background text-text/40"}`}>{reservation.status}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border-subtle/70 py-3 text-sm">
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Restaurant</p><p className="mt-1 text-text/70">{reservation.restaurants?.name || "—"}</p></div>
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Date & time</p><p className="mt-1 text-text/70">{reservation.date} · {reservation.time}</p></div>
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Party</p><p className="mt-1 text-text/70">{reservation.party_size} guests</p></div>
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Channel</p><p className="mt-1 capitalize text-text/70">{reservation.source}</p></div>
                  </div>

                  {reservation.special_requests && <p className="mt-3 text-xs text-text/50">Note: {reservation.special_requests}</p>}

                  {reservation.status !== "cancelled" && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-medium text-text">Table assignment</h3>
                        <Link href={`/admin/restaurants/${reservation.restaurant_id}/floorplan`} className="text-[10px] text-text/40 underline">Open floor plan</Link>
                      </div>
                      {restaurantTables.length ? (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {restaurantTables.map((table) => {
                            const checked = (selection[reservation.id] || []).includes(table.id);
                            return (
                              <label key={table.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs ${checked ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-border-subtle text-text/60"}`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleTable(reservation.id, table.id)} />
                                <span className="min-w-0 truncate">{table.label} · {table.max_capacity} seats{table.zone ? ` · ${table.zone}` : ""}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : <p className="mt-2 text-xs text-text/40">No tables yet. Upload a floor plan and configure tables first.</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button onClick={() => void saveAssignment(reservation)} disabled={!restaurantTables.length || !dirty || savingId === reservation.id} className="min-h-10 rounded bg-text px-4 text-xs uppercase tracking-widest text-white disabled:opacity-30">
                          {savingId === reservation.id ? "Saving…" : "Save table assignment"}
                        </button>
                        {assignedIds.length > 0 && <p className="text-xs text-text/40">Assigned: {assignedIds.map((id) => restaurantTables.find((table) => table.id === id)?.label).filter(Boolean).join(", ")}</p>}
                      </div>
                    </div>
                  )}

                  {reservation.status !== "cancelled" && <button onClick={() => setCancelTarget(reservation)} className="mt-4 text-xs text-red-600 underline">Cancel reservation</button>}
                </article>
              );
            })}
          </div>}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Reservation"
        message={`Cancel reservation for "${cancelTarget?.guest_name}"? Its table assignment will be released.`}
        confirmLabel="Cancel Reservation"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
