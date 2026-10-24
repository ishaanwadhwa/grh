"use client";

// Reservations: every table booking, by day. Read, call, cancel.
// Seating and table moves happen in one place only: the live floor.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { ENDED, needsTable } from "@/components/admin/floor";
import { Empty, Loading, PageHeader, StatusTag, fmtDay, fmtTime, plural, sourceLabel, todayIn, useNotice } from "@/components/admin/ui";

interface ReservationRow {
  id: string;
  restaurant_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string;
  guest_phone_code: string;
  is_whatsapp: boolean;
  phone_verified: boolean | null;
  date: string;
  time: string;
  party_size: number;
  status: string;
  source: string;
  special_requests: string | null;
  restaurants?: { name: string } | null;
  reservation_table_assignments?: { released_at: string | null; restaurant_tables: { label: string } | null }[] | null;
}

/** Table names held right now, from the assignments fetched with the booking. */
const tablesHeld = (r: ReservationRow) => (r.reservation_table_assignments || []).filter((a) => !a.released_at).map((a) => a.restaurant_tables?.label || "?");

type Filter = "upcoming" | "past" | "cancelled" | "all";
const FILTERS: [Filter, string][] = [["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"], ["all", "All"]];
const LIMIT = 200; // past and all can run long; the newest come first

export default function AdminReservationsPage() {
  const supabase = createClient();
  const today = todayIn();
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<ReservationRow | null>(null);
  const { say, fail, snackbar } = useNotice();

  const load = useCallback(async () => {
    const past = filter === "past" || filter === "all";
    let query = supabase.from("reservations")
      .select("*, restaurants(name), reservation_table_assignments(released_at, restaurant_tables(label))")
      .order("date", { ascending: !past }).order("time", { ascending: !past }).limit(LIMIT);
    if (filter === "upcoming") query = query.gte("date", today).neq("status", "cancelled");
    if (filter === "past") query = query.lt("date", today).neq("status", "cancelled");
    if (filter === "cancelled") query = query.eq("status", "cancelled");
    const { data, error } = await query;
    if (error) fail(error);
    setReservations((data || []) as ReservationRow[]);
    setLoading(false);
  }, [filter, supabase, today, fail]);

  useEffect(() => { void load(); }, [load]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    setCancelTarget(null);
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", target.id);
    if (error) { fail(error); return; }
    setReservations((current) => filter === "all"
      ? current.map((r) => r.id === target.id ? { ...r, status: "cancelled", reservation_table_assignments: [] } : r)
      : current.filter((r) => r.id !== target.id));
    say(`${target.guest_name}'s booking cancelled. The table is free.`);
  };

  const waiting = (r: ReservationRow) => r.date >= today && needsTable(r, tablesHeld(r));
  const needTable = reservations.filter(waiting).length;
  const byDay = reservations.reduce<Record<string, ReservationRow[]>>((acc, r) => { (acc[r.date] ||= []).push(r); return acc; }, {});

  return (
    <div className="page">
      <PageHeader
        title="Reservations"
        sub={loading ? undefined : filter === "upcoming" ? `${plural(reservations.length, "upcoming booking")}${needTable ? ` · ${needTable} need a table` : ""}` : plural(reservations.length, "booking")}
        actions={<Link href="/admin/service" className="btn btn-secondary">Open live floor</Link>}
      />

      <div className="pills" role="group" aria-label="Show">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className="pill" aria-pressed={filter === key} onClick={() => { setLoading(true); setFilter(key); }}>{label}</button>
        ))}
      </div>

      {loading ? <Loading /> : reservations.length === 0 ? (
        <section className="card">
          <Empty
            title={filter === "upcoming" ? "No upcoming bookings" : filter === "cancelled" ? "No cancellations" : "No bookings here"}
            sub={filter === "upcoming" ? "New bookings from the website land here and on the live floor." : undefined}
          />
        </section>
      ) : (
        <div className="stack">
          {Object.entries(byDay).map(([date, rows]) => (
            <section key={date} className="card flush">
              <div className="card-head">
                <h2 className="t-h4">{date === today ? `Today · ${fmtDay(date)}` : fmtDay(date)}</h2>
                <p className="t-sub">{plural(rows.reduce((s, r) => s + r.party_size, 0), "guest")}</p>
              </div>
              <div className="rows">
                {rows.map((r) => {
                  const tables = tablesHeld(r);
                  const live = r.date >= today && !ENDED.includes(r.status);
                  return (
                    <div key={r.id} className="row items-start">
                      <span className="t-h4 w-[76px] shrink-0">{fmtTime(r.time)}</span>
                      <div className="row-main">
                        <p className="row-title">{r.guest_name}</p>
                        <p className="row-sub">
                          {plural(r.party_size, "guest")}
                          {r.restaurants?.name ? ` · ${r.restaurants.name}` : ""}
                          {tables.length ? ` · ${tables.join(", ")}` : ""}
                          {` · ${sourceLabel(r.source)}`}
                        </p>
                        <p className="row-sub">
                          {r.guest_phone
                            ? <a className="link font-normal" href={`tel:${r.guest_phone_code}${r.guest_phone}`}>{r.guest_phone_code} {r.guest_phone}</a>
                            : r.guest_email}
                          {r.guest_phone && r.is_whatsapp ? " · WhatsApp" : ""}
                        </p>
                        {r.special_requests && <p className="t-sub mt-1 text-(--ink-2)">“{r.special_requests}”</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <StatusTag status={r.status} />
                          {waiting(r) && <StatusTag status="needs_table" />}
                          {r.phone_verified === false && <StatusTag status="unverified" title="Booked without a phone code. Confirm on WhatsApp." />}
                        </div>
                      </div>
                      {live && r.status !== "seated" && (
                        <button type="button" onClick={() => setCancelTarget(r)} className="btn btn-danger btn-sm -mr-3 shrink-0">Cancel</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this booking?"
        message={`${cancelTarget?.guest_name || "This guest"}'s table is released. Let them know on WhatsApp or a call.`}
        confirmLabel="Cancel booking"
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelTarget(null)}
      />
      {snackbar}
    </div>
  );
}
