"use client";

// Overview: today first. What's booked, what needs a table, who's checking in. Setup lives below.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ENDED_FILTER, WITH_TABLES, needsTable, tablesOf } from "@/components/admin/floor";
import { Chevron, Empty, Loading, PageHeader, StatusTag, fmtDate, fmtDay, fmtMoney, fmtTime, plural, todayIn, useNotice } from "@/components/admin/ui";

interface TodayReservation {
  id: string;
  guest_name: string;
  time: string;
  party_size: number;
  status: string;
  restaurants?: { name: string } | null;
  reservation_table_assignments?: { table_id: string; released_at: string | null }[] | null;
}

interface Stay {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  currency: string;
}

export default function AdminOverview() {
  const supabase = createClient();
  const today = todayIn();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<TodayReservation[]>([]);
  const { fail, snackbar } = useNotice();
  const [stays, setStays] = useState<Stay[]>([]);
  const [counts, setCounts] = useState({ restaurants: 0, properties: 0, events: 0 });

  useEffect(() => {
    async function load() {
      const [res, stay, rests, props, events] = await Promise.all([
        supabase.from("reservations")
          .select(`id, guest_name, time, party_size, status, restaurants(name), ${WITH_TABLES}`)
          .eq("date", today)
          .not("status", "in", ENDED_FILTER)
          .order("time"),
        supabase.from("bookings")
          .select("id, guest_name, check_in, check_out, status, total_amount, currency")
          .gte("check_out", today)
          .neq("status", "cancelled")
          .order("check_in")
          .limit(6),
        supabase.from("restaurants").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
      ]);
      if (res.error || stay.error) fail((res.error || stay.error)!);
      setReservations((res.data || []) as unknown as TodayReservation[]);
      setStays((stay.data || []) as Stay[]);
      setCounts({ restaurants: rests.count || 0, properties: props.count || 0, events: events.count || 0 });
      setLoading(false);
    }
    void load();
  }, [supabase, today, fail]);

  if (loading) return <Loading />;

  const guests = reservations.reduce((sum, r) => sum + r.party_size, 0);
  const waiting = (r: TodayReservation) => needsTable(r, tablesOf(r));
  const needTable = reservations.filter(waiting).length;
  const seatedNow = reservations.filter((r) => r.status === "seated").length;
  const checkIns = stays.filter((s) => s.check_in === today).length;

  const tiles = [
    { label: "Bookings today", value: reservations.length, sub: plural(guests, "guest"), href: "/admin/service" },
    { label: "Need a table", value: needTable, sub: needTable ? "Assign on the live floor" : "All set", href: "/admin/service", warn: needTable > 0 },
    { label: "Seated now", value: seatedNow, sub: "Across restaurants", href: "/admin/service" },
    { label: "Check-ins today", value: checkIns, sub: "Room bookings", href: "/admin/bookings" },
  ];

  return (
    <div className="page">
      <PageHeader title="Overview" sub={fmtDay(today)} actions={<Link href="/admin/service" className="btn btn-primary">Open live floor</Link>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="card block">
            <p className="t-sub">{tile.label}</p>
            <p className={`mt-2 font-[family-name:var(--serif)] text-4xl leading-none t-num ${tile.warn ? "text-(--red)" : ""}`}>{tile.value}</p>
            <p className="t-cap mt-2">{tile.sub}</p>
          </Link>
        ))}
      </div>

      <div className="section grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card flush">
          <div className="card-head">
            <h2 className="t-h4">Tables today</h2>
            <Link href="/admin/reservations" className="btn btn-tertiary btn-sm -mr-3">All reservations</Link>
          </div>
          {reservations.length === 0 ? (
            <Empty title="Nothing booked today" sub="New bookings from the website show up here." />
          ) : (
            <div className="rows">
              {reservations.slice(0, 8).map((r) => (
                <Link key={r.id} href="/admin/service" className="row">
                  <span className="t-h4 w-[76px] shrink-0">{fmtTime(r.time)}</span>
                  <span className="row-main">
                    <span className="row-title truncate">{r.guest_name}</span>
                    <span className="row-sub">{plural(r.party_size, "guest")}{r.restaurants?.name ? ` · ${r.restaurants.name}` : ""}</span>
                  </span>
                  {r.status === "seated" ? <StatusTag status="seated" /> : waiting(r) && <StatusTag status="needs_table" />}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card flush">
          <div className="card-head">
            <h2 className="t-h4">Stays</h2>
            <Link href="/admin/bookings" className="btn btn-tertiary btn-sm -mr-3">All room bookings</Link>
          </div>
          {stays.length === 0 ? (
            <Empty title="No upcoming stays" sub="Room bookings show up here from the day they're made." />
          ) : (
            <div className="rows">
              {stays.map((s) => (
                <Link key={s.id} href="/admin/bookings" className="row">
                  <span className="row-main">
                    <span className="row-title truncate">{s.guest_name}</span>
                    <span className="row-sub">{fmtDate(s.check_in)} – {fmtDate(s.check_out)} · {fmtMoney(s.total_amount, s.currency)}</span>
                  </span>
                  <StatusTag status={s.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="section">
        <h2 className="t-h4 mb-3">Set up</h2>
        <div className="card flush rows">
          {[
            { href: "/admin/restaurants", label: "Restaurants", sub: `${plural(counts.restaurants, "restaurant")} · details, booking hours, floor plans` },
            { href: "/admin/properties", label: "Properties", sub: `${plural(counts.properties, "property", "properties")} · rooms and photos` },
            { href: "/admin/events", label: "Events", sub: plural(counts.events, "event") },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="row">
              <span className="row-main">
                <span className="row-title">{item.label}</span>
                <span className="row-sub">{item.sub}</span>
              </span>
              <Chevron />
            </Link>
          ))}
        </div>
      </section>
      {snackbar}
    </div>
  );
}
