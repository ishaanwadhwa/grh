"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import NewBookingPanel from "@/components/admin/NewBookingPanel";
import { friendlyError } from "@/lib/reservations/adminErrors";

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 1400;

interface RestaurantOption { id: string; name: string; }
interface ServiceOption { id: string; name: string; }
type LayoutItem =
  | { id: string; kind: "wall"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: "zone"; x: number; y: number; width: number; height: number; label: string }
  | { id: string; kind: "label"; x: number; y: number; text: string };
interface Floorplan {
  id: string;
  canvas_width: number;
  canvas_height: number;
  layout_data: LayoutItem[] | null;
  image_path: string | null;
}
interface ServiceTable {
  id: string;
  label: string;
  min_capacity: number;
  max_capacity: number;
  shape: "round" | "square" | "rectangle";
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  rotation: number;
  zone: string;
  is_active: boolean;
}
interface ServiceReservation {
  id: string;
  restaurant_id: string;
  service_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_phone_code: string;
  date: string;
  time: string;
  party_size: number;
  status: string;
  seated_at: string | null;
  source: string;
  special_requests: string | null;
  needs_attention: boolean;
  attention_reason: string | null;
}
interface Assignment { reservation_id: string; table_id: string; }
interface SuggestOption { table_ids: string[]; labels: string[]; total_capacity: number; fits_unassigned: boolean; }
interface Suggestion { options: SuggestOption[]; warnings: string[]; unassigned_fits: boolean; }
interface MapPanGesture { pointerId: number; startX: number; startY: number; originX: number; originY: number; }

function localDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function formatSeatedDuration(seatedAt: string | null, now: number) {
  if (!seatedAt) return "";
  const elapsed = Math.max(0, Math.floor((now - new Date(seatedAt).getTime()) / 60_000));
  const hours = Math.floor(elapsed / 60);
  const minutes = elapsed % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "border-accent-gold/60 bg-accent-gold/15 text-primary",
  pending: "border-amber-500/50 bg-amber-50 text-amber-800",
  arrived: "border-accent/50 bg-accent/10 text-accent",
  seated: "border-accent bg-accent text-white",
};

export default function WaiterServicePage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceFilter, setServiceFilter] = useState("");
  const [serviceDate, setServiceDate] = useState(localDate());
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [tables, setTables] = useState<ServiceTable[]>([]);
  const [reservations, setReservations] = useState<ServiceReservation[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [draftTableIds, setDraftTableIds] = useState<string[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignOverridable, setAssignOverridable] = useState(false);
  const [needsTableOpen, setNeedsTableOpen] = useState(true);
  const [needsTableSuggestions, setNeedsTableSuggestions] = useState<Record<string, Suggestion>>({});
  const [needsTableLoadingId, setNeedsTableLoadingId] = useState("");
  const [notice, setNotice] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const mapPanRef = useRef<MapPanGesture | null>(null);
  const [serviceView, setServiceView] = useState<"floor" | "tables">("floor");
  const [now, setNow] = useState(0);
  const [mapFullScreen, setMapFullScreen] = useState(false);
  const [showBookingQueue, setShowBookingQueue] = useState(true);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [walkinDate, setWalkinDate] = useState(localDate());
  const [walkinPartySize, setWalkinPartySize] = useState(2);
  const [walkinServiceId, setWalkinServiceId] = useState("");
  const [walkinTableIds, setWalkinTableIds] = useState<string[]>([]);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);

  const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId) || null;
  const selectedTable = tables.find((table) => table.id === selectedTableId) || null;
  const mapWidth = floorplan ? floorplan.canvas_width / zoom : DEFAULT_WIDTH;
  const mapHeight = floorplan ? floorplan.canvas_height / zoom : DEFAULT_HEIGHT;
  const mapBaseX = floorplan ? (floorplan.canvas_width - mapWidth) / 2 : 0;
  const mapBaseY = floorplan ? (floorplan.canvas_height - mapHeight) / 2 : 0;
  const mapViewBox = `${mapBaseX + mapPan.x} ${mapBaseY + mapPan.y} ${mapWidth} ${mapHeight}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.from("restaurants").select("id, name").eq("is_active", true).order("name").then(({ data, error }) => {
      if (cancelled) return;
      if (error) setNotice(`Could not load restaurants: ${error.message}`);
      const rows = (data || []) as RestaurantOption[];
      setRestaurants(rows);
      setRestaurantId((current) => current || rows[0]?.id || "");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  const loadShift = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setNotice("");
    const [{ data: serviceRows, error: serviceError }, { data: plan, error: planError }] = await Promise.all([
      supabase.from("restaurant_services").select("id, name").eq("restaurant_id", restaurantId).eq("is_active", true).order("name"),
      supabase.from("restaurant_floorplans").select("id, canvas_width, canvas_height, layout_data, image_path").eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle(),
    ]);
    if (serviceError || planError) {
      setNotice(`Could not load service setup: ${(serviceError || planError)?.message}`);
      setLoading(false);
      return;
    }
    setServices((serviceRows || []) as ServiceOption[]);
    setFloorplan(plan as Floorplan | null);
    setReferenceUrl("");

    const [tableResult, reservationResult] = await Promise.all([
      plan
        ? supabase.from("restaurant_tables").select("*").eq("floorplan_id", plan.id).eq("is_active", true).order("label")
        : Promise.resolve({ data: [], error: null }),
      (() => {
        let query = supabase.from("reservations")
          .select("id, restaurant_id, service_id, guest_name, guest_email, guest_phone, guest_phone_code, date, time, party_size, status, seated_at, source, special_requests, needs_attention, attention_reason")
          .eq("restaurant_id", restaurantId)
          .eq("date", serviceDate)
          .not("status", "in", "(cancelled,completed,no_show)")
          .order("time");
        if (serviceFilter) query = query.eq("service_id", serviceFilter);
        return query;
      })(),
    ]);
    if (tableResult.error || reservationResult.error) {
      setNotice(`Could not load the floor or reservations: ${(tableResult.error || reservationResult.error)?.message}`);
      setLoading(false);
      return;
    }

    const reservationRows = (reservationResult.data || []) as ServiceReservation[];
    setTables((tableResult.data || []) as ServiceTable[]);
    setReservations(reservationRows);
    if (plan?.image_path) {
      const { data: signed } = await supabase.storage.from("restaurant-floorplans").createSignedUrl(plan.image_path, 3600);
      setReferenceUrl(signed?.signedUrl || "");
    }

    if (reservationRows.length) {
      const { data: assigned, error: assignmentError } = await supabase
        .from("reservation_table_assignments")
        .select("reservation_id, table_id")
        .is("released_at", null)
        .in("reservation_id", reservationRows.map((row) => row.id));
      if (assignmentError) setNotice(`Could not load table assignments: ${assignmentError.message}`);
      const grouped: Record<string, string[]> = {};
      for (const row of (assigned || []) as Assignment[]) {
        grouped[row.reservation_id] = [...(grouped[row.reservation_id] || []), row.table_id];
      }
      setAssignments(grouped);
    } else {
      setAssignments({});
    }
    setSelectedReservationId((current) => reservationRows.some((row) => row.id === current) ? current : "");
    setDraftTableIds([]);
    setSelectedTableId("");
    setLoading(false);
  }, [restaurantId, serviceDate, serviceFilter, supabase]);

  // Refresh the staff board when restaurant, service, or date changes.
  // Refresh remote reservation/table state when service filters change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadShift(); }, [loadShift]);

  const refresh = () => { void loadShift(); };

  const openWalkinForm = () => {
    setWalkinName("");
    setWalkinPhone("");
    setWalkinDate(localDate());
    setWalkinPartySize(2);
    setWalkinServiceId(serviceFilter || services[0]?.id || "");
    setWalkinTableIds(selectedTableId ? [selectedTableId] : []);
    setWalkinOpen(true);
    setNotice("");
  };

  const toggleWalkinTable = (tableId: string) => {
    setWalkinTableIds((current) => current.includes(tableId)
      ? current.filter((id) => id !== tableId)
      : [...current, tableId]);
  };

  const seatWalkin = async () => {
    if (!restaurantId || !walkinServiceId || !walkinTableIds.length || walkinPartySize < 1) {
      setNotice("Choose a service, party size, and at least one table for the walk-in.");
      return;
    }
    setWalkinSubmitting(true);
    const { error } = await supabase.rpc("create_walkin_reservation", {
      p_restaurant_id: restaurantId,
      p_service_id: walkinServiceId,
      p_service_date: walkinDate,
      p_start_time: localTime(),
      p_party_size: walkinPartySize,
      p_table_ids: walkinTableIds,
      p_guest_name: walkinName.trim() || null,
      p_guest_phone: walkinPhone.trim(),
      p_guest_phone_code: "+91",
      p_special_requests: null,
    });
    if (error) {
      setNotice(error.message.includes("TABLE_ALREADY_RESERVED")
        ? "That table was just taken. Choose another table."
        : error.message);
      setWalkinSubmitting(false);
      return;
    }
    setWalkinOpen(false);
    setServiceDate(walkinDate);
    setServiceFilter(walkinServiceId);
    setSelectedReservationId("");
    setWalkinTableIds([]);
    setNotice(`${walkinName.trim() || "Walk-in party"} seated.`);
    await loadShift();
    setWalkinSubmitting(false);
  };

  const startMapPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest("[data-service-table]")) return;
    mapPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: mapPan.x,
      originY: mapPan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveMapPan = (event: React.PointerEvent<SVGSVGElement>) => {
    const panGesture = mapPanRef.current;
    if (!floorplan || panGesture?.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const baseX = (floorplan.canvas_width - mapWidth) / 2;
    const baseY = (floorplan.canvas_height - mapHeight) / 2;
    const maxX = floorplan.canvas_width - mapWidth;
    const maxY = floorplan.canvas_height - mapHeight;
    const dx = (event.clientX - panGesture.startX) * mapWidth / rect.width;
    const dy = (event.clientY - panGesture.startY) * mapHeight / rect.height;
    setMapPan({
      x: Math.max(-baseX, Math.min(maxX - baseX, panGesture.originX - dx)),
      y: Math.max(-baseY, Math.min(maxY - baseY, panGesture.originY - dy)),
    });
  };

  const endMapPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (mapPanRef.current?.pointerId !== event.pointerId) return;
    mapPanRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetMapView = () => {
    setZoom(1);
    setMapPan({ x: 0, y: 0 });
  };

  const chooseReservation = (reservation: ServiceReservation) => {
    setSelectedReservationId(reservation.id);
    setDraftTableIds(assignments[reservation.id] || []);
    setSelectedTableId("");
    setAssignOverridable(false);
    setNotice(`Select one or more tables for ${reservation.guest_name}, then assign them.`);
  };

  // "Needs a table": active reservations with no active assignment, plus
  // anything flagged for attention (docs/agent-briefs/P1A-booking-engine.md task 6).
  const needsTableList = reservations.filter((reservation) => !(assignments[reservation.id] || []).length || reservation.needs_attention);
  const pendingList = reservations.filter((reservation) => reservation.status === "pending");

  const reviewPending = async (reservation: ServiceReservation, approve: boolean, tableIds: string[], allowOverride = false) => {
    setNeedsTableLoadingId(reservation.id);
    setNotice("");
    const { error } = await supabase.rpc("review_pending_reservation", {
      p_reservation_id: reservation.id,
      p_approve: approve,
      p_table_ids: tableIds,
      p_allow_override: allowOverride,
    });
    if (error) {
      const mapped = friendlyError(error.message);
      setNotice(mapped.text);
      if (!mapped.overridable) setNeedsTableLoadingId("");
      return;
    }
    setNotice(approve ? `${reservation.guest_name} approved.` : `${reservation.guest_name} declined.`);
    setNeedsTableSuggestions((current) => { const next = { ...current }; delete next[reservation.id]; return next; });
    await loadShift();
    setNeedsTableLoadingId("");
  };

  const suggestForReservation = async (reservation: ServiceReservation) => {
    if (!reservation.service_id) return;
    setNeedsTableLoadingId(reservation.id);
    const { data } = await supabase.rpc("suggest_tables", {
      p_restaurant_id: reservation.restaurant_id,
      p_service_id: reservation.service_id,
      p_date: reservation.date,
      p_time: reservation.time,
      p_party_size: reservation.party_size,
      p_exclude_reservation_id: reservation.id,
    });
    setNeedsTableSuggestions((current) => ({ ...current, [reservation.id]: (data as Suggestion) || { options: [], warnings: [], unassigned_fits: true } }));
    setNeedsTableLoadingId("");
  };

  const assignSuggestedTable = async (reservation: ServiceReservation, allowOverride = false) => {
    const option = needsTableSuggestions[reservation.id]?.options?.[0];
    if (!option) return;
    setNeedsTableLoadingId(reservation.id);
    setNotice("");
    const { error } = await supabase.rpc("set_reservation_tables", {
      p_reservation_id: reservation.id,
      p_table_ids: option.table_ids,
      p_allow_override: allowOverride,
    });
    if (error) {
      const mapped = friendlyError(error.message);
      setNotice(mapped.text);
      if (!mapped.overridable) setNeedsTableLoadingId("");
      return;
    }
    setNotice(`${reservation.guest_name} assigned to ${option.labels.join("+")}.`);
    setNeedsTableSuggestions((current) => { const next = { ...current }; delete next[reservation.id]; return next; });
    await loadShift();
    setNeedsTableLoadingId("");
  };

  const toggleTableForReservation = (table: ServiceTable) => {
    if (!table.is_active) {
      setNotice(`${table.label} is a draft table. Enable it in Floor plan & tables before assigning it.`);
      return;
    }
    if (walkinOpen) {
      toggleWalkinTable(table.id);
      setSelectedTableId(table.id);
      return;
    }
    if (!selectedReservation) {
      setSelectedTableId(table.id);
      return;
    }
    setDraftTableIds((current) => current.includes(table.id)
      ? current.filter((id) => id !== table.id)
      : [...current, table.id]);
    setSelectedTableId(table.id);
  };

  const assignSelectedTables = async (allowOverride = false) => {
    if (!selectedReservation || !draftTableIds.length) return;
    setSaving(true);
    setNotice("");
    setAssignOverridable(false);
    const { error } = await supabase.rpc("set_reservation_tables", {
      p_reservation_id: selectedReservation.id,
      p_table_ids: draftTableIds,
      p_allow_override: allowOverride,
    });
    if (error) {
      const mapped = friendlyError(error.message);
      setNotice(mapped.text);
      setAssignOverridable(mapped.overridable);
      setSaving(false);
      return;
    }
    setNotice(`Tables assigned to ${selectedReservation.guest_name}.`);
    await loadShift();
    setSaving(false);
  };

  const updateStatus = async (reservation: ServiceReservation, status: string) => {
    setSaving(true);
    setNotice("");
    const { error } = await supabase.from("reservations").update({ status }).eq("id", reservation.id);
    if (error) {
      setNotice(error.message);
      setSaving(false);
      return;
    }
    setReservations((current) => current.map((row) => row.id === reservation.id
      ? { ...row, status, seated_at: status === "seated" ? new Date().toISOString() : row.seated_at }
      : row));
    if (["completed", "no_show", "cancelled"].includes(status)) {
      setAssignments((current) => ({ ...current, [reservation.id]: [] }));
    }
    setNotice(`${reservation.guest_name}: ${status.replaceAll("_", " ")}.`);
    setSaving(false);
  };

  const findTableReservation = (tableId: string) => {
    const reservation = reservations.find((row) => (assignments[row.id] || []).includes(tableId));
    return reservation || null;
  };

  const tableTone = (table: ServiceTable) => {
    if (!table.is_active) return { fill: "#D4CBB8", stroke: "#8E3434", text: "#2B2B2B", label: "Draft" };
    const reservation = findTableReservation(table.id);
    if (!reservation) return { fill: "#3E4E3C", stroke: "#F8F5ED", text: "#F8F5ED", label: "Available" };
    if (reservation.status === "seated") return { fill: "#A33E3E", stroke: "#F8F5ED", text: "#FFFFFF", label: `Seated · ${formatSeatedDuration(reservation.seated_at, now)}` };
    if (reservation.status === "arrived") return { fill: "#A33E3E", stroke: "#F8F5ED", text: "#FFFFFF", label: "Arrived" };
    return { fill: "#C4A26C", stroke: "#1A2238", text: "#1A2238", label: "Reserved" };
  };

  const assignmentNames = (reservationId: string) => (assignments[reservationId] || [])
    .map((tableId) => tables.find((table) => table.id === tableId)?.label)
    .filter(Boolean)
    .join(", ");
  const walkinCapacity = tables.filter((table) => walkinTableIds.includes(table.id)).reduce((total, table) => total + table.max_capacity, 0);

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-4 text-text md:px-8 md:pt-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent-gold">Sunday Rose Club · Staff</p>
            <h1 className="mt-1 font-display text-3xl text-primary">Floor service</h1>
            {pendingList.length > 0 && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">{pendingList.length} request{pendingList.length === 1 ? "" : "s"} awaiting approval</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <button type="button" onClick={() => setNewBookingOpen(true)} disabled={!restaurantId || services.length === 0} className="min-h-10 rounded border border-accent-gold/60 bg-white px-4 text-xs font-medium uppercase tracking-wide text-primary disabled:opacity-40">+ New booking</button>
            <button type="button" onClick={openWalkinForm} disabled={!restaurantId || services.length === 0} className="min-h-10 rounded bg-accent px-4 text-xs font-medium uppercase tracking-wide text-white disabled:opacity-40">+ Walk-in</button>
            <button type="button" onClick={refresh} disabled={loading} className="min-h-10 rounded border border-border-subtle bg-white px-4 text-xs text-primary disabled:opacity-50">{loading ? "Refreshing…" : "Refresh board"}</button>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-3 rounded-lg border border-border-subtle bg-white p-3 shadow-soft sm:grid-cols-3 md:p-4">
          <label className="text-[10px] uppercase tracking-widest text-text/45">Restaurant
            <select value={restaurantId} onChange={(event) => { setRestaurantId(event.target.value); setServiceFilter(""); setMapFullScreen(false); }} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-background px-3 text-sm text-primary">
              <option value="">Choose restaurant…</option>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-widest text-text/45">Service
            <div className="mt-1.5 flex gap-1 overflow-x-auto pb-1">
              {[{ id: "", name: "All" }, ...services].map((service) => (
                <button type="button" key={service.id || "all"} onClick={() => { setServiceFilter(service.id); setServiceView("floor"); setMapPan({ x: 0, y: 0 }); setMapFullScreen(Boolean(service.id)); }} aria-pressed={serviceFilter === service.id} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs ${serviceFilter === service.id ? "border-primary bg-primary text-white" : "border-border-subtle bg-white text-text/55"}`}>
                  {service.name}
                </button>
              ))}
            </div>
          </label>
          <label className="text-[10px] uppercase tracking-widest text-text/45">Date
            <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-background px-3 text-sm text-primary" />
          </label>
        </section>

        {notice && <p className="mt-3 rounded border border-accent-gold/40 bg-white px-4 py-3 text-sm text-text/65" role="status">{notice}</p>}

        {!loading && needsTableList.length > 0 && (
          <section className="mt-4 rounded-lg border border-accent/30 bg-white shadow-soft">
            <button type="button" onClick={() => setNeedsTableOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between px-4 text-left">
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Needs a table \u00b7 {needsTableList.length}</span>
              <span className="text-xs text-text/45">{needsTableOpen ? "Hide" : "Show"}</span>
            </button>
            {needsTableOpen && (
              <div className="space-y-2 border-t border-border-subtle p-3">
                {needsTableList.map((reservation) => {
                  const suggestion = needsTableSuggestions[reservation.id];
                  const topOption = suggestion?.options?.[0];
                  const isLoading = needsTableLoadingId === reservation.id;
                  return (
                    <div key={reservation.id} className="rounded border border-border-subtle p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-text">{reservation.time} \u00b7 {reservation.guest_name} \u00b7 {reservation.party_size} guests{reservation.status === "pending" ? " \u00b7 pending approval" : ""}</p>
                          {reservation.needs_attention && <p className="mt-0.5 text-[10px] uppercase tracking-wide text-amber-700">Flagged: {reservation.attention_reason?.replaceAll("_", " ") || "needs attention"}</p>}
                        </div>
                        {!suggestion && (
                          <button type="button" onClick={() => void suggestForReservation(reservation)} disabled={isLoading} className="min-h-9 rounded border border-accent-gold/60 px-3 text-[10px] uppercase tracking-wide text-primary disabled:opacity-40">
                            {isLoading ? "Checking\u2026" : "Suggest a table"}
                          </button>
                        )}
                      </div>
                      {suggestion && reservation.status === "pending" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2">
                          {topOption && <span className="text-xs text-text/55">Suggested: {topOption.labels.join("+")} ({topOption.total_capacity} seats)</span>}
                          <button type="button" onClick={() => void reviewPending(reservation, true, topOption?.table_ids || [])} disabled={isLoading} className="min-h-9 rounded bg-accent-olive px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">
                            Approve{topOption ? "" : " (no table)"}
                          </button>
                          {topOption && (
                            <button type="button" onClick={() => void reviewPending(reservation, true, [])} disabled={isLoading} className="min-h-9 rounded border border-border-subtle px-3 text-[10px] uppercase tracking-wide text-text/55">Approve without a table</button>
                          )}
                          <button type="button" onClick={() => void reviewPending(reservation, false, [])} disabled={isLoading} className="min-h-9 px-2 text-[10px] text-red-700 underline">Decline</button>
                        </div>
                      )}
                      {suggestion && reservation.status !== "pending" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2">
                          {topOption ? (
                            <>
                              <span className="text-xs text-text/55">Suggested: {topOption.labels.join("+")} ({topOption.total_capacity} seats){!topOption.fits_unassigned ? " \u2014 would overcommit the night" : ""}</span>
                              <button type="button" onClick={() => void assignSuggestedTable(reservation)} disabled={isLoading} className="min-h-9 rounded bg-primary px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Assign suggested</button>
                              {!topOption.fits_unassigned && (
                                <button type="button" onClick={() => void assignSuggestedTable(reservation, true)} disabled={isLoading} className="min-h-9 rounded bg-accent px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Book anyway</button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-accent">No table fits this party right now.</span>
                          )}
                          <button type="button" onClick={() => { chooseReservation(reservation); setNeedsTableOpen(true); }} className="min-h-9 rounded border border-border-subtle px-3 text-[10px] uppercase tracking-wide text-text/55">Choose table</button>
                          <button type="button" onClick={() => setNeedsTableSuggestions((current) => { const next = { ...current }; delete next[reservation.id]; return next; })} className="min-h-9 px-2 text-[10px] text-text/40 underline">Leave unassigned</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!loading && restaurantId && !floorplan && (
          <div className="mt-4 rounded-lg border border-dashed border-border-subtle bg-white p-5 text-sm text-text/55">
            No active floor plan for this restaurant yet. Set one up in <Link href={`/admin/restaurants/${restaurantId}/floorplan`} className="text-accent underline">Floor plan & tables</Link>.
          </div>
        )}
        {!loading && floorplan && tables.length === 0 && (
          <div className="mt-4 rounded-lg border border-accent-gold/30 bg-white p-4 text-sm text-text/60">
            No bookable tables are enabled for this floor. If you see tables marked as drafts, open <Link href={`/admin/restaurants/${restaurantId}/floorplan`} className="font-medium text-accent underline">Floor plan & tables</Link> and choose <strong>Enable all for bookings</strong>.
          </div>
        )}

        {floorplan && (
          <section className={mapFullScreen ? "fixed inset-x-0 bottom-0 top-[52px] z-20 flex flex-col overflow-y-auto bg-background p-3 md:left-56 md:top-0 md:p-4" : "mt-4 rounded-lg border border-border-subtle bg-white p-3 shadow-soft md:p-4"}>
            {mapFullScreen && (
              <div className="mb-3 grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-white p-2 shadow-soft sm:grid-cols-4">
                <select aria-label="Restaurant" value={restaurantId} onChange={(event) => { setRestaurantId(event.target.value); setServiceFilter(""); setMapFullScreen(false); }} className="min-h-10 rounded border border-border-subtle bg-background px-2 text-xs text-primary">
                  {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
                </select>
                <div aria-label="Service" className="col-span-2 flex gap-1 overflow-x-auto sm:col-span-1">
                  {[{ id: "", name: "All" }, ...services].map((service) => (
                    <button type="button" key={service.id || "all"} onClick={() => { setServiceFilter(service.id); setServiceView("floor"); setMapPan({ x: 0, y: 0 }); setMapFullScreen(Boolean(service.id)); }} aria-pressed={serviceFilter === service.id} className={`min-h-10 shrink-0 rounded-full border px-3 text-[10px] ${serviceFilter === service.id ? "border-primary bg-primary text-white" : "border-border-subtle bg-background text-text/55"}`}>
                      {service.name}
                    </button>
                  ))}
                </div>
                <input aria-label="Service date" type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="min-h-10 rounded border border-border-subtle bg-background px-2 text-xs text-primary" />
                <button type="button" onClick={() => setMapFullScreen(false)} className="min-h-10 rounded bg-primary px-3 text-[10px] font-medium uppercase tracking-widest text-white">Exit floor view</button>
              </div>
            )}
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-primary">Dining room</h2>
                <p className="mt-1 text-[10px] text-text/40">Select a booking below, then tap tables to assign them.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded border border-border-subtle bg-background p-1">
                  <button type="button" onClick={() => setServiceView("floor")} aria-pressed={serviceView === "floor"} className={`min-h-8 rounded px-3 text-[9px] uppercase tracking-wide ${serviceView === "floor" ? "bg-primary text-white" : "text-text/50"}`}>Floor plan</button>
                  <button type="button" onClick={() => setServiceView("tables")} aria-pressed={serviceView === "tables"} className={`min-h-8 rounded px-3 text-[9px] uppercase tracking-wide ${serviceView === "tables" ? "bg-primary text-white" : "text-text/50"}`}>Tables</button>
                </div>
                <div className="flex items-center rounded border border-border-subtle bg-background p-1">
                  <button type="button" onClick={() => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))} disabled={zoom <= 1} aria-label="Zoom out" className="h-8 w-8 rounded text-lg text-primary hover:bg-white disabled:opacity-30">−</button>
                  <span className="min-w-12 text-center text-[10px] text-text/45">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))} disabled={zoom >= 3} aria-label="Zoom in" className="h-8 w-8 rounded text-lg text-primary hover:bg-white disabled:opacity-30">+</button>
                  <button type="button" onClick={resetMapView} className="h-8 rounded px-2 text-[9px] uppercase text-text/45">Fit</button>
                  {!mapFullScreen && <button type="button" onClick={() => setMapFullScreen(true)} className="h-8 rounded bg-primary px-3 text-[9px] uppercase tracking-wide text-white">Full screen</button>}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {[["#3E4E3C", "Available"], ["#C4A26C", "Reserved"], ["#A33E3E", "Seated / arrived"], ["#D4CBB8", "Draft"]].map(([color, label]) => (
                    <span key={label} className="inline-flex items-center gap-1.5 text-text/50"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
                  ))}
                </div>
              </div>
            </div>
            {serviceView === "floor" ? (
              <div className="overflow-hidden rounded border border-primary/15 bg-background">
              <svg
                viewBox={mapViewBox}
                preserveAspectRatio="xMidYMid meet"
                className={`block w-full touch-none ${mapFullScreen ? "h-[62dvh] min-h-[320px] max-h-[680px] cursor-grab" : "h-[58vh] min-h-[320px] max-h-[700px] cursor-grab"}`}
                onPointerDown={startMapPan}
                onPointerMove={moveMapPan}
                onPointerUp={endMapPan}
                onPointerCancel={endMapPan}
              >
                <rect width={floorplan.canvas_width} height={floorplan.canvas_height} fill="#F8F5ED" />
                {referenceUrl && <image href={referenceUrl} width={floorplan.canvas_width} height={floorplan.canvas_height} opacity="0.25" preserveAspectRatio="none" />}
                {(floorplan.layout_data || []).map((item) => item.kind === "wall" ? (
                  <line key={item.id} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke="#1A2238" strokeWidth="12" strokeLinecap="round" pointerEvents="none" />
                ) : item.kind === "zone" ? (
                  <g key={item.id} pointerEvents="none"><rect x={item.x} y={item.y} width={item.width} height={item.height} rx="18" fill="#D4CBB8" fillOpacity="0.4" stroke="#C4A26C" strokeWidth="4" strokeDasharray="12 8" /><text x={item.x + 18} y={item.y + 35} fill="#1A2238" fontSize="22" fontWeight="600">{item.label}</text></g>
                ) : (
                  <text key={item.id} x={item.x} y={item.y} fill="#A33E3E" fontSize="24" fontWeight="700" pointerEvents="none">{item.text}</text>
                ))}
                {tables.map((table) => {
                  const x = table.x_percent * floorplan.canvas_width / 100;
                  const y = table.y_percent * floorplan.canvas_height / 100;
                  const width = table.width_percent * floorplan.canvas_width / 100;
                  const height = table.height_percent * floorplan.canvas_height / 100;
                  const tone = tableTone(table);
                  const isDraftAssigned = selectedReservationId && draftTableIds.includes(table.id);
                  return (
                    <g key={table.id} data-service-table="true" className="cursor-pointer" onClick={() => toggleTableForReservation(table)}>
                      {table.shape === "round" ? (
                        <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2} fill={tone.fill} stroke={isDraftAssigned ? "#A33E3E" : tone.stroke} strokeWidth={isDraftAssigned ? 10 : 4} transform={`rotate(${table.rotation} ${x} ${y})`} />
                      ) : (
                        <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx={table.shape === "rectangle" ? 16 : 8} fill={tone.fill} stroke={isDraftAssigned ? "#A33E3E" : tone.stroke} strokeWidth={isDraftAssigned ? 10 : 4} transform={`rotate(${table.rotation} ${x} ${y})`} />
                      )}
                      <text x={x} y={y + 5} textAnchor="middle" fill={tone.text} fontSize="23" fontWeight="700" pointerEvents="none">{table.label}</text>
                      {findTableReservation(table.id)?.status === "seated" && <text x={x} y={y + 27} textAnchor="middle" fill={tone.text} fontSize="14" fontWeight="600" pointerEvents="none">{formatSeatedDuration(findTableReservation(table.id)?.seated_at || null, now)}</text>}
                    </g>
                  );
                })}
              </svg>
              </div>
            ) : (
              <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 ${mapFullScreen ? "max-h-[58dvh] overflow-y-auto" : ""}`}>
                {tables.map((table) => {
                  const reservation = findTableReservation(table.id);
                  const tone = tableTone(table);
                  const assignedDraft = selectedReservationId && draftTableIds.includes(table.id);
                  return (
                    <button type="button" key={table.id} onClick={() => toggleTableForReservation(table)} className={`min-h-28 rounded-lg border bg-white p-3 text-left shadow-soft ${assignedDraft ? "border-accent-gold ring-2 ring-accent-gold/40" : "border-border-subtle"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-xl text-primary">{table.label}</span>
                        <span className="rounded-full px-2 py-1 text-[9px] uppercase tracking-wide" style={{ backgroundColor: `${tone.fill}22`, color: tone.fill }}>{tone.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-text/45">{table.min_capacity}–{table.max_capacity} seats{table.zone ? ` · ${table.zone}` : ""}</p>
                      {reservation && <p className="mt-2 truncate text-xs font-medium text-text">{reservation.guest_name} · {reservation.time}</p>}
                      {reservation?.status === "seated" && <p className="mt-1 text-xs font-semibold text-accent">Seated {formatSeatedDuration(reservation.seated_at, now)}</p>}
                      {assignedDraft && <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-accent-gold">Selected for booking</p>}
                    </button>
                  );
                })}
                {tables.length === 0 && <p className="col-span-full rounded border border-dashed border-border-subtle bg-white p-4 text-xs text-text/45">No bookable tables configured.</p>}
              </div>
            )}
            {mapFullScreen && (
              <div className="mt-3 min-h-0 rounded-lg border border-border-subtle bg-white shadow-soft">
                <button type="button" onClick={() => setShowBookingQueue((open) => !open)} className="flex min-h-11 w-full items-center justify-between px-3 text-left">
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">Bookings · {reservations.length}</span>
                  <span className="text-xs text-text/45">{showBookingQueue ? "Hide" : "Show"}</span>
                </button>
                {showBookingQueue && (
                  <div className="max-h-[27dvh] overflow-y-auto border-t border-border-subtle p-2">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {reservations.map((reservation) => {
                        const assigned = assignments[reservation.id] || [];
                        return (
                          <button type="button" key={reservation.id} onClick={() => chooseReservation(reservation)} className={`min-w-44 rounded border p-3 text-left ${selectedReservationId === reservation.id ? "border-accent-gold bg-background" : "border-border-subtle bg-white"}`}>
                            <span className="block text-xs font-semibold text-primary">{reservation.time} · {reservation.guest_name}</span>
                            <span className="mt-1 block text-[10px] text-text/45">{reservation.party_size} guests · {assigned.length ? assignmentNames(reservation.id) : "Needs table"}</span>
                          </button>
                        );
                      })}
                      {reservations.length === 0 && <p className="p-3 text-xs text-text/45">No bookings for this service and date.</p>}
                    </div>
                    {selectedReservation && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2">
                        <p className="text-xs text-text/55">{selectedReservation.guest_name} · {draftTableIds.map((id) => tables.find((table) => table.id === id)?.label).filter(Boolean).join(", ") || "Select tables on the map"}</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void assignSelectedTables()} disabled={!draftTableIds.length || saving} className="min-h-9 rounded bg-primary px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Assign</button>
                          {assignOverridable && <button type="button" onClick={() => void assignSelectedTables(true)} disabled={saving} className="min-h-9 rounded bg-accent px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Book anyway</button>}
                          {selectedReservation.status !== "seated" && <button type="button" onClick={() => void updateStatus(selectedReservation, "arrived")} disabled={saving} className="min-h-9 rounded border border-accent-gold/60 px-3 text-[10px] uppercase tracking-wide text-primary disabled:opacity-40">Arrived</button>}
                          {selectedReservation.status === "seated" ? <button type="button" onClick={() => void updateStatus(selectedReservation, "completed")} disabled={saving} className="min-h-9 rounded bg-accent-olive px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Complete</button> : <button type="button" onClick={() => {
                            if (!assignments[selectedReservation.id]?.length) {
                              setNotice("Save a table assignment before seating this party.");
                              return;
                            }
                            void updateStatus(selectedReservation, "seated");
                          }} disabled={saving} className="min-h-9 rounded bg-accent px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Seat</button>}
                        </div>
                      </div>
                    )}
                    {!selectedReservation && selectedTable && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2 text-xs">
                        <div>
                          <span className="font-medium text-primary">{selectedTable.label}</span>
                          <span className="ml-2 text-text/45">Seats {selectedTable.min_capacity}–{selectedTable.max_capacity} · {tableTone(selectedTable).label}</span>
                        </div>
                        {findTableReservation(selectedTable.id) && (
                          <button type="button" onClick={() => chooseReservation(findTableReservation(selectedTable.id)!)} className="text-accent underline">Open {findTableReservation(selectedTable.id)?.guest_name}</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {!mapFullScreen && selectedTable && !selectedReservation && (
          <section className="mt-4 rounded-lg border border-border-subtle bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text/40">Table</p>
                <h2 className="mt-1 font-display text-xl text-primary">{selectedTable.label}</h2>
                <p className="mt-1 text-xs text-text/45">Seats {selectedTable.min_capacity}–{selectedTable.max_capacity}{selectedTable.zone ? ` · ${selectedTable.zone}` : ""}</p>
              </div>
              {(() => {
                const reservation = findTableReservation(selectedTable.id);
                return reservation ? (
                  <div className="text-right">
                    <p className="text-sm font-medium text-text">{reservation.guest_name}</p>
                    <p className="mt-1 text-xs text-text/45">{reservation.time} · {reservation.party_size} guests · {reservation.status.replaceAll("_", " ")}</p>
                    <button type="button" onClick={() => chooseReservation(reservation)} className="mt-2 text-xs text-accent underline">Manage booking</button>
                  </div>
                ) : <p className="rounded-full bg-accent-olive/10 px-3 py-1.5 text-xs text-accent-olive">{selectedTable.is_active ? "Available" : "Draft · not bookable"}</p>;
              })()}
            </div>
          </section>
        )}

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-primary">Reservations</h2>
              <p className="mt-1 text-xs text-text/45">{reservations.length} for {serviceDate}</p>
            </div>
            <Link href="/admin/reservations" className="text-[10px] text-text/45 underline">Full reservation admin</Link>
          </div>

          {loading ? <p className="rounded border border-border-subtle bg-white p-4 text-sm text-text/40">Loading service…</p>
            : reservations.length === 0 ? <p className="rounded border border-border-subtle bg-white p-4 text-sm text-text/40">No reservations for this date and service.</p>
              : <div className="space-y-3">
                {reservations.map((reservation) => {
                  const isSelected = selectedReservationId === reservation.id;
                  const assigned = assignments[reservation.id] || [];
                  return (
                    <article key={reservation.id} className={`rounded-lg border bg-white p-4 shadow-soft transition ${isSelected ? "border-accent-gold ring-1 ring-accent-gold/50" : "border-border-subtle"}`}>
                      <button type="button" onClick={() => chooseReservation(reservation)} className="flex w-full items-start justify-between gap-3 text-left">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-xl text-primary">{reservation.time}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${STATUS_STYLE[reservation.status] || "border-border-subtle bg-background text-text/50"}`}>{reservation.status.replaceAll("_", " ")}</span>
                            {!assigned.length && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent">Needs table</span>}
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-text">{reservation.guest_name} · {reservation.party_size} {reservation.party_size === 1 ? "guest" : "guests"}</p>
                          <p className="mt-1 truncate text-xs text-text/45">{reservation.guest_phone ? `${reservation.guest_phone_code} ${reservation.guest_phone}` : reservation.guest_email}</p>
                          {assigned.length > 0 && <p className="mt-1 text-[10px] text-accent-gold">Table{assigned.length > 1 ? "s" : ""} {assignmentNames(reservation.id)}</p>}
                          {reservation.special_requests && <p className="mt-2 text-xs text-text/50">Note: {reservation.special_requests}</p>}
                        </div>
                        <span className="shrink-0 rounded border border-border-subtle px-2 py-1 text-[10px] uppercase tracking-wide text-text/45">{isSelected ? "Selected" : "Manage"}</span>
                      </button>

                      {isSelected && (
                        <div className="mt-4 border-t border-border-subtle pt-3">
                          <p className="text-xs text-text/55">Tap table markers above to assign or change the table. Selected tables: {draftTableIds.map((id) => tables.find((table) => table.id === id)?.label).filter(Boolean).join(", ") || "none"}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => void assignSelectedTables()} disabled={!draftTableIds.length || saving} className="min-h-10 rounded bg-primary px-4 text-[10px] font-medium uppercase tracking-widest text-white disabled:opacity-40">{saving ? "Saving…" : "Assign tables"}</button>
                            {assignOverridable && <button type="button" onClick={() => void assignSelectedTables(true)} disabled={saving} className="min-h-10 rounded bg-accent px-4 text-[10px] font-medium uppercase tracking-widest text-white disabled:opacity-40">Book anyway</button>}
                            {reservation.status === "confirmed" || reservation.status === "pending" ? <button type="button" onClick={() => void updateStatus(reservation, "arrived")} disabled={saving} className="min-h-10 rounded border border-accent-gold/70 px-4 text-[10px] uppercase tracking-widest text-primary disabled:opacity-40">Mark arrived</button> : null}
                            {(reservation.status === "confirmed" || reservation.status === "pending" || reservation.status === "arrived") && <button type="button" onClick={() => {
                              if (!assigned.length) {
                                setNotice("Save a table assignment before seating this party.");
                                return;
                              }
                              void updateStatus(reservation, "seated");
                            }} disabled={saving} className="min-h-10 rounded bg-accent px-4 text-[10px] uppercase tracking-widest text-white disabled:opacity-40">Seat guests</button>}
                            {reservation.status === "seated" && <button type="button" onClick={() => void updateStatus(reservation, "completed")} disabled={saving} className="min-h-10 rounded border border-accent-olive/50 px-4 text-[10px] uppercase tracking-widest text-accent-olive disabled:opacity-40">Complete</button>}
                            {reservation.status !== "seated" && <button type="button" onClick={() => void updateStatus(reservation, "no_show")} disabled={saving} className="min-h-10 px-2 text-[10px] text-text/40 underline disabled:opacity-40">No-show</button>}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>}
        </section>
      </div>

      <NewBookingPanel
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onCreated={refresh}
        defaultRestaurantId={restaurantId}
        defaultServiceId={serviceFilter || undefined}
        defaultDate={serviceDate}
      />

      {walkinOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary-dark/55 p-2 sm:items-center sm:p-4">
          <section className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-xl border border-accent-gold/40 bg-background p-4 shadow-deep sm:rounded-xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="walkin-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-accent-gold">Floor service · walk-in</p>
                <h2 id="walkin-heading" className="mt-1 font-display text-2xl text-primary">Seat a walk-in</h2>
                <p className="mt-1 text-xs text-text/45">Starts at {localTime()} · {walkinDate}</p>
              </div>
              <button type="button" onClick={() => setWalkinOpen(false)} aria-label="Close walk-in form" className="h-10 w-10 rounded border border-border-subtle text-xl text-text/50">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-widest text-text/45">Service</p>
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => (
                    <button type="button" key={service.id} onClick={() => setWalkinServiceId(service.id)} aria-pressed={walkinServiceId === service.id} className={`min-h-10 rounded-full border px-4 text-xs ${walkinServiceId === service.id ? "border-primary bg-primary text-white" : "border-border-subtle bg-white text-text/60"}`}>
                      {service.name}
                    </button>
                  ))}
                  {services.length === 0 && <p className="text-xs text-accent">Configure booking hours before seating a walk-in.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-[10px] uppercase tracking-widest text-text/45">Guest name <span className="normal-case tracking-normal">(optional)</span>
                  <input value={walkinName} onChange={(event) => setWalkinName(event.target.value)} placeholder="Walk-in" className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary placeholder:text-text/30" />
                </label>
                <label className="text-[10px] uppercase tracking-widest text-text/45">Phone <span className="normal-case tracking-normal">(optional)</span>
                  <input type="tel" value={walkinPhone} onChange={(event) => setWalkinPhone(event.target.value)} placeholder="Guest phone" className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary placeholder:text-text/30" />
                </label>
                <label className="text-[10px] uppercase tracking-widest text-text/45 sm:col-span-2">Party size
                  <input type="number" min={1} max={50} value={walkinPartySize} onChange={(event) => setWalkinPartySize(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary sm:max-w-40" />
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-text/45">Choose table(s)</p>
                  <span className={`text-xs ${walkinCapacity >= walkinPartySize ? "text-accent-olive" : "text-accent"}`}>{walkinTableIds.length ? `${walkinCapacity} seats selected` : "No tables selected"}</span>
                </div>
                {tables.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tables.map((table) => {
                    const occupant = findTableReservation(table.id);
                    const checked = walkinTableIds.includes(table.id);
                    return (
                      <button type="button" key={table.id} disabled={!!occupant} onClick={() => toggleWalkinTable(table.id)} className={`min-h-12 rounded border px-3 text-left text-xs disabled:cursor-not-allowed disabled:opacity-35 ${checked ? "border-accent-gold bg-accent-gold/15 text-primary ring-1 ring-accent-gold" : "border-border-subtle bg-white text-text/60"}`}>
                        <span className="font-medium">{table.label}</span><span className="ml-2 text-text/40">{table.max_capacity} seats</span>
                        {occupant && <span className="mt-1 block text-[10px] text-accent">{occupant.status === "seated" ? "Seated" : "Reserved"} · {occupant.guest_name}</span>}
                      </button>
                    );
                  })}
                </div> : <p className="rounded border border-dashed border-border-subtle p-3 text-xs text-text/45">No enabled tables. Enable tables in Floor plan & tables first.</p>}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                <button type="button" onClick={() => void seatWalkin()} disabled={walkinSubmitting || !walkinServiceId || !walkinTableIds.length || walkinCapacity < walkinPartySize} className="min-h-11 flex-1 rounded bg-accent px-5 text-xs font-medium uppercase tracking-widest text-white disabled:opacity-40">
                  {walkinSubmitting ? "Seating…" : "Confirm & seat party"}
                </button>
                <button type="button" onClick={() => setWalkinOpen(false)} className="min-h-11 rounded border border-border-subtle px-4 text-xs text-text/55">Cancel</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
