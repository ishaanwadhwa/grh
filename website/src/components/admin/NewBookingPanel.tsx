"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ERROR_TEXT, WARNING_TEXT, friendlyError } from "@/lib/reservations/adminErrors";

interface RestaurantOption {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface TableOption {
  id: string;
  label: string;
  min_capacity: number;
  max_capacity: number;
  zone: string;
}

interface GuestMatch {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  visit_count: number;
  no_show_count: number;
  notes: string | null;
  tags: string[];
}

interface SuggestOption {
  table_ids: string[];
  labels: string[];
  total_capacity: number;
  fits_unassigned: boolean;
}

interface Suggestion {
  starts_at: string;
  ends_at: string;
  options: SuggestOption[];
  unassigned_fits: boolean;
  warnings: string[];
}

interface StaffReservationResult {
  reservation_id: string;
  table_ids: string[];
  needs_attention: boolean;
  warnings: string[];
}

type TableMode = "auto" | "manual" | "none";
type Source = "phone" | "eazydiner" | "other";

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

export default function NewBookingPanel({
  open,
  onClose,
  onCreated,
  defaultRestaurantId,
  defaultServiceId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultRestaurantId?: string;
  defaultServiceId?: string;
  defaultDate?: string;
}) {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId || "");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);

  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [matches, setMatches] = useState<GuestMatch[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestMatch | null>(null);

  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(defaultDate || localDate());
  const [time, setTime] = useState("19:00");
  const [serviceId, setServiceId] = useState(defaultServiceId || "");
  const [source, setSource] = useState<Source>("phone");
  const [externalReference, setExternalReference] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  const [tableMode, setTableMode] = useState<TableMode>("auto");
  const [manualTableIds, setManualTableIds] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [takenTableIds, setTakenTableIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code: string; text: string; overridable: boolean } | null>(null);
  const [notice, setNotice] = useState("");

  // Reset to a clean form every time the panel opens. Deferred a tick so the
  // effect body itself never calls setState synchronously.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setPhone(""); setPhoneCode("+91"); setName(""); setEmail("");
      setMatches([]); setSelectedGuest(null);
      setPartySize(2); setDate(defaultDate || localDate()); setTime("19:00");
      setRestaurantId(defaultRestaurantId || "");
      setServiceId(defaultServiceId || "");
      setSource("phone"); setExternalReference(""); setSpecialRequests("");
      setTableMode("auto"); setManualTableIds([]); setSuggestion(null); setTakenTableIds(new Set());
      setError(null); setNotice("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, defaultRestaurantId, defaultServiceId, defaultDate]);

  useEffect(() => {
    if (!open || restaurantId) return;
    void supabase.from("restaurants").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
      const rows = (data || []) as RestaurantOption[];
      setRestaurants(rows);
      setRestaurantId((current) => current || rows[0]?.id || "");
    });
  }, [open, restaurantId, supabase]);

  const loadRestaurantData = useCallback(async () => {
    if (!restaurantId) return;
    const [{ data: serviceRows }, { data: plan }] = await Promise.all([
      supabase.from("restaurant_services").select("id, name").eq("restaurant_id", restaurantId).eq("is_active", true).order("name"),
      supabase.from("restaurant_floorplans").select("id").eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle(),
    ]);
    const { data: tableRows } = plan
      ? await supabase.from("restaurant_tables").select("id, label, min_capacity, max_capacity, zone").eq("floorplan_id", plan.id).eq("is_active", true).order("label")
      : { data: [] as TableOption[] };
    setServices((serviceRows || []) as ServiceOption[]);
    setTables((tableRows || []) as TableOption[]);
    setServiceId((current) => current || (serviceRows || [])[0]?.id || "");
  }, [restaurantId, supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) void loadRestaurantData(); }, [open, loadRestaurantData]);

  // Guest lookup: by phone (6+ digits, matched against the stored E.164
  // suffix) or by name. Admin RLS allows reads on guests.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const digits = phone.replace(/\D/g, "");
      const term = digits.length >= 6 ? digits : name.trim();
      if (selectedGuest || term.length < 2) { setMatches([]); return; }
      const query = digits.length >= 6
        ? supabase.from("guests").select("id, name, phone_e164, email, visit_count, no_show_count, notes, tags").ilike("phone_e164", `%${digits}`).limit(5)
        : supabase.from("guests").select("id, name, phone_e164, email, visit_count, no_show_count, notes, tags").ilike("name", `%${name.trim()}%`).limit(5);
      void query.then(({ data }) => { if (!cancelled) setMatches((data || []) as GuestMatch[]); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [phone, name, open, selectedGuest, supabase]);

  const pickGuest = (guest: GuestMatch) => {
    setSelectedGuest(guest);
    setName(guest.name);
    setEmail(guest.email || "");
    // Guests only store a combined E.164 number, not a separate code --
    // India (+91) is assumed since that's the only code used in the booking
    // forms today; the hostess can still edit the phone field freely.
    if (guest.phone_e164) setPhone(guest.phone_e164.replace(/^\+91/, ""));
    setMatches([]);
  };

  // Suggest tables, debounced, whenever the restaurant/service/date/time/party changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (!restaurantId || !serviceId || !date || !time || partySize < 1) {
        setSuggestion(null);
        return;
      }
      setSuggestionLoading(true);
      void supabase.rpc("suggest_tables", {
        p_restaurant_id: restaurantId,
        p_service_id: serviceId,
        p_date: date,
        p_time: time,
        p_party_size: partySize,
      }).then(({ data, error: suggestError }) => {
        if (cancelled) return;
        setSuggestionLoading(false);
        setSuggestion(suggestError ? null : (data as Suggestion));
      });
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, restaurantId, serviceId, date, time, partySize, supabase]);

  // Which tables are physically occupied in this exact window, regardless of
  // whether they're big enough for this party (suggest_tables only ranks
  // tables that already fit the party, so it can't tell us that on its own).
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (!suggestion || !tables.length) { setTakenTableIds(new Set()); return; }
      void supabase.from("reservation_table_assignments")
        .select("table_id")
        .is("released_at", null)
        .lt("starts_at", suggestion.ends_at)
        .gt("ends_at", suggestion.starts_at)
        .in("table_id", tables.map((t) => t.id))
        .then(({ data }) => {
          if (cancelled) return;
          setTakenTableIds(new Set((data || []).map((row) => (row as { table_id: string }).table_id)));
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [suggestion, tables, supabase]);

  const toggleManualTable = (tableId: string) => {
    setManualTableIds((current) => current.includes(tableId) ? current.filter((id) => id !== tableId) : [...current, tableId]);
  };

  const manualCapacity = tables.filter((t) => manualTableIds.includes(t.id)).reduce((sum, t) => sum + t.max_capacity, 0);

  const submit = async (allowOverride: boolean) => {
    if (!restaurantId || !serviceId || !name.trim()) {
      setError({ code: "", text: "Choose a restaurant, service, and enter a guest name.", overridable: false });
      return;
    }
    if (source === "eazydiner" && !externalReference.trim()) {
      setError({ code: "EXTERNAL_REFERENCE_REQUIRED", text: ERROR_TEXT.EXTERNAL_REFERENCE_REQUIRED, overridable: false });
      return;
    }
    if (tableMode === "manual" && !manualTableIds.length) {
      setError({ code: "SELECT_AT_LEAST_ONE_TABLE", text: ERROR_TEXT.SELECT_AT_LEAST_ONE_TABLE, overridable: false });
      return;
    }

    // "Book anyway" after NO_TABLE_AVAILABLE can't mean "auto-pick with override" (there is
    // nothing to pick) -- in real life it means "save it with no table yet", flagged if overbooked.
    const effectiveMode = allowOverride && tableMode === "auto" && error?.code === "NO_TABLE_AVAILABLE" ? "none" : tableMode;

    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_staff_reservation", {
      p_restaurant_id: restaurantId,
      p_service_id: serviceId,
      p_date: date,
      p_time: time,
      p_party_size: partySize,
      p_guest_name: name.trim(),
      p_guest_phone: phone.trim(),
      p_guest_phone_code: phoneCode,
      p_guest_email: email.trim() || null,
      p_source: source,
      p_table_mode: effectiveMode,
      p_table_ids: effectiveMode === "manual" ? manualTableIds : [],
      p_special_requests: specialRequests.trim() || null,
      p_external_reference: source === "eazydiner" ? externalReference.trim() : null,
      p_allow_override: allowOverride,
    });

    setSubmitting(false);
    if (rpcError) {
      setError(friendlyError(rpcError.message));
      return;
    }

    const result = data as StaffReservationResult;
    const tableLabel = result.table_ids.length
      ? tables.filter((t) => result.table_ids.includes(t.id)).map((t) => t.label).join(", ")
      : "no table yet";
    setNotice(`${name.trim()} booked for ${time} \u00b7 ${tableLabel}${result.needs_attention ? " \u00b7 flagged for attention" : ""}.`);
    onCreated();
    window.setTimeout(onClose, 1400);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary-dark/55 p-2 sm:items-center sm:p-4">
      <section
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-accent-gold/40 bg-background p-4 shadow-deep sm:rounded-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-booking-heading"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent-gold">New booking</p>
            <h2 id="new-booking-heading" className="mt-1 font-display text-2xl text-primary">Take a booking</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close new booking" className="h-10 w-10 rounded border border-border-subtle text-xl text-text/50">×</button>
        </div>

        {notice && <p className="mt-4 rounded border border-accent-olive/40 bg-accent-olive/10 px-3 py-2 text-xs text-accent-olive" role="status">{notice}</p>}
        {error && (
          <div className="mt-4 rounded border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent" role="alert">
            <p>{error.text}</p>
            {error.overridable && (
              <button type="button" onClick={() => void submit(true)} disabled={submitting} className="mt-2 min-h-9 rounded bg-accent px-3 text-[10px] font-medium uppercase tracking-widest text-white disabled:opacity-40">
                {error.code === "NO_TABLE_AVAILABLE" && tableMode === "auto" ? "Book anyway (no table yet)" : "Book anyway"}
              </button>
            )}
          </div>
        )}

        <div className="mt-5 space-y-5">
          {!defaultRestaurantId && (
            <label className="block text-[10px] uppercase tracking-widest text-text/45">Restaurant
              <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary">
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
            </label>
          )}

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-text/45">Guest</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-[10px] uppercase tracking-widest text-text/45">Phone
                <div className="mt-1.5 flex gap-1">
                  <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} aria-label="Phone code" className="min-h-11 w-16 rounded border border-border-subtle bg-white px-2 text-sm text-primary" />
                  <input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setSelectedGuest(null); }} placeholder="Guest phone" className="min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary placeholder:text-text/30" />
                </div>
              </label>
              <label className="text-[10px] uppercase tracking-widest text-text/45">Name
                <input value={name} onChange={(event) => { setName(event.target.value); setSelectedGuest(null); }} placeholder="Guest name" className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary placeholder:text-text/30" />
              </label>
            </div>

            {matches.length > 0 && (
              <div className="mt-2 divide-y divide-border-subtle rounded border border-border-subtle bg-white">
                {matches.map((guest) => (
                  <button type="button" key={guest.id} onClick={() => pickGuest(guest)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-background">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-primary">{guest.name || "Unnamed guest"}</span>
                      <span className="ml-2 text-text/40">{guest.phone_e164}</span>
                    </span>
                    <span className="shrink-0 text-text/40">{guest.visit_count} visits{guest.no_show_count ? ` \u00b7 ${guest.no_show_count} no-shows` : ""}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedGuest && (
              <div className="mt-2 rounded border border-accent-gold/40 bg-accent-gold/10 px-3 py-2 text-xs text-primary">
                <p className="font-medium">{selectedGuest.name} \u00b7 {selectedGuest.visit_count} visits{selectedGuest.no_show_count ? ` \u00b7 ${selectedGuest.no_show_count} no-shows` : ""}</p>
                {selectedGuest.notes && <p className="mt-1 text-text/50">Note: {selectedGuest.notes}</p>}
                {selectedGuest.tags?.length > 0 && <p className="mt-1 text-text/50">Tags: {selectedGuest.tags.join(", ")}</p>}
              </div>
            )}

            <label className="mt-2 block text-[10px] uppercase tracking-widest text-text/45">Email <span className="normal-case tracking-normal">(optional)</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@example.com" className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary placeholder:text-text/30" />
            </label>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-text/45">Booking</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-[10px] uppercase tracking-widest text-text/45">Party size
                <input type="number" min={1} max={50} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary" />
              </label>
              <label className="text-[10px] uppercase tracking-widest text-text/45">Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary" />
              </label>
              <label className="text-[10px] uppercase tracking-widest text-text/45">Time
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary" />
              </label>
              <label className="text-[10px] uppercase tracking-widest text-text/45">Service
                <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded border border-border-subtle bg-white px-2 text-sm text-primary">
                  <option value="">Choose…</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {(["phone", "eazydiner", "other"] as Source[]).map((option) => (
                <button type="button" key={option} onClick={() => setSource(option)} aria-pressed={source === option} className={`min-h-9 rounded-full border px-4 text-xs capitalize ${source === option ? "border-primary bg-primary text-white" : "border-border-subtle bg-white text-text/60"}`}>
                  {option}
                </button>
              ))}
            </div>
            {source === "eazydiner" && (
              <input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="EazyDiner booking ID" className="mt-2 min-h-11 w-full rounded border border-border-subtle bg-white px-3 text-sm text-primary placeholder:text-text/30" />
            )}

            <textarea value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} placeholder="Special requests (optional)" rows={2} className="mt-2 w-full rounded border border-border-subtle bg-white px-3 py-2 text-sm text-primary placeholder:text-text/30" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest text-text/45">Table</p>
              {suggestionLoading && <span className="text-[10px] text-text/35">Checking…</span>}
            </div>

            {suggestion?.warnings?.length ? (
              <div className="mb-2 space-y-1">
                {suggestion.warnings.map((code) => (
                  <p key={code} className="rounded border border-accent-gold/40 bg-accent-gold/10 px-3 py-1.5 text-[11px] text-primary">{WARNING_TEXT[code] || code}</p>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTableMode("auto")} aria-pressed={tableMode === "auto"} className={`min-h-10 rounded-full border px-4 text-xs ${tableMode === "auto" ? "border-primary bg-primary text-white" : "border-border-subtle bg-white text-text/60"}`}>
                {suggestion?.options?.[0] ? `Suggested: ${suggestion.options[0].labels.join("+")} (${suggestion.options[0].total_capacity} seats)` : "Suggested table"}
              </button>
              <button type="button" onClick={() => setTableMode("manual")} aria-pressed={tableMode === "manual"} className={`min-h-10 rounded-full border px-4 text-xs ${tableMode === "manual" ? "border-primary bg-primary text-white" : "border-border-subtle bg-white text-text/60"}`}>
                Choose table
              </button>
              <button type="button" onClick={() => setTableMode("none")} aria-pressed={tableMode === "none"} className={`min-h-10 rounded-full border px-4 text-xs ${tableMode === "none" ? "border-primary bg-primary text-white" : "border-border-subtle bg-white text-text/60"}`}>
                Decide later
              </button>
            </div>

            {tableMode === "manual" && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-text/45">Pick table(s)</p>
                  <span className={`text-xs ${manualCapacity >= partySize ? "text-accent-olive" : "text-accent"}`}>{manualTableIds.length ? `${manualCapacity} seats selected` : "No tables selected"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tables.map((table) => {
                    const checked = manualTableIds.includes(table.id);
                    const taken = takenTableIds.has(table.id) && !checked;
                    return (
                      <button type="button" key={table.id} disabled={taken} onClick={() => toggleManualTable(table.id)} className={`min-h-12 rounded border px-3 text-left text-xs disabled:cursor-not-allowed disabled:opacity-35 ${checked ? "border-accent-gold bg-accent-gold/15 text-primary ring-1 ring-accent-gold" : "border-border-subtle bg-white text-text/60"}`}>
                        <span className="font-medium">{table.label}</span><span className="ml-2 text-text/40">{table.min_capacity}-{table.max_capacity} seats</span>
                        {taken && <span className="mt-1 block text-[10px] text-accent">Taken at this time</span>}
                      </button>
                    );
                  })}
                  {tables.length === 0 && <p className="col-span-full rounded border border-dashed border-border-subtle p-3 text-xs text-text/45">No bookable tables configured for this restaurant.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <button type="button" onClick={() => void submit(false)} disabled={submitting || !serviceId} className="min-h-11 flex-1 rounded bg-accent px-5 text-xs font-medium uppercase tracking-widest text-white disabled:opacity-40">
              {submitting ? "Saving…" : "Confirm booking"}
            </button>
            <button type="button" onClick={onClose} className="min-h-11 rounded border border-border-subtle px-4 text-xs text-text/55">Cancel</button>
          </div>
        </div>
      </section>
    </div>
  );
}
