"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { AdminInput } from "@/components/admin/FormField";
import TimePicker from "@/components/ui/TimePicker";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

interface ServiceForm {
  id?: string;
  name: string;
  slot_interval_minutes: number;
  seating_duration_minutes: number;
  buffer_minutes: number;
  min_party_size: number;
  max_party_size: number;
  days: number[];
  opens_at: string;
  closes_at: string;
}

const blankService = (): ServiceForm => ({
  name: "Dinner",
  slot_interval_minutes: 30,
  seating_duration_minutes: 90,
  buffer_minutes: 15,
  min_party_size: 1,
  max_party_size: 12,
  days: [0, 1, 2, 3, 4, 5, 6],
  opens_at: "17:00",
  closes_at: "22:00",
});

export default function RestaurantAvailabilityPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const [restaurantName, setRestaurantName] = useState("");
  const [services, setServices] = useState<ServiceForm[]>([]);
  const [form, setForm] = useState<ServiceForm>(blankService());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const load = useCallback(async () => {
    const [{ data: restaurant }, { data: rows }] = await Promise.all([
      supabase.from("restaurants").select("name").eq("id", restaurantId).single(),
      supabase.from("restaurant_services").select("*").eq("restaurant_id", restaurantId).order("name"),
    ]);
    setRestaurantName(restaurant?.name || "Restaurant");

    const serviceIds = (rows || []).map((row) => row.id);
    const { data: hours } = serviceIds.length
      ? await supabase.from("restaurant_service_hours").select("*").in("service_id", serviceIds)
      : { data: [] };

    setServices((rows || []).map((row) => {
      const weekly = (hours || []).filter((hour) => hour.service_id === row.id);
      const first = weekly[0];
      return {
        id: row.id,
        name: row.name,
        slot_interval_minutes: row.slot_interval_minutes,
        seating_duration_minutes: row.seating_duration_minutes,
        buffer_minutes: row.buffer_minutes,
        min_party_size: row.min_party_size,
        max_party_size: row.max_party_size,
        days: weekly.map((hour) => hour.day_of_week),
        opens_at: first?.opens_at?.slice(0, 5) || "17:00",
        closes_at: first?.closes_at?.slice(0, 5) || "22:00",
      };
    }));
    setLoading(false);
  }, [restaurantId, supabase]);

  // Load service rules from Supabase when the restaurant changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Enter a service name.";
    if (!form.days.length) errors.days = "Choose at least one day.";
    if (!form.opens_at) errors.opens_at = "Choose an opening time.";
    if (!form.closes_at) errors.closes_at = "Choose a closing time.";
    if (form.opens_at && form.closes_at && form.opens_at === form.closes_at) {
      errors.opens_at = "Open and close times cannot be the same.";
      errors.closes_at = "Choose a different closing time.";
    }
    if (!Number.isInteger(Number(form.slot_interval_minutes)) || form.slot_interval_minutes < 5 || form.slot_interval_minutes > 240) {
      errors.slot_interval_minutes = "Use an interval between 5 and 240 minutes.";
    }
    if (!Number.isInteger(Number(form.seating_duration_minutes)) || form.seating_duration_minutes < 15 || form.seating_duration_minutes > 480) {
      errors.seating_duration_minutes = "Use a duration between 15 and 480 minutes.";
    }
    if (!Number.isInteger(Number(form.buffer_minutes)) || form.buffer_minutes < 0 || form.buffer_minutes > 180) {
      errors.buffer_minutes = "Use a buffer between 0 and 180 minutes.";
    }
    if (!Number.isInteger(Number(form.min_party_size)) || form.min_party_size < 1 || form.min_party_size > 50) {
      errors.min_party_size = "Minimum party size must be between 1 and 50.";
    }
    if (!Number.isInteger(Number(form.max_party_size)) || form.max_party_size < form.min_party_size || form.max_party_size > 50) {
      errors.max_party_size = "Maximum must be at least the minimum and no more than 50.";
    }
    setFieldErrors(errors);
    setNotice("");
    setNoticeIsError(false);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const { data: serviceId, error } = await supabase.rpc("save_restaurant_service", {
        p_service_id: form.id || null,
        p_restaurant_id: restaurantId,
        p_name: form.name.trim(),
        p_slot_interval_minutes: Number(form.slot_interval_minutes),
        p_seating_duration_minutes: Number(form.seating_duration_minutes),
        p_buffer_minutes: Number(form.buffer_minutes),
        p_min_party_size: Number(form.min_party_size),
        p_max_party_size: Number(form.max_party_size),
        p_days: form.days,
        p_opens_at: form.opens_at,
        p_closes_at: form.closes_at,
      });

      if (error || !serviceId) {
        setNotice(error?.message || "The service was not saved. Check your connection and try again.");
        setNoticeIsError(true);
        setSaving(false);
        return;
      }

      setNotice("Booking hours saved.");
    setNoticeIsError(false);
    setFieldErrors({});
    await load();
    setForm(blankService());
    setSaving(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save booking hours.");
      setNoticeIsError(true);
      setSaving(false);
    }
  };

  const remove = async (serviceId: string) => {
    if (!window.confirm("Delete this booking service and its opening hours?")) return;
    const { error } = await supabase.from("restaurant_services").delete().eq("id", serviceId);
    if (error) {
      setNotice(error.message);
      setNoticeIsError(true);
    } else {
      setServices((current) => current.filter((item) => item.id !== serviceId));
      if (form.id === serviceId) setForm(blankService());
      setNotice("Service deleted.");
      setNoticeIsError(false);
    }
  };

  const update = (key: keyof ServiceForm, value: string | number | number[]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
    setNoticeIsError(false);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "opens_at" || key === "closes_at") {
        delete next.opens_at;
        delete next.closes_at;
      }
      if (key === "min_party_size" || key === "max_party_size") {
        delete next.min_party_size;
        delete next.max_party_size;
      }
      return next;
    });
  };

  if (loading) return <div className="p-6 text-sm text-text/40">Loading booking settings…</div>;

  return (
    <div className="mx-auto max-w-3xl p-4 pb-12 md:p-8">
      <Link href={`/admin/restaurants/${restaurantId}`} className="text-xs text-text/40 hover:text-text">← {restaurantName}</Link>
      <h1 className="mt-4 font-display text-2xl text-text">Booking hours</h1>
      <p className="mt-2 text-sm text-text/50">Set recurring services. Bookable times are generated from these hours and real table availability.</p>

      <section className="mt-6 rounded border border-border-subtle bg-white p-4 md:p-6">
        <h2 className="font-medium text-text">{form.id ? `Edit ${form.name}` : "Add a service"}</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs text-text/50">Service name
            <AdminInput className={`mt-2 ${fieldErrors.name ? "border-red-500 bg-red-50" : ""}`} aria-invalid={!!fieldErrors.name} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Dinner" />
            {fieldErrors.name && <span className="mt-1 block text-xs text-red-600">{fieldErrors.name}</span>}
          </label>
          <div>
            <TimePicker
              label="Open"
              value={form.opens_at}
              onChange={(time) => update("opens_at", time)}
              openHour={0}
              closeHour={24}
              variant="light"
            />
            {fieldErrors.opens_at && <p className="mt-1 text-xs text-red-600">{fieldErrors.opens_at}</p>}
          </div>
          <div>
            <TimePicker
              label="Close"
              value={form.closes_at}
              onChange={(time) => update("closes_at", time)}
              openHour={0}
              closeHour={24}
              extraTimes={["23:59"]}
              variant="light"
            />
            {fieldErrors.closes_at && <p className="mt-1 text-xs text-red-600">{fieldErrors.closes_at}</p>}
            <p className="mt-1 text-[11px] text-text/35">A closing time earlier than opening means the service closes after midnight.</p>
          </div>
          <label className="text-xs text-text/50">Slot interval (minutes)
            <AdminInput className={`mt-2 ${fieldErrors.slot_interval_minutes ? "border-red-500 bg-red-50" : ""}`} aria-invalid={!!fieldErrors.slot_interval_minutes} type="number" min={5} max={240} step={5} value={form.slot_interval_minutes} onChange={(e) => update("slot_interval_minutes", Number(e.target.value))} />
            {fieldErrors.slot_interval_minutes && <span className="mt-1 block text-xs text-red-600">{fieldErrors.slot_interval_minutes}</span>}
          </label>
          <label className="text-xs text-text/50">Seating duration (minutes)
            <AdminInput className={`mt-2 ${fieldErrors.seating_duration_minutes ? "border-red-500 bg-red-50" : ""}`} aria-invalid={!!fieldErrors.seating_duration_minutes} type="number" min={15} max={480} step={15} value={form.seating_duration_minutes} onChange={(e) => update("seating_duration_minutes", Number(e.target.value))} />
            {fieldErrors.seating_duration_minutes && <span className="mt-1 block text-xs text-red-600">{fieldErrors.seating_duration_minutes}</span>}
          </label>
          <label className="text-xs text-text/50">Turnaround buffer (minutes)
            <AdminInput className={`mt-2 ${fieldErrors.buffer_minutes ? "border-red-500 bg-red-50" : ""}`} aria-invalid={!!fieldErrors.buffer_minutes} type="number" min={0} max={180} step={5} value={form.buffer_minutes} onChange={(e) => update("buffer_minutes", Number(e.target.value))} />
            {fieldErrors.buffer_minutes && <span className="mt-1 block text-xs text-red-600">{fieldErrors.buffer_minutes}</span>}
          </label>
          <label className="text-xs text-text/50">Minimum party size
            <AdminInput className={`mt-2 ${fieldErrors.min_party_size ? "border-red-500 bg-red-50" : ""}`} aria-invalid={!!fieldErrors.min_party_size} type="number" min={1} max={50} value={form.min_party_size} onChange={(e) => update("min_party_size", Number(e.target.value))} />
            {fieldErrors.min_party_size && <span className="mt-1 block text-xs text-red-600">{fieldErrors.min_party_size}</span>}
          </label>
          <label className="text-xs text-text/50">Maximum party size
            <AdminInput className={`mt-2 ${fieldErrors.max_party_size ? "border-red-500 bg-red-50" : ""}`} aria-invalid={!!fieldErrors.max_party_size} type="number" min={1} max={50} value={form.max_party_size} onChange={(e) => update("max_party_size", Number(e.target.value))} />
            {fieldErrors.max_party_size && <span className="mt-1 block text-xs text-red-600">{fieldErrors.max_party_size}</span>}
          </label>
        </div>

        <fieldset className={`mt-5 rounded ${fieldErrors.days ? "ring-1 ring-red-500 ring-offset-4" : ""}`} aria-invalid={!!fieldErrors.days}>
          <legend className="text-xs text-text/50">Days offered</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const checked = form.days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => update("days", checked ? form.days.filter((value) => value !== day.value) : [...form.days, day.value].sort())}
                  className={`min-w-12 rounded-full border px-3 py-2 text-xs ${checked ? "border-text bg-text text-white" : "border-border-subtle text-text/50"}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {fieldErrors.days && <p className="mt-2 text-xs text-red-600">{fieldErrors.days}</p>}
        </fieldset>

        {notice && <p className={`mt-4 text-sm ${noticeIsError ? "text-red-600" : "text-green-700"}`} role={noticeIsError ? "alert" : "status"}>{notice}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={save} disabled={saving} className="min-h-11 bg-text px-5 text-xs uppercase tracking-widest text-white disabled:opacity-50">
            {saving ? "Saving…" : form.id ? "Save service" : "Add service"}
          </button>
          {form.id && <button type="button" onClick={() => { setForm(blankService()); setFieldErrors({}); setNotice(""); setNoticeIsError(false); }} className="min-h-11 px-4 text-xs text-text/50">Cancel edit</button>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-text/40">Existing services</h2>
        <div className="mt-3 space-y-3">
          {services.length === 0 ? (
            <p className="rounded border border-dashed border-border-subtle p-5 text-sm text-text/40">No booking hours yet. Add at least one service to accept online reservations.</p>
          ) : services.map((service) => (
            <article key={service.id} className="rounded border border-border-subtle bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-text">{service.name}</h3>
                  <p className="mt-1 text-sm text-text/50">{service.days.map((day) => DAYS.find((item) => item.value === day)?.label).join(", ")} · {service.opens_at}–{service.closes_at}{service.opens_at >= service.closes_at ? " (next day)" : ""}</p>
                  <p className="mt-1 text-xs text-text/35">Every {service.slot_interval_minutes} min · {service.seating_duration_minutes} min seating + {service.buffer_minutes} min buffer · parties {service.min_party_size}–{service.max_party_size}</p>
                </div>
                <div className="flex gap-4 text-xs">
                  <button type="button" onClick={() => { setForm(service); setFieldErrors({}); setNotice(""); setNoticeIsError(false); }} className="text-text/50 underline">Edit</button>
                  <button type="button" onClick={() => void remove(service.id!)} className="text-red-600 underline">Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
