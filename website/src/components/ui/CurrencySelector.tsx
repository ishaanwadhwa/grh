"use client";

import type { Currency } from "@/lib/data/schema";

const currencies: { code: Currency; symbol: string; label: string }[] = [
  { code: "INR", symbol: "₹", label: "INR" },
  { code: "USD", symbol: "$", label: "USD" },
  { code: "GBP", symbol: "£", label: "GBP" },
];

interface CurrencySelectorProps {
  selected: Currency;
  onChange: (currency: Currency) => void;
}

export default function CurrencySelector({ selected, onChange }: CurrencySelectorProps) {
  return (
    <div className="flex gap-1 border border-accent-gold/15 p-0.5">
      {currencies.map((c) => (
        <button
          key={c.code}
          onClick={() => onChange(c.code)}
          className={`px-3 py-1.5 text-xs tracking-wider font-body font-medium transition-all duration-200 ${
            selected === c.code
              ? "bg-accent-gold/15 text-accent-gold"
              : "text-text-inverse/40 hover:text-text-inverse/60"
          }`}
        >
          {c.symbol} {c.label}
        </button>
      ))}
    </div>
  );
}
