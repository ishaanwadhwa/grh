"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import SingleDatePicker from "@/components/ui/SingleDatePicker";
import TimePicker from "@/components/ui/TimePicker";
import GuestCounter from "@/components/ui/GuestCounter";
import PhoneInput from "@/components/ui/PhoneInput";
import type { Restaurant } from "@/lib/data/schema";

export default function ReservePage() {
  return (
    <Suspense>
      <ReservePageContent />
    </Suspense>
  );
}

function ReservePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const restaurantSlug = searchParams.get("restaurant");

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isWhatsApp, setIsWhatsApp] = useState(true);
  const [specialRequests, setSpecialRequests] = useState("");

  useEffect(() => {
    async function load() {
      if (!restaurantSlug) {
        setLoading(false);
        return;
      }
      const { fetchRestaurantBySlug } = await import("@/lib/supabase/browser-queries");
      const rest = await fetchRestaurantBySlug(restaurantSlug);
      if (rest) setRestaurant(rest);
      setLoading(false);
    }
    load();
  }, [restaurantSlug]);

  const canSubmit = date && time && guestName.trim() && guestEmail.trim();

  const handleSubmit = async () => {
    if (!canSubmit || !restaurant) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          date,
          time,
          partySize,
          guestName,
          guestEmail,
          specialRequests: specialRequests || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(
          `/reserve/confirmation?id=${data.reservation.id}&restaurant=${restaurant.name}`
        );
      } else {
        alert(data.error || "Reservation failed. Please try again.");
        setSubmitting(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

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

  if (!restaurant) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-inverse/50 mb-4">Please select a restaurant first.</p>
            <Button href="/restaurants" variant="secondary">
              View Restaurants
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
        <div className="mx-auto max-w-xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4">
              Reserve a Table
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-text-inverse">
              {restaurant.name}
            </h1>
            <p className="mt-2 text-sm text-text-inverse/40">{restaurant.hours}</p>
          </motion.div>

          <div className="mt-10 space-y-8">
            {/* Date */}
            <SingleDatePicker
              value={date}
              onChange={setDate}
              label="Date"
              placeholder="Select date"
            />

            {/* Time */}
            <TimePicker value={time} onChange={setTime} />

            {/* Party size */}
            <GuestCounter value={partySize} max={20} onChange={setPartySize} />

            {/* Name */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
              />
            </div>

            {/* Phone */}
            <PhoneInput
              phoneCode={phoneCode}
              phoneNumber={phoneNumber}
              isWhatsApp={isWhatsApp}
              onPhoneCodeChange={setPhoneCode}
              onPhoneNumberChange={setPhoneNumber}
              onWhatsAppChange={setIsWhatsApp}
            />

            {/* Special requests */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                Special Requests <span className="opacity-50">(optional)</span>
              </label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Dietary requirements, seating preference, occasion..."
                rows={3}
                className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors resize-none"
              />
            </div>

            {/* Submit */}
            <div className="pt-4">
              <Button
                onClick={handleSubmit}
                variant="primary"
                size="lg"
                className={`w-full justify-center ${!canSubmit || submitting ? "opacity-30 pointer-events-none" : ""}`}
              >
                {submitting ? "Reserving..." : "Confirm Reservation"}
              </Button>
              <p className="mt-3 text-xs text-text-inverse/20 text-center">
                No payment required. Free cancellation up to 2 hours before.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
