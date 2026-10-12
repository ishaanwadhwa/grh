"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectedReservationSlot {
  serviceId: string;
  serviceName: string;
  time: string;
}

interface SlotRow {
  serviceId: string;
  serviceName: string;
  time: string;
}

interface ReservationSlotSelectProps {
  restaurantSlug: string;
  date: string;
  partySize: number;
  value: SelectedReservationSlot | null;
  onChange: (slot: SelectedReservationSlot | null) => void;
}

function formatTime(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function ReservationSlotSelect({
  restaurantSlug,
  date,
  partySize,
  value,
  onChange,
}: ReservationSlotSelectProps) {
  const onChangeRef = useRef(onChange);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current(null);
    if (!date || !partySize) return;

    let cancelled = false;
    // A new date/party-size selection starts an asynchronous availability request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      restaurant: restaurantSlug,
      date,
      partySize: String(partySize),
    });

    fetch(`/api/reservations/availability?${params}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load times.");
        return data.slots as SlotRow[];
      })
      .then((available) => {
        if (!cancelled) setSlots(available || []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSlots([]);
          setError(reason instanceof Error ? reason.message : "Could not load times.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, date, partySize]);

  const selectedValue = value ? `${value.serviceId}|${value.time}` : "";

  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-accent-gold/50 font-body font-medium mb-2">
        Available time
      </label>
      <select
        value={selectedValue}
        disabled={!date || loading || slots.length === 0}
        onChange={(event) => {
          const slot = slots.find((item) => `${item.serviceId}|${item.time}` === event.target.value);
          onChangeRef.current(slot || null);
        }}
        className="w-full border border-accent-gold/20 bg-primary-dark px-4 py-4 text-sm text-text-inverse focus:outline-none focus:border-accent-gold/50 disabled:opacity-50"
      >
        <option value="">
          {!date
            ? "Choose a date first"
            : loading
              ? "Checking availability…"
              : slots.length === 0
                ? "No times available"
                : "Choose a time"}
        </option>
        {slots.map((slot) => (
          <option key={`${slot.serviceId}|${slot.time}`} value={`${slot.serviceId}|${slot.time}`}>
            {formatTime(slot.time)} · {slot.serviceName}
          </option>
        ))}
      </select>
      {date && error && <p className="mt-2 text-xs text-accent">{error}</p>}
      {!error && date && !loading && slots.length === 0 && (
        <p className="mt-2 text-xs text-text-inverse/30">No bookable times were found for this date and party size. The restaurant may need booking hours or tables configured.</p>
      )}
    </div>
  );
}
