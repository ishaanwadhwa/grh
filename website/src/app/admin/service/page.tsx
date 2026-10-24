"use client";

// Live floor: the host stand.
//   Left: the day's bookings, grouped by what they need next (a table, seating, nothing).
//   Right: the floor, as a map or as table cards. Free / booked / arrived / seated, one colour each.
//   Tap a booking, tap free tables, press the one button at the bottom. That's the whole job.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WARNING_TEXT, friendlyError } from "@/lib/reservations/adminErrors";
import NewBookingPanel from "@/components/admin/NewBookingPanel";
import { AdminInput, FormField } from "@/components/admin/FormField";
import {
  ENDED_FILTER, FloorFrame, FloorKey, FloorTable, TableCard, WITH_TABLES, ZoomButtons, contentBox, isRequest, loadFloor, needsTable,
  panBox, sameIds, seatsLabel, tablesOf, zoomBox, type FloorTableRow, type Floorplan, type TableState, type ViewBox,
} from "@/components/admin/floor";
import { Chevron, Close, Empty, Loading, PageHeader, Sheet, StatusTag, Stepper, fmtDay, fmtTime, nowIn, plural, todayIn, useNotice } from "@/components/admin/ui";

interface Restaurant { id: string; name: string; timezone: string | null; }
interface Service { id: string; name: string; }
interface Booking {
  id: string;
  service_id: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string;
  guest_phone_code: string;
  time: string;
  party_size: number;
  status: string;
  seated_at: string | null;
  special_requests: string | null;
  phone_verified?: boolean | null; // from the backend handoff (phone codes); not on main yet, so optional
  needs_attention?: boolean; // set by the booking engine (main, P1A): outside hours, over capacity, overbooked
  attention_reason?: string | null;
}
/** What suggest_tables (the booking engine) returns for one booking. */
interface Suggestion {
  options: { table_ids: string[]; labels: string[]; total_capacity: number; fits_unassigned: boolean }[];
  warnings: string[];
  unassigned_fits: boolean;
}
interface Walkin { name: string; phone: string; party: number; serviceId: string; tableIds: string[]; }

const KEY: [TableState, string][] = [["free", "Free"], ["booked", "Booked"], ["arrived", "Arrived"], ["seated", "Seated"]];
const firstName = (name: string) => name.split(" ")[0] || name;
const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function seatedFor(seatedAt: string | null, now: number) {
  if (!seatedAt) return "";
  const elapsed = Math.max(0, Math.floor((now - new Date(seatedAt).getTime()) / 60_000));
  return elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`;
}

export default function LiveFloorPage() {
  const supabase = createClient();
  const { say, fail, snackbar } = useNotice();
  const panRef = useRef<{ pointerId: number; x: number; y: number; box: ViewBox; moved: boolean } | null>(null);
  const bookingsRequest = useRef(0);

  // Deep link from Reservations: /admin/service?restaurant=…&date=…&booking=…
  const [link] = useState(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  const linkedBooking = useRef(link.get("booking") || "");
  const selectedRef = useRef(""); // suggestions that arrive after the selection moved on are ignored

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState(() => link.get("restaurant") || "");
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const tz = restaurant?.timezone || "Asia/Kolkata";
  const today = todayIn(tz);
  const [serviceDate, setServiceDate] = useState(() => link.get("date") || todayIn());
  const [serviceFilter, setServiceFilter] = useState("");

  // Per restaurant: services and the floor. Per restaurant + day: bookings with their tables.
  const [services, setServices] = useState<Service[]>([]);
  const [floor, setFloor] = useState<{ plan: Floorplan | null; tables: FloorTableRow[]; referenceUrl: string } | null>(null);
  const [allBookings, setAllBookings] = useState<Booking[] | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});

  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [draftTableIds, setDraftTableIds] = useState<string[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [floorView, setFloorView] = useState<"map" | "cards">("map");
  const [pane, setPane] = useState<"bookings" | "floor">("bookings"); // phones only
  const [now, setNow] = useState(0);
  const [walkin, setWalkin] = useState<Walkin | null>(null);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null); // for the selected booking
  const [override, setOverride] = useState<"" | "assign" | "unassign" | "approve">(""); // the engine refused, but staff may force it

  const tables = useMemo(() => floor?.tables || [], [floor]);
  const plan = floor?.plan || null;
  const W = plan?.canvas_width || 1000;
  const H = plan?.canvas_height || 1400;
  const box = viewBox || contentBox(tables, plan?.layout_data || [], W, H);
  const loading = !floor || !allBookings;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    supabase.from("restaurants").select("id, name, timezone").eq("is_active", true).order("name").then(({ data, error }) => {
      if (error) fail(error);
      const rows = (data || []) as Restaurant[];
      setRestaurants(rows);
      setRestaurantId((current) => current || rows[0]?.id || "");
      if (!rows.length) { setFloor({ plan: null, tables: [], referenceUrl: "" }); setAllBookings([]); }
    });
  }, [supabase, fail]);

  // The floor: loads once per restaurant.
  useEffect(() => {
    if (!restaurantId) return;
    let stale = false;
    Promise.all([
      supabase.from("restaurant_services").select("id, name").eq("restaurant_id", restaurantId).eq("is_active", true).order("name"),
      loadFloor(supabase, restaurantId, { bookableOnly: true }),
    ]).then(([{ data, error }, loaded]) => {
      if (stale) return;
      if (error || loaded.error) fail(error || loaded.error!);
      setServices((data || []) as Service[]);
      setFloor(loaded);
      setViewBox(null); // fit what's drawn
    });
    return () => { stale = true; };
  }, [restaurantId, supabase, fail]);

  // The bookings: one request per restaurant and day, tables included. The newest request wins.
  const loadBookings = async () => {
    if (!restaurantId) return;
    const request = ++bookingsRequest.current;
    const { data, error } = await supabase.from("reservations").select(`*, ${WITH_TABLES}`)
      .eq("restaurant_id", restaurantId).eq("date", serviceDate).not("status", "in", ENDED_FILTER).order("time");
    if (request !== bookingsRequest.current) return;
    if (error) fail(error);
    const rows = (data || []) as (Booking & Parameters<typeof tablesOf>[0])[];
    setAllBookings(rows);
    setAssignments(Object.fromEntries(rows.map((r) => [r.id, tablesOf(r)])));
    setSelectedBookingId((current) => (rows.some((r) => r.id === current) ? current : ""));
    setDraftTableIds([]);
    const linked = rows.find((r) => r.id === linkedBooking.current);
    if (linked) { linkedBooking.current = ""; select(linked, tablesOf(linked)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadBookings reads only these two
  useEffect(() => { setAllBookings(null); void loadBookings(); }, [restaurantId, serviceDate]);

  // ---------- Derived ----------

  const bookings = useMemo(() => (allBookings || []).filter((r) => !serviceFilter || r.service_id === serviceFilter), [allBookings, serviceFilter]);
  const tableLabel = useMemo(() => new Map(tables.map((t) => [t.id, t.label])), [tables]);
  const tableNames = (ids: string[]) => ids.map((id) => tableLabel.get(id)).filter(Boolean).join(", ");
  /** Who owns each table right now: seated beats arrived beats the next one up. */
  const occupants = useMemo(() => {
    const rank = (r: Booking) => (r.status === "seated" ? 0 : r.status === "arrived" ? 1 : 2);
    const map = new Map<string, Booking>();
    for (const r of bookings) {
      for (const id of assignments[r.id] || []) {
        const held = map.get(id);
        if (!held || rank(r) < rank(held) || (rank(r) === rank(held) && r.time < held.time)) map.set(id, r);
      }
    }
    return map;
  }, [bookings, assignments]);
  const occupantOf = (tableId: string) => occupants.get(tableId) || null;
  const stateOf = (r: Booking | null): TableState => (!r ? "free" : r.status === "seated" ? "seated" : r.status === "arrived" ? "arrived" : "booked");
  const seatsOf = (ids: string[]) => tables.filter((t) => ids.includes(t.id)).reduce((sum, t) => sum + t.max_capacity, 0);

  const selected = bookings.find((r) => r.id === selectedBookingId) || null;
  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;
  const picking = !!selected && selected.status !== "seated";

  // ---------- Actions ----------

  const clearSelection = () => {
    selectedRef.current = "";
    setSelectedBookingId(""); setDraftTableIds([]); setSelectedTableId(""); setSuggestion(null); setOverride("");
  };

  /** Ask the booking engine for the best tables and preselect them on the floor (if staff haven't picked yet). */
  const suggestFor = async (r: Booking) => {
    const { data } = await supabase.rpc("suggest_tables", {
      p_restaurant_id: restaurantId, p_service_id: r.service_id, p_date: serviceDate, p_time: r.time,
      p_party_size: r.party_size, p_exclude_reservation_id: r.id,
    });
    if (selectedRef.current !== r.id) return;
    const result = (data as Suggestion | null) || null;
    setSuggestion(result);
    const top = result?.options?.[0];
    if (top) setDraftTableIds((current) => (current.length ? current : top.table_ids));
  };

  const select = (r: Booking, assigned: string[]) => {
    selectedRef.current = r.id;
    setSelectedBookingId(r.id); setDraftTableIds(assigned); setSelectedTableId(""); setSuggestion(null); setOverride("");
    setPane("floor");
    if (!assigned.length && r.service_id && r.status !== "seated") void suggestFor(r);
  };

  const chooseBooking = (r: Booking) => (selectedBookingId === r.id ? clearSelection() : select(r, assignments[r.id] || []));

  const tapTable = (table: FloorTableRow) => {
    if (!selected) { setSelectedTableId((current) => (current === table.id ? "" : table.id)); return; }
    const occupant = occupantOf(table.id);
    if (occupant && occupant.id !== selected.id && occupant.status === "seated") {
      say(`${table.label} is taken by ${firstName(occupant.guest_name)}. Pick a free one.`);
      return;
    }
    setDraftTableIds((current) => toggle(current, table.id));
    setOverride("");
  };

  /** Save a booking's tables through the booking engine (main, P1A). It checks capacity; some refusals can be forced. */
  const setTables = async (r: Booking, tableIds: string[], allowOverride: boolean, mode: "assign" | "unassign") => {
    setSaving(true);
    const { error } = await supabase.rpc("set_reservation_tables", { p_reservation_id: r.id, p_table_ids: tableIds, p_allow_override: allowOverride });
    setSaving(false);
    if (error) {
      const mapped = friendlyError(error.message);
      fail(mapped.text);
      setOverride(mapped.overridable ? mode : "");
      return false;
    }
    setOverride("");
    setAssignments((current) => ({ ...current, [r.id]: tableIds }));
    return true;
  };

  const updateStatus = async (r: Booking, status: string) => {
    setSaving(true);
    const { error } = await supabase.from("reservations").update({ status }).eq("id", r.id);
    setSaving(false);
    if (error) { fail(error); return false; }
    setAllBookings((current) => (current || []).map((row) => row.id === r.id ? { ...row, status, seated_at: status === "seated" ? new Date().toISOString() : row.seated_at } : row));
    if (["completed", "no_show", "cancelled"].includes(status)) { setAssignments((current) => ({ ...current, [r.id]: [] })); clearSelection(); }
    return true;
  };

  // Each action reloads the day once it's done: the engine may set or clear "needs attention".

  /** The one button: save the tables if they changed, then seat. */
  const seat = async (r: Booking, allowOverride = false) => {
    if (!sameIds(draftTableIds, assignments[r.id] || []) && !(await setTables(r, draftTableIds, allowOverride, "assign"))) return;
    if (await updateStatus(r, "seated")) { say(`${firstName(r.guest_name)} seated at ${tableNames(draftTableIds)}`); clearSelection(); void loadBookings(); }
  };

  const hold = async (r: Booking, allowOverride = false) => {
    if (await setTables(r, draftTableIds, allowOverride, "assign")) { say(`${tableNames(draftTableIds)} held for ${firstName(r.guest_name)}`); clearSelection(); void loadBookings(); }
  };

  const unassign = async (r: Booking, allowOverride = false) => {
    const freed = tableNames(assignments[r.id] || []);
    if (await setTables(r, [], allowOverride, "unassign")) { say(`${freed} freed. ${firstName(r.guest_name)} now needs a table.`); clearSelection(); void loadBookings(); }
  };

  /** Approve (optionally with tables) or decline a guest's booking request (main, P1B: review_pending_reservation). */
  const review = async (r: Booking, approve: boolean, tableIds: string[], allowOverride = false) => {
    setSaving(true);
    const { error } = await supabase.rpc("review_pending_reservation", {
      p_reservation_id: r.id, p_approve: approve, p_table_ids: tableIds, p_allow_override: allowOverride,
    });
    setSaving(false);
    if (error) {
      const mapped = friendlyError(error.message);
      fail(mapped.text);
      setOverride(approve && mapped.overridable ? "approve" : "");
      return;
    }
    say(!approve ? `${firstName(r.guest_name)}'s request declined` : tableIds.length ? `${firstName(r.guest_name)} approved at ${tableNames(tableIds)}` : `${firstName(r.guest_name)} approved. They still need a table.`);
    clearSelection();
    void loadBookings();
  };

  const finish = async (r: Booking) => {
    const freed = tableNames(assignments[r.id] || []);
    if (await updateStatus(r, "completed")) say(`${freed || "Table"} is free again`);
  };

  const seatWalkin = async () => {
    if (!walkin || !restaurantId || !walkin.serviceId || !walkin.tableIds.length) return;
    setWalkinSubmitting(true);
    const { error } = await supabase.rpc("create_walkin_reservation", {
      p_restaurant_id: restaurantId,
      p_service_id: walkin.serviceId,
      p_service_date: today,
      p_start_time: nowIn(tz),
      p_party_size: walkin.party,
      p_table_ids: walkin.tableIds,
      p_guest_name: walkin.name.trim() || null,
      p_guest_phone: walkin.phone.trim(),
      p_guest_phone_code: "+91",
      p_special_requests: null,
    });
    setWalkinSubmitting(false);
    if (error) { fail(error.message.includes("TABLE_ALREADY_RESERVED") ? "That table was just taken. Pick another." : error); return; }
    say(`${walkin.name.trim() || "Walk-in"} seated at ${tableNames(walkin.tableIds)}`);
    setWalkin(null);
    if (serviceDate === today) void loadBookings();
    else setServiceDate(today); // the day change reloads
  };

  // ---------- Map: pan on empty floor, tap empty floor to deselect ----------

  const panDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest("[data-floor-table]")) return;
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, box, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const panMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return; // a tap, not a drag
    pan.moved = true;
    setViewBox(panBox(pan.box, dx, dy, event.currentTarget.getBoundingClientRect().width, W, H));
  };
  const panUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (!pan.moved && !selected) setSelectedTableId("");
  };

  // ---------- Render ----------

  const flagged = (r: Booking) => !!r.needs_attention && r.status !== "seated" && !isRequest(r);
  const seatedRows = bookings.filter((r) => r.status === "seated");
  const groups: [string, Booking[]][] = [
    ["Requests", bookings.filter(isRequest)],
    ["Needs a table", bookings.filter((r) => needsTable(r, assignments[r.id] || []) || flagged(r))],
    ["Coming up", bookings.filter((r) => r.status !== "seated" && !isRequest(r) && (assignments[r.id] || []).length && !flagged(r))],
    ["Seated", seatedRows],
  ];
  const guests = bookings.reduce((sum, r) => sum + r.party_size, 0);
  const areas = Object.entries(tables.reduce<Record<string, FloorTableRow[]>>((acc, t) => { (acc[t.zone || "Tables"] ||= []).push(t); return acc; }, {}));
  const dayLabel = serviceDate === today ? "today" : fmtDay(serviceDate);

  const bookingRow = (r: Booking) => (
    <button key={r.id} type="button" onClick={() => chooseBooking(r)} aria-pressed={r.id === selectedBookingId} className="row items-start">
      <span className="t-h4 w-[76px] shrink-0">{fmtTime(r.time)}</span>
      <span className="row-main">
        <span className="row-title truncate">{r.guest_name}</span>
        <span className="row-sub">
          {[plural(r.party_size, "guest"), tableNames(assignments[r.id] || []), r.status === "seated" && seatedFor(r.seated_at, now)].filter(Boolean).join(" · ")}
        </span>
        {(r.status === "arrived" || isRequest(r) || r.needs_attention || r.phone_verified === false || r.special_requests) && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {r.status === "arrived" && <StatusTag status="arrived" />}
            {isRequest(r) && <StatusTag status="pending" title="Needs approval before it's confirmed" />}
            {r.needs_attention && <StatusTag status={r.attention_reason || "needs_attention"} />}
            {r.phone_verified === false && <StatusTag status="unverified" title="Booked without a phone code. Confirm on WhatsApp." />}
            {r.special_requests && <span className="tag" title={r.special_requests}>Note</span>}
          </span>
        )}
      </span>
    </button>
  );

  const closeButton = (onClick: () => void) => <button type="button" onClick={onClick} className="btn btn-grey btn-sm btn-icon" aria-label="Close"><Close /></button>;

  // The bar under the floor: what's selected and the one thing to do next.
  let actionBar: React.ReactNode = null;
  if (selected) {
    const r = selected;
    const assigned = assignments[r.id] || [];
    const changed = !sameIds(draftTableIds, assigned);
    const draftSeats = seatsOf(draftTableIds);
    const short = draftTableIds.length > 0 && draftSeats < r.party_size;
    const top = suggestion?.options?.[0];
    const suggested = !!top && !assigned.length && sameIds(draftTableIds, top.table_ids);
    const request = isRequest(r);
    const status = r.status === "seated"
      ? `Seated ${seatedFor(r.seated_at, now)} at ${tableNames(assigned)}`
      : request && !draftTableIds.length
        ? "Request: approve it with tables, or approve now and find a table later"
      : draftTableIds.length
        ? `${suggested ? "Suggested: " : ""}${tableNames(draftTableIds)} · ${plural(draftSeats, "seat")}${short ? ` for ${r.party_size}. Add another table?` : ""}${suggested && !top.fits_unassigned ? ". This would overcommit the night." : ""}`
        : suggestion && !top ? "No table fits this party right now. Pick tables, or leave it unassigned." : "Tap free tables on the floor";
    const warnings = (suggestion?.warnings || []).map((code) => WARNING_TEXT[code]).filter(Boolean);
    actionBar = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p><span className="t-h4">{r.guest_name}</span> <span className="t-sub">· {plural(r.party_size, "guest")} · {fmtTime(r.time)}</span></p>
          <p className={`t-sub ${short || (suggested && !top.fits_unassigned) ? "text-(--warn)" : ""}`}>{status}</p>
          {warnings.map((text) => <p key={text} className="t-cap text-(--warn)">{text}</p>)}
          {r.special_requests && <p className="t-sub mt-1">“{r.special_requests}”</p>}
          {(r.guest_phone || r.guest_email) && (
            <p className="t-cap mt-1">{r.guest_phone ? <a className="link" href={`tel:${r.guest_phone_code}${r.guest_phone}`}>{r.guest_phone_code} {r.guest_phone}</a> : r.guest_email}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.status === "seated" ? (
            <button type="button" onClick={() => void finish(r)} disabled={saving} className="btn btn-primary">Free the table</button>
          ) : request ? (
            <>
              <button type="button" onClick={() => void review(r, false, [])} disabled={saving} className="btn btn-danger btn-sm">Decline</button>
              {draftTableIds.length > 0 && <button type="button" onClick={() => void review(r, true, [])} disabled={saving} className="btn btn-grey btn-sm">Approve, table later</button>}
              <button type="button" onClick={() => void review(r, true, draftTableIds, override === "approve")} disabled={saving} className="btn btn-primary">
                {saving ? "Saving\u2026" : `${override === "approve" ? "Approve anyway" : "Approve"}${draftTableIds.length ? ` at ${tableNames(draftTableIds)}` : ""}`}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void updateStatus(r, "no_show")} disabled={saving} className="btn btn-danger btn-sm">No-show</button>
              {r.status !== "arrived" && <button type="button" onClick={() => void updateStatus(r, "arrived")} disabled={saving} className="btn btn-grey btn-sm">Arrived</button>}
              {assigned.length > 0 && !changed && <button type="button" onClick={() => void unassign(r, override === "unassign")} disabled={saving} className="btn btn-grey btn-sm">{override === "unassign" ? "Unassign anyway" : "Unassign"}</button>}
              {draftTableIds.length > 0 && changed && <button type="button" onClick={() => void hold(r, override === "assign")} disabled={saving} className="btn btn-secondary btn-sm">{override === "assign" ? "Hold anyway" : "Hold tables"}</button>}
              <button type="button" onClick={() => void seat(r, override === "assign")} disabled={saving || !draftTableIds.length} className="btn btn-primary">
                {saving ? "Saving…" : override === "assign" ? "Seat anyway" : draftTableIds.length ? `Seat at ${tableNames(draftTableIds)}` : "Seat"}
              </button>
            </>
          )}
          {closeButton(clearSelection)}
        </div>
      </div>
    );
  } else if (selectedTable) {
    const occupant = occupantOf(selectedTable.id);
    const status = !occupant ? "Free right now"
      : `${occupant.status === "seated" ? `Seated ${seatedFor(occupant.seated_at, now)}` : `Booked ${fmtTime(occupant.time)}`} · ${occupant.guest_name}, ${plural(occupant.party_size, "guest")}`;
    actionBar = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p><span className="t-h4">{selectedTable.label}</span> <span className="t-sub">· {[seatsLabel(selectedTable), selectedTable.zone].filter(Boolean).join(" · ")}</span></p>
          <p className="t-sub">{status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {occupant
            ? <button type="button" onClick={() => chooseBooking(occupant)} className="btn btn-secondary btn-sm">Open booking</button>
            : <button type="button" onClick={() => setWalkin({ name: "", phone: "", party: 2, serviceId: serviceFilter || services[0]?.id || "", tableIds: [selectedTable.id] })} disabled={!services.length} className="btn btn-primary btn-sm">Seat a walk-in here</button>}
          {closeButton(() => setSelectedTableId(""))}
        </div>
      </div>
    );
  }

  const walkinSeats = walkin ? seatsOf(walkin.tableIds) : 0;

  return (
    <div className="page page-wide">
      <PageHeader
        title="Live floor"
        sub={loading ? fmtDay(serviceDate) : `${fmtDay(serviceDate)} · ${plural(bookings.length, "booking")} · ${plural(guests, "guest")} · ${seatedRows.length} seated${groups[0][1].length ? ` \u00b7 ${plural(groups[0][1].length, "request")}` : ""}`}
        actions={<>
          <button type="button" onClick={() => setNewBookingOpen(true)} disabled={!restaurantId || !services.length} className="btn btn-secondary">New booking</button>
          <button type="button" onClick={() => setWalkin({ name: "", phone: "", party: 2, serviceId: serviceFilter || services[0]?.id || "", tableIds: [] })} disabled={!services.length || !plan} className="btn btn-primary">Seat a walk-in</button>
        </>}
      />

      {/* Where and when: restaurant, day, service. One row. */}
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {restaurants.length > 1 && (
          <div className="pills" role="group" aria-label="Restaurant">
            {restaurants.map((r) => <button key={r.id} type="button" className="pill" aria-pressed={r.id === restaurantId} onClick={() => { setRestaurantId(r.id); setServiceFilter(""); setFloor(null); clearSelection(); }}>{r.name}</button>)}
          </div>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Day">
          <button type="button" onClick={() => setServiceDate((d) => shiftDate(d, -1))} className="btn btn-grey btn-sm btn-icon" aria-label="Previous day"><Chevron dir="left" /></button>
          <label className="relative cursor-pointer px-2">
            <span className="t-h4">{serviceDate === today ? "Today" : fmtDay(serviceDate)}</span>
            <input type="date" value={serviceDate} onChange={(e) => e.target.value && setServiceDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick a day" />
          </label>
          <button type="button" onClick={() => setServiceDate((d) => shiftDate(d, 1))} className="btn btn-grey btn-sm btn-icon" aria-label="Next day"><Chevron /></button>
          {serviceDate !== today && <button type="button" onClick={() => setServiceDate(today)} className="btn btn-tertiary btn-sm">Back to today</button>}
        </div>
        {services.length > 1 && (
          <div className="pills" role="group" aria-label="Service">
            {[{ id: "", name: "All day" }, ...services].map((s) => <button key={s.id || "all"} type="button" className="pill" aria-pressed={serviceFilter === s.id} onClick={() => { setServiceFilter(s.id); clearSelection(); }}>{s.name}</button>)}
          </div>
        )}
      </div>

      {!loading && !restaurants.length ? (
        <section className="card"><Empty title="No restaurants yet" sub="Add a restaurant and its floor plan first." action={<Link href="/admin/restaurants" className="btn btn-primary">Go to restaurants</Link>} /></section>
      ) : floor && !plan ? (
        <section className="card"><Empty title={`${restaurant?.name || "This restaurant"} has no floor plan yet`} sub="Draw the room and place the tables, then seat guests from here." action={<Link href={`/admin/restaurants/${restaurantId}/floorplan`} className="btn btn-primary">Draw the floor plan</Link>} /></section>
      ) : (
        <>
          {/* Phones: one pane at a time */}
          <div className="pills mb-4 lg:hidden" role="tablist">
            <button type="button" role="tab" className="pill" aria-selected={pane === "bookings"} onClick={() => setPane("bookings")}>Bookings <span className="n">{bookings.length}</span></button>
            <button type="button" role="tab" className="pill" aria-selected={pane === "floor"} onClick={() => setPane("floor")}>Floor</button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className={`card flush h-fit pb-2 lg:block ${pane === "bookings" ? "" : "hidden"}`} aria-label="Bookings">
              {loading ? <Loading /> : !bookings.length ? (
                <Empty title="No bookings yet" sub={`Nothing booked for ${dayLabel}. Walk-ins go straight onto the floor.`} />
              ) : groups.map(([title, rows]) => rows.length > 0 && (
                <div key={title}>
                  <p className="t-meta px-6 pb-1 pt-5">{title} · {rows.length}</p>
                  <div className="rows">{rows.map(bookingRow)}</div>
                </div>
              ))}
            </section>

            <section className={`card min-w-0 p-3 md:p-4 lg:block ${pane === "floor" ? "" : "hidden"}`} aria-label="Floor">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pb-3">
                <FloorKey states={KEY} />
                <div className="ml-auto flex items-center gap-1">
                  <div className="pills mr-1" role="group" aria-label="View">
                    <button type="button" className="pill" aria-pressed={floorView === "map"} onClick={() => setFloorView("map")}>Map</button>
                    <button type="button" className="pill" aria-pressed={floorView === "cards"} onClick={() => setFloorView("cards")}>Tables</button>
                  </div>
                  {floorView === "map" && <ZoomButtons onZoom={(factor) => setViewBox(zoomBox(box, factor, W, H))} />}
                </div>
              </div>

              {picking && (
                <p className="mx-1 mb-3 rounded-xl bg-(--red-tint) px-4 py-2.5 text-sm">
                  Seating <b className="font-medium">{selected.guest_name}</b>, {plural(selected.party_size, "guest")}. Tap free tables.
                </p>
              )}

              {loading ? <Loading /> : floorView === "map" && plan ? (
                <FloorFrame box={box} W={W} H={H} referenceUrl={floor?.referenceUrl} items={plan.layout_data || []} cursor="grab" onPointerDown={panDown} onPointerMove={panMove} onPointerUp={panUp} onPointerCancel={panUp}>
                  {tables.map((table) => {
                    const occupant = occupantOf(table.id);
                    const mine = !!selected && (assignments[selected.id] || []).includes(table.id);
                    return (
                      <FloorTable
                        key={table.id}
                        table={table}
                        canvasW={W}
                        canvasH={H}
                        state={stateOf(occupant)}
                        dim={picking ? !!occupant && occupant.id !== selected.id && occupant.status === "seated" : !!selected && !mine}
                        selected={picking ? draftTableIds.includes(table.id) : selectedTableId === table.id || mine}
                        line2={occupant ? (occupant.status === "seated" ? seatedFor(occupant.seated_at, now) : fmtTime(occupant.time)) : seatsLabel(table)}
                        onClick={() => tapTable(table)}
                      />
                    );
                  })}
                </FloorFrame>
              ) : (
                <div className="stack">
                  {areas.map(([area, list]) => (
                    <div key={area}>
                      {areas.length > 1 && <p className="t-meta px-1 pb-1">{area}</p>}
                      <div className="tcards">
                        {list.map((table) => {
                          const occupant = occupantOf(table.id);
                          const state = stateOf(occupant);
                          const timeChip = state === "seated" ? seatedFor(occupant!.seated_at, now) : state === "arrived" ? "Arrived" : fmtTime(occupant?.time);
                          return (
                            <TableCard
                              key={table.id}
                              table={table}
                              state={state}
                              selected={selected ? draftTableIds.includes(table.id) : selectedTableId === table.id}
                              title={occupant ? firstName(occupant.guest_name) : undefined}
                              chips={occupant ? [timeChip, `${occupant.party_size}/${table.max_capacity}`] : [seatsLabel(table)]}
                              onClick={() => tapTable(table)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!tables.length && <p className="t-sub p-4">No bookable tables yet. Switch them on in the floor plan.</p>}
                </div>
              )}

              {/* Desktop: the action bar stays in view under the floor */}
              {actionBar && <div className="frame sticky bottom-4 z-10 mt-3 hidden bg-(--card) p-4 shadow-(--shadow-pop) lg:block">{actionBar}</div>}
            </section>
          </div>
        </>
      )}

      {/* Phones: the action bar sits at the bottom of the screen */}
      {actionBar && <div className="bottom-bar lg:hidden">{actionBar}</div>}

      <Sheet open={!!walkin} onClose={() => setWalkin(null)} labelledBy="walkin-title">
        {walkin && (
          <>
            <h2 id="walkin-title" className="t-h3 pr-12">Seat a walk-in</h2>
            <p className="t-sub">{restaurant?.name} · now, {fmtTime(nowIn(tz))}</p>
            <div className="form mt-6">
              <div className="flex items-center justify-between gap-4">
                <span className="t-body">Guests</span>
                <Stepper label="Guests" value={walkin.party} min={1} max={50} onChange={(party) => setWalkin({ ...walkin, party })} />
              </div>
              {services.length > 1 && (
                <FormField group label="Service">
                  <div className="pills -ml-1">
                    {services.map((s) => <button key={s.id} type="button" className="pill" aria-pressed={walkin.serviceId === s.id} onClick={() => setWalkin({ ...walkin, serviceId: s.id })}>{s.name}</button>)}
                  </div>
                </FormField>
              )}
              <FormField group label="Table" hint={walkin.tableIds.length ? `${plural(walkinSeats, "seat")} for ${walkin.party}` : undefined} error={walkin.tableIds.length && walkinSeats < walkin.party ? `${plural(walkinSeats, "seat")} for ${walkin.party}. Add a table.` : undefined}>
                <div className="tiles">
                  {tables.map((table) => {
                    const occupant = occupantOf(table.id);
                    return (
                      <button key={table.id} type="button" disabled={occupant?.status === "seated"} aria-pressed={walkin.tableIds.includes(table.id)} onClick={() => setWalkin({ ...walkin, tableIds: toggle(walkin.tableIds, table.id) })} className="tile">
                        <span className="block font-medium">{table.label}</span>
                        <span className="t-cap block">{occupant?.status === "seated" ? "Seated" : occupant ? `Booked ${fmtTime(occupant.time)}` : seatsLabel(table)}</span>
                      </button>
                    );
                  })}
                </div>
              </FormField>
              <div className="form-2">
                <FormField label="Name (optional)"><AdminInput value={walkin.name} onChange={(e) => setWalkin({ ...walkin, name: e.target.value })} placeholder="Walk-in" /></FormField>
                <FormField label="Phone (optional)"><AdminInput type="tel" value={walkin.phone} onChange={(e) => setWalkin({ ...walkin, phone: e.target.value })} placeholder="98XXX XXXXX" /></FormField>
              </div>
            </div>
            <button type="button" onClick={() => void seatWalkin()} disabled={walkinSubmitting || !walkin.serviceId || !walkin.tableIds.length || walkinSeats < walkin.party} className="btn btn-primary btn-block mt-8">
              {walkinSubmitting ? "Seating…" : walkin.tableIds.length ? `Seat ${plural(walkin.party, "guest")} at ${tableNames(walkin.tableIds)}` : "Pick a table"}
            </button>
          </>
        )}
      </Sheet>

      <NewBookingPanel
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onCreated={() => void loadBookings()}
        defaultRestaurantId={restaurantId}
        defaultServiceId={serviceFilter || undefined}
        defaultDate={serviceDate}
      />
      {snackbar}
    </div>
  );
}
