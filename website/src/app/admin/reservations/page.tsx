"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import NewBookingPanel from "@/components/admin/NewBookingPanel";
import { friendlyError } from "@/lib/reservations/adminErrors";

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
  service_id: string | null;
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
  needs_attention: boolean;
  attention_reason: string | null;
  created_at: string;
  restaurants?: { name: string } | null;
}

interface SuggestOption {
  table_ids: string[];
  labels: string[];
  total_capacity: number;
  fits_unassigned: boolean;
}

interface Suggestion {
  options: SuggestOption[];
}

const ACTIVE_STATUSES = ["pending", "confirmed", "arrived", "seated"];

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
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [overridable, setOverridable] = useState<string>("");
  const [reviewOverridable, setReviewOverridable] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);

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

    const nextAssignments: Record<string, string[]> = {};
    if (reservationRows.length) {
      const { data: assignedRows } = await supabase
        .from("reservation_table_assignments")
        .select("reservation_id, table_id")
        .is("released_at", null)
        .in("reservation_id", reservationRows.map((row) => row.id));
      for (const assignment of (assignedRows || []) as AssignmentRow[]) {
        nextAssignments[assignment.reservation_id] = [...(nextAssignments[assignment.reservation_id] || []), assignment.table_id];
      }
    }
    setAssignments(nextAssignments);
    setSelection(nextAssignments);

    // Preselect a suggestion for every active, unassigned reservation so the
    // table picker opens with a sensible default instead of a blank grid.
    const unassigned = reservationRows.filter((row) => ACTIVE_STATUSES.includes(row.status) && !nextAssignments[row.id]?.length && row.service_id);
    if (unassigned.length) {
      const results = await Promise.all(unassigned.map((row) => supabase.rpc("suggest_tables", {
        p_restaurant_id: row.restaurant_id,
        p_service_id: row.service_id,
        p_date: row.date,
        p_time: row.time,
        p_party_size: row.party_size,
        p_exclude_reservation_id: row.id,
      }).then(({ data }) => ({ id: row.id, suggestion: data as Suggestion | null }))));

      const nextSuggestions: Record<string, Suggestion> = {};
      const preselected: Record<string, string[]> = {};
      for (const result of results) {
        if (result.suggestion) {
          nextSuggestions[result.id] = result.suggestion;
          const topOption = result.suggestion.options?.[0];
          if (topOption) preselected[result.id] = topOption.table_ids;
        }
      }
      setSuggestions(nextSuggestions);
      if (Object.keys(preselected).length) {
        setSelection((current) => ({ ...current, ...preselected }));
      }
    } else {
      setSuggestions({});
    }

    const { count } = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("status", "pending");
    setPendingCount(count || 0);

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

  const saveAssignment = async (reservation: ReservationRow, allowOverride = false) => {
    const tableIds = selection[reservation.id] || [];
    if (!tableIds.length) {
      setNotice("Select at least one table, or use Unassign to leave this booking with no table.");
      return;
    }
    setSavingId(reservation.id);
    setNotice("");
    setOverridable("");
    const { error } = await supabase.rpc("set_reservation_tables", {
      p_reservation_id: reservation.id,
      p_table_ids: tableIds,
      p_allow_override: allowOverride,
    });
    if (error) {
      const mapped = friendlyError(error.message);
      setNotice(mapped.text);
      if (mapped.overridable) setOverridable(reservation.id);
    } else {
      setAssignments((current) => ({ ...current, [reservation.id]: tableIds }));
      setNotice(`Tables saved for ${reservation.guest_name}.`);
      void load();
    }
    setSavingId("");
  };

  const unassignTable = async (reservation: ReservationRow, allowOverride = false) => {
    setSavingId(reservation.id);
    setNotice("");
    setOverridable("");
    const { error } = await supabase.rpc("set_reservation_tables", {
      p_reservation_id: reservation.id,
      p_table_ids: [],
      p_allow_override: allowOverride,
    });
    if (error) {
      const mapped = friendlyError(error.message);
      setNotice(mapped.text);
      if (mapped.overridable) setOverridable(reservation.id);
    } else {
      setAssignments((current) => ({ ...current, [reservation.id]: [] }));
      setSelection((current) => ({ ...current, [reservation.id]: [] }));
      setNotice(`${reservation.guest_name} is now unassigned.`);
      void load();
    }
    setSavingId("");
  };

  const reviewPending = async (reservation: ReservationRow, approve: boolean, tableIds: string[], allowOverride = false) => {
    setSavingId(reservation.id);
    setNotice("");
    setReviewOverridable("");
    const { error } = await supabase.rpc("review_pending_reservation", {
      p_reservation_id: reservation.id,
      p_approve: approve,
      p_table_ids: tableIds,
      p_allow_override: allowOverride,
    });
    if (error) {
      const mapped = friendlyError(error.message);
      setNotice(mapped.text);
      if (mapped.overridable) setReviewOverridable(reservation.id);
    } else {
      setNotice(approve ? `${reservation.guest_name} approved.` : `${reservation.guest_name} declined.`);
      void load();
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
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setNewBookingOpen(true)} className="min-h-10 rounded bg-accent px-4 text-xs font-medium uppercase tracking-wide text-white">+ New booking</button>
          <div className="flex flex-wrap gap-1 border border-border-subtle p-0.5">
            {["all", "confirmed", "pending", "cancelled"].map((status) => (
              <button key={status} onClick={() => { setLoading(true); setFilter(status); }} className={`min-h-10 px-3 text-xs capitalize ${filter === status ? "bg-text text-white" : "text-text/50"}`}>
                {status === "pending" ? `Requests${pendingCount ? ` (${pendingCount})` : ""}` : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <NewBookingPanel
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onCreated={() => void load()}
      />

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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider ${STATUS_COLORS[reservation.status] || "bg-background text-text/40"}`}>{reservation.status}</span>
                      {ACTIVE_STATUSES.includes(reservation.status) && !assignedIds.length && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent">No table</span>
                      )}
                      {reservation.needs_attention && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] uppercase tracking-wide text-amber-800">Needs attention</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border-subtle/70 py-3 text-sm">
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Restaurant</p><p className="mt-1 text-text/70">{reservation.restaurants?.name || "—"}</p></div>
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Date & time</p><p className="mt-1 text-text/70">{reservation.date} · {reservation.time}</p></div>
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Party</p><p className="mt-1 text-text/70">{reservation.party_size} guests</p></div>
                    <div><p className="text-[10px] uppercase tracking-widest text-text/35">Channel</p><p className="mt-1 capitalize text-text/70">{reservation.source}</p></div>
                  </div>

                  {reservation.special_requests && <p className="mt-3 text-xs text-text/50">Note: {reservation.special_requests}</p>}

                  {reservation.status === "pending" && (
                    <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
                      <h3 className="text-xs font-medium text-amber-900">Needs approval</h3>
                      {suggestions[reservation.id]?.options?.[0] ? (
                        <p className="mt-1 text-[11px] text-amber-800">Suggested table: {suggestions[reservation.id].options[0].labels.join("+")} ({suggestions[reservation.id].options[0].total_capacity} seats)</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-amber-800">No table suggestion available \u2014 approve with no table and assign one later.</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => void reviewPending(reservation, true, suggestions[reservation.id]?.options?.[0]?.table_ids || [])} disabled={savingId === reservation.id} className="min-h-9 rounded bg-accent-olive px-3 text-[10px] font-medium uppercase tracking-widest text-white disabled:opacity-40">
                          Approve{suggestions[reservation.id]?.options?.[0] ? " (suggested table)" : ""}
                        </button>
                        {suggestions[reservation.id]?.options?.[0] && (
                          <button onClick={() => void reviewPending(reservation, true, [])} disabled={savingId === reservation.id} className="min-h-9 rounded border border-amber-300 bg-white px-3 text-[10px] uppercase tracking-widest text-amber-900 disabled:opacity-40">
                            Approve without a table
                          </button>
                        )}
                        <button onClick={() => void reviewPending(reservation, false, [])} disabled={savingId === reservation.id} className="min-h-9 px-2 text-[10px] text-red-700 underline disabled:opacity-40">
                          Decline
                        </button>
                        {reviewOverridable === reservation.id && (
                          <button onClick={() => void reviewPending(reservation, true, suggestions[reservation.id]?.options?.[0]?.table_ids || [], true)} disabled={savingId === reservation.id} className="min-h-9 rounded bg-accent px-3 text-[10px] font-medium uppercase tracking-widest text-white disabled:opacity-40">
                            Approve anyway
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {reservation.status !== "cancelled" && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-medium text-text">Table assignment</h3>
                        <Link href={`/admin/restaurants/${reservation.restaurant_id}/floorplan`} className="text-[10px] text-text/40 underline">Open floor plan</Link>
                      </div>
                      {suggestions[reservation.id]?.options?.[0] && !assignedIds.length && (
                        <p className="mt-1 text-[11px] text-accent-olive">
                          {`Suggested: ${suggestions[reservation.id].options[0].labels.join("+")} (${suggestions[reservation.id].options[0].total_capacity} seats) \u2014 preselected below.`}
                        </p>
                      )}
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
                        {assignedIds.length > 0 && (
                          <button onClick={() => void unassignTable(reservation)} disabled={savingId === reservation.id} className="min-h-10 rounded border border-border-subtle px-3 text-xs text-text/55 disabled:opacity-30">
                            Unassign
                          </button>
                        )}
                        {overridable === reservation.id && (
                          <button onClick={() => void saveAssignment(reservation, true)} disabled={savingId === reservation.id} className="min-h-10 rounded bg-accent px-3 text-[10px] font-medium uppercase tracking-widest text-white disabled:opacity-40">
                            Book anyway
                          </button>
                        )}
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
