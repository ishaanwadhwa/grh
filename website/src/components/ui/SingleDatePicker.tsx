"use client";

import { useState, useRef, useEffect } from "react";

interface SingleDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function SingleDatePicker({
  value,
  onChange,
  label = "Date",
  placeholder = "Select date",
}: SingleDatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDateClick = (dateStr: string) => {
    if (dateStr < todayStr) return;
    onChange(dateStr);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const isPrevDisabled = viewYear === today.getFullYear() && viewMonth <= today.getMonth();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateStr(new Date(viewYear, viewMonth, d)));
  }

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
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {/* Calendar */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 w-full sm:w-[300px] border border-accent-gold/20 bg-primary-dark shadow-deep p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              disabled={isPrevDisabled}
              className="text-text-inverse/40 hover:text-text-inverse disabled:opacity-15 transition-colors px-2 py-1"
            >
              ←
            </button>
            <span className="font-display text-base text-text-inverse">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="text-text-inverse/40 hover:text-text-inverse transition-colors px-2 py-1"
            >
              →
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] uppercase tracking-wider text-accent-gold/30 font-body py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-0">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />;

              const day = new Date(dateStr + "T00:00:00").getDate();
              const isPast = dateStr < todayStr;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDateClick(dateStr)}
                  disabled={isPast}
                  className={`
                    relative h-9 text-xs font-body transition-all duration-150
                    ${isPast ? "text-text-inverse/10 cursor-not-allowed" : "hover:bg-accent-gold/10"}
                    ${isSelected ? "bg-accent-gold text-primary-dark font-medium" : ""}
                    ${!isSelected && !isPast ? "text-text-inverse/60" : ""}
                  `}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent-gold/40 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
