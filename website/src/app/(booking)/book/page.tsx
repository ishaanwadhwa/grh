"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import RoomCard from "@/components/ui/RoomCard";
import CurrencySelector from "@/components/ui/CurrencySelector";
import PriceDisplay from "@/components/ui/PriceDisplay";
import Button from "@/components/ui/Button";
import { useBookingFlow } from "@/hooks/useBookingFlow";
import type { Room } from "@/lib/data/schema";

export default function BookPage() {
  return (
    <Suspense>
      <BookPageContent />
    </Suspense>
  );
}

function BookPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const booking = useBookingFlow();

  const propertySlug = searchParams.get("property") || booking.propertySlug;
  const checkIn = searchParams.get("checkIn") || booking.checkIn;
  const checkOut = searchParams.get("checkOut") || booking.checkOut;
  const roomIdParam = searchParams.get("room");

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync URL params into booking state
  useEffect(() => {
    if (propertySlug) booking.setProperty(propertySlug);
    if (checkIn && checkOut) booking.setDates(checkIn, checkOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch available rooms
  useEffect(() => {
    if (!propertySlug || !checkIn || !checkOut) {
      setLoading(false);
      return;
    }

    async function fetchRooms() {
      const res = await fetch(
        `/api/availability?property=${propertySlug}&checkIn=${checkIn}&checkOut=${checkOut}`
      );
      const data = await res.json();
      setAvailableRooms(data.availableRooms || []);

      // Auto-select room from URL param
      if (roomIdParam) {
        const room = (data.availableRooms || []).find((r: Room) => r.id === roomIdParam);
        if (room) booking.selectRoom(room);
      }
      setLoading(false);
    }
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertySlug, checkIn, checkOut, roomIdParam]);

  // Fetch pricing when room or currency changes
  useEffect(() => {
    if (booking.selectedRoom && booking.isHydrated) {
      booking.fetchPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.selectedRoom?.id, booking.currency]);

  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0;

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <p className="text-text-inverse/30 text-sm tracking-widest uppercase">Loading...</p>
        </main>
      </>
    );
  }

  if (!propertySlug || !checkIn || !checkOut) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-inverse/50 mb-4">Please select dates on a property page first.</p>
            <Button href="/properties/jaipur" variant="secondary">
              Browse Properties
            </Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark pt-28 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4">
              Step 1 of 4
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-text-inverse">
              Select Your Room
            </h1>
            <p className="mt-3 text-sm text-text-inverse/40">
              {checkIn} to {checkOut} &middot; {nights} night{nights !== 1 ? "s" : ""}
            </p>
          </motion.div>

          {/* Currency selector */}
          <div className="mt-8">
            <CurrencySelector selected={booking.currency} onChange={booking.setCurrency} />
          </div>

          {/* Room grid */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isSelected={booking.selectedRoom?.id === room.id}
                onSelect={(r) => booking.selectRoom(r)}
              />
            ))}
          </div>

          {/* Selected room pricing */}
          {booking.selectedRoom && booking.pricing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 border border-accent-gold/20 p-6 md:p-8 max-w-md mx-auto"
            >
              <h3 className="font-display text-xl text-text-inverse mb-4">
                {booking.selectedRoom.name}
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-inverse/50">
                    <PriceDisplay
                      amount={booking.pricing.pricePerNight}
                      currency={booking.pricing.currency}
                      size="sm"
                      showCurrency={false}
                      className="text-text-inverse/50"
                    />{" "}
                    × {booking.pricing.nights} nights
                  </span>
                  <PriceDisplay
                    amount={booking.pricing.subtotal}
                    currency={booking.pricing.currency}
                    size="sm"
                    showCurrency={false}
                    className="text-text-inverse"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-inverse/50">Taxes (18% GST)</span>
                  <PriceDisplay
                    amount={booking.pricing.taxes}
                    currency={booking.pricing.currency}
                    size="sm"
                    showCurrency={false}
                    className="text-text-inverse"
                  />
                </div>
                <div className="flex justify-between pt-3 border-t border-accent-gold/20">
                  <span className="text-sm font-medium text-text-inverse">Total</span>
                  <PriceDisplay
                    amount={booking.pricing.totalAmount}
                    currency={booking.pricing.currency}
                    size="md"
                    className="text-accent-gold"
                  />
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => router.push("/book/details")}
                  variant="primary"
                  className="w-full justify-center"
                >
                  Continue to Details
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
}
