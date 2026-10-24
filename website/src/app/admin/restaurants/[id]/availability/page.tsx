"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { AdminInput, AdminSelect, FormField } from "@/components/admin/FormField";
import { DAYS, Loading, RestaurantHeader, fmtTime, useNotice } from "@/components/admin/ui";

// Same choices the old time picker offered: every half hour, plus 23:59 for closing.
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const timeOptions = (value: string, extra: string[] = []) => [...new Set([...TIMES, ...extra, value].filter(Boolean))].sort();

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

// The number fields: input bounds and the range save() checks. max_party_size's floor is the form's min_party_size.
const NUMBERS = [
  { key: "slot_interval_minutes", label: "Slot interval (minutes)", min: 5, max: 240, step: 5, error: "Use an interval between 5 and 240 minutes." },
  { key: "seating_duration_minutes", label: "Seating duration (minutes)", min: 15, max: 480, step: 15, error: "Use a duration between 15 and 480 minutes." },
  { key: "buffer_minutes", label: "Turnaround buffer (minutes)", min: 0, max: 180, step: 5, error: "Use a buffer between 0 and 180 minutes." },
  { key: "min_party_size", label: "Smallest party", min: 1, max: 50, step: 1, error: "Minimum party size must be between 1 and 50." },
  { key: "max_party_size", label: "Largest party", min: 1, max: 50, step: 1, error: "Maximum must be at least the minimum and no more than 50." },
] as const;
type NumberField = (typeof NUMBERS)[number];

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ServiceForm | null>(null);
  const [adding, setAdding] = useState(false); // the new-service form stays folded away until asked for
  const { say, fail, clear, snackbar } = useNotice();

  const supabase = createClient();

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

  const floor = (field: NumberField) => field.key === "max_party_size" ? form.min_party_size : field.min;

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
    for (const field of NUMBERS) {
      const value = form[field.key];
      if (!Number.isInteger(value) || value < floor(field) || value > field.max) errors[field.key] = field.error;
    }
    setFieldErrors(errors);
    clear();
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const { data: serviceId, error } = await supabase.rpc("save_restaurant_service", {
        p_service_id: form.id || null,
        p_restaurant_id: restaurantId,
        p_name: form.name.trim(),
        p_slot_interval_minutes: form.slot_interval_minutes,
        p_seating_duration_minutes: form.seating_duration_minutes,
        p_buffer_minutes: form.buffer_minutes,
        p_min_party_size: form.min_party_size,
        p_max_party_size: form.max_party_size,
        p_days: form.days,
        p_opens_at: form.opens_at,
        p_closes_at: form.closes_at,
      });

      if (error || !serviceId) {
        fail(error ?? "The service was not saved. Check your connection and try again.");
      } else {
        say("Booking hours saved.");
        setFieldErrors({});
        await load();
        setForm(blankService());
        setAdding(false);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not save booking hours.");
    }
    setSaving(false); // not in `finally`: the React Compiler lint skips any component with a finally clause
  };

  const remove = async (serviceId: string) => {
    setDeleteTarget(null);
    const { error } = await supabase.from("restaurant_services").delete().eq("id", serviceId);
    if (error) {
      fail(error);
    } else {
      setServices((current) => current.filter((item) => item.id !== serviceId));
      if (form.id === serviceId) setForm(blankService());
      say("Service deleted.");
    }
  };

  const update = (key: keyof ServiceForm, value: string | number | number[]) => {
    setForm((current) => ({ ...current, [key]: value }));
    clear();
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

  const resetForm = (next: ServiceForm) => { setForm(next); setFieldErrors({}); clear(); };

  const numberField = (field: NumberField) => (
    <FormField key={field.key} label={field.label} error={fieldErrors[field.key]}>
      <AdminInput aria-invalid={!!fieldErrors[field.key]} type="number" min={floor(field)} max={field.max} step={field.step} value={form[field.key]} onChange={(e) => update(field.key, Number(e.target.value))} />
    </FormField>
  );

  if (loading) return <div className="page"><Loading /></div>;

  const editor = (
    <section className="card">
      <h2 className="t-h4 mb-6">{form.id ? `Edit ${form.name}` : "Add a service"}</h2>
      <div className="form">
        <FormField label="Service name" error={fieldErrors.name}>
          <AdminInput aria-invalid={!!fieldErrors.name} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Dinner" />
        </FormField>

        <fieldset aria-invalid={!!fieldErrors.days}>
          <legend className="field-label">Days offered</legend>
          <div className="pills mt-2">
            {DAYS.map((label, day) => {
              const checked = form.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => update("days", checked ? form.days.filter((value) => value !== day) : [...form.days, day].sort())}
                  className="pill"
                >
                  {label}
                </button>
              );
            })}
          </div>
          {fieldErrors.days && <p className="hint error">{fieldErrors.days}</p>}
        </fieldset>

        <div className="form-2">
          <FormField label="Opens" error={fieldErrors.opens_at}>
            <AdminSelect aria-invalid={!!fieldErrors.opens_at} value={form.opens_at} onChange={(e) => update("opens_at", e.target.value)}>
              {timeOptions(form.opens_at).map((time) => <option key={time} value={time}>{fmtTime(time)}</option>)}
            </AdminSelect>
          </FormField>
          <FormField label="Closes" error={fieldErrors.closes_at} hint="Earlier than opening means it closes after midnight.">
            <AdminSelect aria-invalid={!!fieldErrors.closes_at} value={form.closes_at} onChange={(e) => update("closes_at", e.target.value)}>
              {timeOptions(form.closes_at, ["23:59"]).map((time) => <option key={time} value={time}>{fmtTime(time)}</option>)}
            </AdminSelect>
          </FormField>
        </div>

        <div className="form-2 sm:grid-cols-3">{NUMBERS.slice(0, 3).map(numberField)}</div>
        <div className="form-2">{NUMBERS.slice(3).map(numberField)}</div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : form.id ? "Save booking hours" : "Add service"}
          </button>
          {(form.id || services.length > 0) && <button type="button" onClick={() => { resetForm(blankService()); setAdding(false); }} className="btn btn-secondary">Cancel</button>}
        </div>
      </div>
    </section>
  );

  return (
    <div className="page page-narrow">
      <RestaurantHeader id={restaurantId} name={restaurantName} current="hours" />
      <p className="t-sub mb-6">Bookable times come from these hours and real table availability.</p>

      <div className="stack">
        {services.length === 0 && (
          <p className="t-sub">No booking hours yet. Add at least one service to take bookings online.</p>
        )}
        {services.map((service) => service.id === form.id ? <div key={service.id}>{editor}</div> : (
          <article key={service.id} className="card">
            <div className="card-head">
              <h3 className="t-h4">{service.name}</h3>
              <div className="flex gap-1">
                <button type="button" onClick={() => resetForm(service)} className="btn btn-tertiary btn-sm">Edit</button>
                <button type="button" onClick={() => setDeleteTarget(service)} className="btn btn-danger btn-sm">Delete</button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div className="kv">
                <dt>Days</dt>
                <dd>{service.days.length === 7 ? "Every day" : service.days.map((day) => DAYS[day]).join(", ")}</dd>
              </div>
              <div className="kv">
                <dt>Hours</dt>
                <dd>{fmtTime(service.opens_at)} – {fmtTime(service.closes_at)}{service.opens_at >= service.closes_at ? " (next day)" : ""}</dd>
              </div>
              <div className="kv"><dt>Slots</dt><dd>Every {service.slot_interval_minutes} min</dd></div>
              <div className="kv"><dt>Seating</dt><dd>{service.seating_duration_minutes} min + {service.buffer_minutes} min buffer</dd></div>
              <div className="kv"><dt>Party size</dt><dd>{service.min_party_size}–{service.max_party_size}</dd></div>
            </dl>
          </article>
        ))}
        {!form.id && (adding || services.length === 0
          ? editor
          : <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary justify-self-start">Add a service</button>)}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this service?"
        message={`${deleteTarget?.name} and its booking hours will be deleted. Guests won't be able to book it.`}
        onConfirm={() => { if (deleteTarget?.id) void remove(deleteTarget.id); }}
        onCancel={() => setDeleteTarget(null)}
      />
      {snackbar}
    </div>
  );
}
