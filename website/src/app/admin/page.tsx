"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

interface Stats {
  properties: number;
  rooms: number;
  restaurants: number;
  events: number;
  bookings: number;
  reservations: number;
}

interface RecentBooking {
  id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  currency: string;
}

interface RecentReservation {
  id: string;
  guest_name: string;
  date: string;
  time: string;
  party_size: number;
  status: string;
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white border border-border-subtle p-6 hover:border-accent-gold/30 transition-colors group"
    >
      <p className="text-xs uppercase tracking-widest text-text/40">{label}</p>
      <p className="mt-2 text-3xl font-display text-text group-hover:text-accent-gold transition-colors">
        {value}
      </p>
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>([]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function load() {
      const [props, rooms, rests, events, bookings, reservations] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("rooms").select("id", { count: "exact", head: true }),
        supabase.from("restaurants").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("reservations").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        properties: props.count || 0,
        rooms: rooms.count || 0,
        restaurants: rests.count || 0,
        events: events.count || 0,
        bookings: bookings.count || 0,
        reservations: reservations.count || 0,
      });

      // Recent bookings
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, guest_name, guest_email, check_in, check_out, status, total_amount, currency")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentBookings(bk || []);

      // Recent reservations
      const { data: rs } = await supabase
        .from("reservations")
        .select("id, guest_name, date, time, party_size, status")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentReservations(rs || []);
    }

    load();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-text/40">Good Room House — Admin Overview</p>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          <StatCard label="Properties" value={stats.properties} href="/admin/properties" />
          <StatCard label="Rooms" value={stats.rooms} href="/admin/properties" />
          <StatCard label="Restaurants" value={stats.restaurants} href="/admin/restaurants" />
          <StatCard label="Events" value={stats.events} href="/admin/events" />
          <StatCard label="Bookings" value={stats.bookings} href="/admin/bookings" />
          <StatCard label="Reservations" value={stats.reservations} href="/admin/reservations" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Bookings */}
        <div className="bg-white border border-border-subtle">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-medium text-text">Recent Bookings</h2>
            <Link href="/admin/bookings" className="text-xs text-accent-gold hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border-subtle/50">
            {recentBookings.length === 0 && (
              <p className="px-5 py-6 text-sm text-text/30">No bookings yet.</p>
            )}
            {recentBookings.map((b) => (
              <div key={b.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-text font-medium">{b.guest_name}</p>
                    <p className="text-xs text-text/40">{b.check_in} → {b.check_out}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-text">{b.currency} {b.total_amount.toLocaleString()}</p>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${
                      b.status === "confirmed" ? "bg-green-50 text-green-600" :
                      b.status === "cancelled" ? "bg-red-50 text-red-500" :
                      "bg-yellow-50 text-yellow-600"
                    }`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reservations */}
        <div className="bg-white border border-border-subtle">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-medium text-text">Recent Reservations</h2>
            <Link href="/admin/reservations" className="text-xs text-accent-gold hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border-subtle/50">
            {recentReservations.length === 0 && (
              <p className="px-5 py-6 text-sm text-text/30">No reservations yet.</p>
            )}
            {recentReservations.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-text font-medium">{r.guest_name}</p>
                    <p className="text-xs text-text/40">{r.date} at {r.time} · {r.party_size} guests</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 shrink-0 ${
                    r.status === "confirmed" ? "bg-green-50 text-green-600" :
                    r.status === "cancelled" ? "bg-red-50 text-red-500" :
                    "bg-yellow-50 text-yellow-600"
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
