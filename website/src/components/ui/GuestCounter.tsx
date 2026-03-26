"use client";

interface GuestCounterProps {
  value: number;
  max: number;
  onChange: (count: number) => void;
}

export default function GuestCounter({ value, max, onChange }: GuestCounterProps) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
        Guests
      </label>
      <div className="flex items-center gap-0 border border-accent-gold/20 inline-flex">
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          className="px-4 py-3 text-text-inverse/50 hover:text-text-inverse disabled:opacity-20 transition-colors"
        >
          −
        </button>
        <span className="px-4 py-3 text-sm text-text-inverse font-body min-w-[3rem] text-center border-x border-accent-gold/10">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="px-4 py-3 text-text-inverse/50 hover:text-text-inverse disabled:opacity-20 transition-colors"
        >
          +
        </button>
      </div>
      <p className="mt-1 text-xs text-text-inverse/30">Max {max} guests</p>
    </div>
  );
}
