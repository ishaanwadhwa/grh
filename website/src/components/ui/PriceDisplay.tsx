import type { Currency } from "@/lib/data/schema";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  GBP: "£",
};

interface PriceDisplayProps {
  amount: number;
  currency: Currency;
  className?: string;
  showCurrency?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function PriceDisplay({
  amount,
  currency,
  className = "",
  showCurrency = true,
  size = "md",
}: PriceDisplayProps) {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted =
    currency === "INR"
      ? amount.toLocaleString("en-IN")
      : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const sizeClass = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl md:text-3xl",
  }[size];

  return (
    <span className={`font-display ${sizeClass} ${className}`}>
      {symbol}
      {formatted}
      {showCurrency && (
        <span className="text-xs ml-1 opacity-50 font-body">{currency}</span>
      )}
    </span>
  );
}
