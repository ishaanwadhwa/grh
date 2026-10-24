"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { PageHeader, StatusTag, fmtDate, fmtMoney, plural, sourceLabel, useNotice } from "@/components/admin/ui";

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

const FILTERS = [["all", "All"], ["confirmed", "Confirmed"], ["pending", "Pending"], ["cancelled", "Cancelled"], ["completed", "Finished"]] as const;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [filter, setFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);

  const { fail, snackbar } = useNotice();
  const supabase = createClient();

  useEffect(() => {
    let query = supabase
      .from("bookings")
      .select("*, rooms(name), properties(name)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    query.then(({ data, error }) => {
      if (error) { fail(error); setLoadState("failed"); return; }
      setBookings(data);
      setLoadState("ready");
    });
  }, [filter, supabase, fail]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", cancelTarget.id);
    if (error) fail(error);
    else setBookings((prev) => prev.map((b) => b.id === cancelTarget.id ? { ...b, status: "cancelled" } : b));
    setCancelTarget(null);
  };

  const nights = (checkIn: string, checkOut: string) =>
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);

  const columns: Column<BookingRow>[] = [
    {
      key: "guest_name",
      header: "Guest",
      render: (b) => (
        <>
          {b.guest_name}
          {b.guest_email && <p className="t-sub break-all">{b.guest_email}</p>}
          {b.guest_phone && <p className="t-sub">{b.guest_phone_code} {b.guest_phone}{b.is_whatsapp ? " (WhatsApp)" : ""}</p>}
        </>
      ),
    },
    { key: "room", header: "Room", render: (b) => b.rooms?.name || "—" },
    {
      key: "dates",
      header: "Dates",
      render: (b) => (
        <>
          <p className="whitespace-nowrap">{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</p>
          <p className="t-cap">{plural(nights(b.check_in, b.check_out), "night")}</p>
        </>
      ),
    },
    { key: "guests", header: "Guests", render: (b) => <span className="t-num">{b.guests}</span> },
    { key: "amount", header: "Amount", render: (b) => <span className="t-num whitespace-nowrap text-(--ink)">{fmtMoney(b.total_amount, b.currency)}</span> },
    { key: "source", header: "Source", render: (b) => sourceLabel(b.source) },
    { key: "status", header: "Status", render: (b) => <StatusTag status={b.status} /> },
    {
      key: "actions",
      header: "",
      render: (b) => b.status !== "cancelled" && b.status !== "completed" && (
        <button type="button" onClick={() => setCancelTarget(b)} className="btn btn-danger btn-sm">Cancel</button>
      ),
    },
  ];
  const filterLabel = FILTERS.find(([status]) => status === filter)?.[1].toLowerCase();

  return (
    <div className="page">
      <PageHeader title="Room bookings" sub={loadState === "ready" ? plural(bookings.length, "booking") : undefined} />

      <div className="pills" role="group" aria-label="Filter by status">
        {FILTERS.map(([status, label]) => (
          <button key={status} type="button" className="pill" aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {label}
          </button>
        ))}
      </div>

      {loadState !== "failed" && (
        <div className="card flush">
          <DataTable
            columns={columns}
            data={bookings}
            loading={loadState === "loading"}
            keyExtractor={(b) => b.id}
            emptyMessage={filter === "all" ? "No room bookings yet" : `No ${filterLabel} bookings`}
            emptySub={filter === "all" ? "Stays booked on the website show up here." : "Try another filter to see the rest."}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel booking"
        message={`Cancel the booking for ${cancelTarget?.guest_name}? The room will be free again.`}
        confirmLabel="Cancel booking"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
      {snackbar}
    </div>
  );
}
