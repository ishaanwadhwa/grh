"use client";

import { useState, useRef, useEffect } from "react";

interface DatePickerProps {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
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
  if (!dateStr) return "Select date";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

type Selecting = "checkIn" | "checkOut";

export default function DatePicker({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
}: DatePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<Selecting>("checkIn");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
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

    if (selecting === "checkIn") {
      onCheckInChange(dateStr);
      if (checkOut && dateStr >= checkOut) {
        onCheckOutChange("");
      }
      setSelecting("checkOut");
    } else {
      if (checkIn && dateStr <= checkIn) {
        // If they pick a date before check-in, reset and start over
        onCheckInChange(dateStr);
        onCheckOutChange("");
        setSelecting("checkOut");
      } else {
        onCheckOutChange(dateStr);
        setOpen(false);
        setSelecting("checkIn");
      }
    }
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

  // Build calendar grid
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateStr(new Date(viewYear, viewMonth, d)));
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => { setSelecting("checkIn"); setOpen(true); }}
          className={`flex-1 text-left border px-5 py-4 transition-all duration-200 ${
            open && selecting === "checkIn"
              ? "border-accent-gold/50 bg-accent-gold/5"
              : "border-accent-gold/20 hover:border-accent-gold/35"
          }`}
        >
          <span className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-1">
            Check-in
          </span>
          <span className={`block text-sm font-body ${checkIn ? "text-text-inverse" : "text-text-inverse/25"}`}>
            {formatDisplay(checkIn)}
          </span>
        </button>

        <div className="hidden sm:flex items-center text-accent-gold/20">→</div>

        <button
          type="button"
          onClick={() => { setSelecting("checkOut"); setOpen(true); }}
          className={`flex-1 text-left border px-5 py-4 transition-all duration-200 ${
            open && selecting === "checkOut"
              ? "border-accent-gold/50 bg-accent-gold/5"
              : "border-accent-gold/20 hover:border-accent-gold/35"
          }`}
        >
          <span className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-1">
            Check-out
          </span>
          <span className={`block text-sm font-body ${checkOut ? "text-text-inverse" : "text-text-inverse/25"}`}>
            {formatDisplay(checkOut)}
          </span>
        </button>
      </div>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 w-full sm:w-[340px] border border-accent-gold/20 bg-primary-dark shadow-deep p-5">
          {/* Selecting indicator */}
          <p className="text-xs uppercase tracking-widest text-accent-gold/50 font-body mb-4">
            Select {selecting === "checkIn" ? "check-in" : "check-out"} date
          </p>

          {/* Month navigation */}
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

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />;

              const day = new Date(dateStr + "T00:00:00").getDate();
              const isPast = dateStr < todayStr;
              const isCheckIn = dateStr === checkIn;
              const isCheckOut = dateStr === checkOut;
              const isInRange = checkIn && checkOut && dateStr > checkIn && dateStr < checkOut;
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
                    ${isCheckIn ? "bg-accent-gold text-primary-dark font-medium" : ""}
                    ${isCheckOut ? "bg-accent-gold text-primary-dark font-medium" : ""}
                    ${isInRange ? "bg-accent-gold/10 text-accent-gold" : ""}
                    ${!isCheckIn && !isCheckOut && !isInRange && !isPast ? "text-text-inverse/60" : ""}
                  `}
                >
                  {day}
                  {isToday && !isCheckIn && !isCheckOut && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent-gold/40 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick info */}
          {checkIn && checkOut && (
            <div className="mt-4 pt-3 border-t border-accent-gold/10 flex justify-between text-xs text-text-inverse/30">
              <span>{formatDisplay(checkIn)} → {formatDisplay(checkOut)}</span>
              <span className="text-accent-gold/60">
                {Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)} nights
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
