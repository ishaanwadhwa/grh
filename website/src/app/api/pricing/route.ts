import { getRoomById } from "@/lib/data/mock";
import type { Currency, PricingResponse } from "@/lib/data/schema";

// Hardcoded exchange rates (INR base). Replace with live rates later.
const EXCHANGE_RATES: Record<Currency, number> = {
  INR: 1,
  USD: 0.012, // 1 INR ≈ 0.012 USD
  GBP: 0.0095, // 1 INR ≈ 0.0095 GBP
};

const GST_RATE = 0.18; // 18% GST on room tariff

function convertCurrency(amountINR: number, currency: Currency): number {
  const converted = amountINR * EXCHANGE_RATES[currency];
  // Round to 2 decimal places for USD/GBP, whole numbers for INR
  return currency === "INR" ? Math.round(converted) : Math.round(converted * 100) / 100;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { roomId, checkIn, checkOut, currency = "INR" } = body;

  if (!roomId || !checkIn || !checkOut) {
    return Response.json(
      { error: "Missing required fields: roomId, checkIn, checkOut" },
      { status: 400 }
    );
  }

  const room = getRoomById(roomId);
  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (nights <= 0) {
    return Response.json({ error: "Invalid date range" }, { status: 400 });
  }

  // --- PRICING LOGIC ---
  // MVP: flat base price per night
  // Future: this is where the external pricing service gets called
  // The interface stays the same — only the logic behind it changes

  const breakdown = [];
  let subtotalINR = 0;

  for (let i = 0; i < nights; i++) {
    const date = new Date(checkInDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    // MVP: every night is the same base price
    // Future: per-night dynamic pricing goes here
    const nightPriceINR = room.basePricePerNight;
    subtotalINR += nightPriceINR;

    breakdown.push({
      date: dateStr,
      price: convertCurrency(nightPriceINR, currency as Currency),
    });
  }

  const taxesINR = Math.round(subtotalINR * GST_RATE);
  const totalINR = subtotalINR + taxesINR;

  const response: PricingResponse = {
    roomId,
    checkIn,
    checkOut,
    nights,
    pricePerNight: convertCurrency(room.basePricePerNight, currency as Currency),
    subtotal: convertCurrency(subtotalINR, currency as Currency),
    taxRate: GST_RATE,
    taxes: convertCurrency(taxesINR, currency as Currency),
    totalAmount: convertCurrency(totalINR, currency as Currency),
    currency: currency as Currency,
    breakdown,
  };

  return Response.json(response);
}
