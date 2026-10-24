"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ERROR_TEXT, WARNING_TEXT, friendlyError } from "@/lib/reservations/adminErrors";
import { AdminInput, AdminSelect, AdminTextarea, FormField } from "@/components/admin/FormField";
import { Close, fmtTime, sourceLabel } from "@/components/admin/ui";

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
    setNotice(`${name.trim()} booked for ${fmtTime(time)} \u00b7 ${tableLabel}${result.needs_attention ? " \u00b7 flagged for attention" : ""}.`);
    onCreated();
    window.setTimeout(onClose, 1400);
  };

  if (!open) return null;

  return (
    <div className="scrim">
      <section
        className="sheet"
        style={{ maxWidth: 640 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-booking-heading"
      >
        <p className="t-cap">New booking</p>
        <h2 id="new-booking-heading" className="t-h3 pr-12">Take a booking</h2>
        <button type="button" onClick={onClose} aria-label="Close new booking" className="sheet-close"><Close /></button>

        <div className="mt-6 space-y-10">
          {!defaultRestaurantId && (
            <FormField label="Restaurant">
              <AdminSelect value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </AdminSelect>
            </FormField>
          )}

          <div>
            <h3 className="t-h4 mb-4">Guest</h3>
            <div className="form">
              <div className="form-2">
                <FormField label="Phone">
                  <div className="flex gap-3">
                    <AdminInput value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} aria-label="Phone code" className="w-16 shrink-0" />
                    <AdminInput type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setSelectedGuest(null); }} placeholder="Guest phone" />
                  </div>
                </FormField>
                <FormField label="Name">
                  <AdminInput value={name} onChange={(event) => { setName(event.target.value); setSelectedGuest(null); }} placeholder="Guest name" />
                </FormField>
              </div>

              {matches.length > 0 && (
                <div className="card flush rows">
                  {matches.map((guest) => (
                    <button type="button" key={guest.id} onClick={() => pickGuest(guest)} className="row">
                      <span className="row-main">
                        <span className="row-title truncate">{guest.name || "Unnamed guest"}</span>
                        <span className="row-sub">{guest.phone_e164}</span>
                      </span>
                      <span className="t-cap shrink-0">{guest.visit_count} visits{guest.no_show_count ? ` \u00b7 ${guest.no_show_count} no-shows` : ""}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedGuest && (
                <div className="card">
                  <p className="t-h4">{selectedGuest.name} · {selectedGuest.visit_count} visits{selectedGuest.no_show_count ? ` \u00b7 ${selectedGuest.no_show_count} no-shows` : ""}</p>
                  {selectedGuest.notes && <p className="t-sub mt-1">Note: {selectedGuest.notes}</p>}
                  {selectedGuest.tags?.length > 0 && <p className="t-sub mt-1">Tags: {selectedGuest.tags.join(", ")}</p>}
                </div>
              )}

              <FormField label="Email (optional)">
                <AdminInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@example.com" />
              </FormField>
            </div>
          </div>

          <div>
            <h3 className="t-h4 mb-4">Booking</h3>
            <div className="form">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <FormField label="Party size">
                  <AdminInput type="number" min={1} max={50} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
                </FormField>
                <FormField label="Date">
                  <AdminInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </FormField>
                <FormField label="Time">
                  <AdminInput type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                </FormField>
                <FormField label="Service">
                  <AdminSelect value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                    <option value="">Choose…</option>
                    {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </AdminSelect>
                </FormField>
              </div>

              <FormField group label="Source">
                <div className="pills -ml-1">
                  {(["phone", "eazydiner", "other"] as Source[]).map((option) => (
                    <button type="button" key={option} onClick={() => setSource(option)} aria-pressed={source === option} className="pill">
                      {sourceLabel(option)}
                    </button>
                  ))}
                </div>
                {source === "eazydiner" && (
                  <AdminInput value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="EazyDiner booking ID" className="mt-3" />
                )}
              </FormField>

              <AdminTextarea value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} placeholder="Special requests (optional)" rows={2} />
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="t-h4">Table</h3>
              {suggestionLoading && <span className="t-cap">Checking…</span>}
            </div>

            {suggestion?.warnings?.length ? (
              <div className="mb-4 space-y-2">
                {suggestion.warnings.map((code) => (
                  <p key={code} className="rounded-xl bg-(--warn-tint) px-4 py-3 text-sm text-(--warn)">{WARNING_TEXT[code] || code}</p>
                ))}
              </div>
            ) : null}

            <div className="pills -ml-1">
              <button type="button" onClick={() => setTableMode("auto")} aria-pressed={tableMode === "auto"} className="pill">
                {suggestion?.options?.[0] ? `Suggested: ${suggestion.options[0].labels.join("+")} (${suggestion.options[0].total_capacity} seats)` : "Suggested table"}
              </button>
              <button type="button" onClick={() => setTableMode("manual")} aria-pressed={tableMode === "manual"} className="pill">
                Choose table
              </button>
              <button type="button" onClick={() => setTableMode("none")} aria-pressed={tableMode === "none"} className="pill">
                Decide later
              </button>
            </div>

            {tableMode === "manual" && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="field-label">Pick table(s)</p>
                  <span className={`t-cap ${manualCapacity >= partySize ? "text-(--pos)" : "text-(--neg)"}`}>{manualTableIds.length ? `${manualCapacity} seats selected` : "No tables selected"}</span>
                </div>
                <div className="tiles">
                  {tables.map((table) => {
                    const checked = manualTableIds.includes(table.id);
                    const taken = takenTableIds.has(table.id) && !checked;
                    return (
                      <button type="button" key={table.id} disabled={taken} onClick={() => toggleManualTable(table.id)} aria-pressed={checked} className="tile">
                        <span className="block font-medium">{table.label}</span>
                        <span className="t-cap block">{table.min_capacity}-{table.max_capacity} seats</span>
                        {taken && <span className="t-cap mt-1 block text-(--neg)">Taken at this time</span>}
                      </button>
                    );
                  })}
                  {tables.length === 0 && <p className="t-sub col-span-full">No bookable tables configured for this restaurant.</p>}
                </div>
              </div>
            )}
          </div>

          {/* Messages sit by the buttons: the sheet scrolls, and "Book anyway" must be in view after Confirm. */}
          <div className="space-y-3">
            {notice && <p className="rounded-xl bg-(--pos-tint) px-4 py-3 text-sm text-(--pos)" role="status">{notice}</p>}
            {error && (
              <div className="rounded-xl bg-(--neg-tint) px-4 py-3" role="alert">
                <p className="text-sm text-(--neg)">{error.text}</p>
                {error.overridable && (
                  <button type="button" onClick={() => void submit(true)} disabled={submitting} className="btn btn-secondary btn-sm mt-3">
                    {error.code === "NO_TABLE_AVAILABLE" && tableMode === "auto" ? "Book anyway (no table yet)" : "Book anyway"}
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void submit(false)} disabled={submitting || !serviceId} className="btn btn-primary flex-1">
                {submitting ? "Saving…" : "Confirm booking"}
              </button>
              <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
