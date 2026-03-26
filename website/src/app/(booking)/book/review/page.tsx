"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import BookingSummary from "@/components/ui/BookingSummary";
import { useBookingFlow } from "@/hooks/useBookingFlow";

export default function BookReviewPage() {
  const router = useRouter();
  const booking = useBookingFlow();
  const [processing, setProcessing] = useState(false);

  if (!booking.isHydrated) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <p className="text-text-inverse/30 text-sm tracking-widest uppercase">Loading...</p>
        </main>
      </>
    );
  }

  if (!booking.selectedRoom || !booking.pricing || !booking.guestName) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-inverse/50 mb-4">Booking details incomplete.</p>
            <Button href="/properties/jaipur" variant="secondary">
              Start Over
            </Button>
          </div>
        </main>
      </>
    );
  }

  const handlePayAndConfirm = async () => {
    setProcessing(true);

    try {
      // Step 1: Create payment order (mock)
      const paymentRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: booking.pricing!.totalAmount,
          currency: booking.pricing!.currency,
          bookingId: `temp-${Date.now()}`,
        }),
      });
      const paymentData = await paymentRes.json();

      // Step 2: Verify payment (mock — always succeeds)
      await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: paymentData.order.id,
          paymentId: `pay_mock_${Date.now()}`,
        }),
      });

      // Step 3: Create booking
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: booking.selectedRoom!.id,
          propertyId: `prop-${booking.propertySlug}`,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: booking.guests,
          totalAmount: booking.pricing!.totalAmount,
          currency: booking.pricing!.currency,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          specialRequests: booking.specialRequests || undefined,
        }),
      });

      const bookingData = await bookingRes.json();

      if (bookingRes.ok) {
        // Navigate to confirmation with booking ID
        router.push(`/book/confirmation?id=${bookingData.booking.id}`);
      } else {
        alert(bookingData.error || "Booking failed. Please try again.");
        setProcessing(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark pt-28 pb-16">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4">
              Step 3 of 4
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-text-inverse">
              Review & Pay
            </h1>
            <p className="mt-3 text-sm text-text-inverse/40">
              Please review your booking details before confirming.
            </p>
          </motion.div>

          <div className="mt-10">
            <BookingSummary
              room={booking.selectedRoom}
              pricing={booking.pricing}
              guests={booking.guests}
              specialRequests={booking.specialRequests}
              guestName={booking.guestName}
              guestEmail={booking.guestEmail}
            />
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Button onClick={() => router.back()} variant="ghost">
              &larr; Back
            </Button>
            <Button
              onClick={handlePayAndConfirm}
              variant="primary"
              size="lg"
              className={`flex-1 justify-center ${processing ? "opacity-50 pointer-events-none" : ""}`}
            >
              {processing ? "Processing..." : "Confirm & Pay"}
            </Button>
          </div>

          <p className="mt-4 text-xs text-text-inverse/20 text-center">
            By confirming, you agree to our cancellation policy and terms of service.
          </p>
        </div>
      </main>
    </>
  );
}
