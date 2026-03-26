import type { Room, PricingResponse } from "@/lib/data/schema";
import PriceDisplay from "./PriceDisplay";

interface BookingSummaryProps {
  room: Room;
  pricing: PricingResponse;
  guests: number;
  specialRequests?: string;
  guestName?: string;
  guestEmail?: string;
}

export default function BookingSummary({
  room,
  pricing,
  guests,
  specialRequests,
  guestName,
  guestEmail,
}: BookingSummaryProps) {
  return (
    <div className="border border-accent-gold/20 p-6 md:p-8">
      <h3 className="text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-6">
        Booking Summary
      </h3>

      {/* Room */}
      <div className="mb-6">
        <p className="font-display text-xl text-text-inverse">{room.name}</p>
        <p className="text-sm text-text-inverse/40 mt-1">
          {room.bedType} &middot; {room.size} &middot; Up to {room.capacity} guests
        </p>
      </div>

      {/* Dates */}
      <div className="flex justify-between py-3 border-t border-accent-gold/10">
        <span className="text-sm text-text-inverse/50">Check-in</span>
        <span className="text-sm text-text-inverse">{pricing.checkIn}</span>
      </div>
      <div className="flex justify-between py-3 border-t border-accent-gold/10">
        <span className="text-sm text-text-inverse/50">Check-out</span>
        <span className="text-sm text-text-inverse">{pricing.checkOut}</span>
      </div>
      <div className="flex justify-between py-3 border-t border-accent-gold/10">
        <span className="text-sm text-text-inverse/50">Nights</span>
        <span className="text-sm text-text-inverse">{pricing.nights}</span>
      </div>
      <div className="flex justify-between py-3 border-t border-accent-gold/10">
        <span className="text-sm text-text-inverse/50">Guests</span>
        <span className="text-sm text-text-inverse">{guests}</span>
      </div>

      {/* Guest info */}
      {guestName && (
        <div className="flex justify-between py-3 border-t border-accent-gold/10">
          <span className="text-sm text-text-inverse/50">Name</span>
          <span className="text-sm text-text-inverse">{guestName}</span>
        </div>
      )}
      {guestEmail && (
        <div className="flex justify-between py-3 border-t border-accent-gold/10">
          <span className="text-sm text-text-inverse/50">Email</span>
          <span className="text-sm text-text-inverse">{guestEmail}</span>
        </div>
      )}

      {specialRequests && (
        <div className="py-3 border-t border-accent-gold/10">
          <p className="text-sm text-text-inverse/50 mb-1">Special Requests</p>
          <p className="text-sm text-text-inverse/70 italic">{specialRequests}</p>
        </div>
      )}

      {/* Pricing */}
      <div className="mt-4 pt-4 border-t border-accent-gold/20">
        <div className="flex justify-between py-2">
          <span className="text-sm text-text-inverse/50">
            <PriceDisplay
              amount={pricing.pricePerNight}
              currency={pricing.currency}
              size="sm"
              showCurrency={false}
              className="text-text-inverse/50"
            />{" "}
            × {pricing.nights} nights
          </span>
          <PriceDisplay
            amount={pricing.subtotal}
            currency={pricing.currency}
            size="sm"
            showCurrency={false}
            className="text-text-inverse"
          />
        </div>
        <div className="flex justify-between py-2">
          <span className="text-sm text-text-inverse/50">
            Taxes ({Math.round(pricing.taxRate * 100)}% GST)
          </span>
          <PriceDisplay
            amount={pricing.taxes}
            currency={pricing.currency}
            size="sm"
            showCurrency={false}
            className="text-text-inverse"
          />
        </div>
        <div className="flex justify-between py-3 border-t border-accent-gold/20 mt-2">
          <span className="text-sm font-medium text-text-inverse">Total</span>
          <PriceDisplay
            amount={pricing.totalAmount}
            currency={pricing.currency}
            size="md"
            className="text-accent-gold"
          />
        </div>
      </div>
    </div>
  );
}
