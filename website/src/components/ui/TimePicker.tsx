"use client";

import { useState, useRef, useEffect } from "react";

function generateTimeSlots(openHour: number, closeHour: number): string[] {
  const slots: string[] = [];
  for (let h = openHour; h < closeHour; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
  openHour?: number;
  closeHour?: number;
}

export default function TimePicker({
  value,
  onChange,
  label = "Time",
  openHour = 12,
  closeHour = 23,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const slots = generateTimeSlots(openHour, closeHour);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs uppercase tracking-widest text-accent-gold/50 font-body font-medium mb-2">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full text-left border px-5 py-4 transition-all duration-200 ${
          open
            ? "border-accent-gold/50 bg-accent-gold/5"
            : "border-accent-gold/20 hover:border-accent-gold/35"
        }`}
      >
        <span className={`block text-sm font-body ${value ? "text-text-inverse" : "text-text-inverse/25"}`}>
          {value ? formatTime(value) : "Select time"}
        </span>
      </button>

      {/* Dropdown grid */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 w-full sm:w-[300px] border border-accent-gold/20 bg-primary-dark shadow-deep p-4 max-h-[280px] overflow-y-auto">
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => {
                  onChange(slot);
                  setOpen(false);
                }}
                className={`
                  px-3 py-2.5 text-xs font-body transition-all duration-150
                  ${value === slot
                    ? "bg-accent-gold text-primary-dark font-medium"
                    : "text-text-inverse/50 hover:bg-accent-gold/10 hover:text-text-inverse"
                  }
                `}
              >
                {formatTime(slot)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
