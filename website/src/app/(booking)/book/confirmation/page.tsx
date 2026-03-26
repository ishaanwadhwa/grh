"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useBookingFlow } from "@/hooks/useBookingFlow";

export default function BookConfirmationPage() {
  return (
    <Suspense>
      <BookConfirmationContent />
    </Suspense>
  );
}

function BookConfirmationContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id");
  const booking = useBookingFlow();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark pt-28 pb-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          {/* Success icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 mx-auto border border-accent-gold/30 flex items-center justify-center mb-8"
          >
            <span className="text-accent-gold text-2xl">✓</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-display text-3xl md:text-4xl text-text-inverse"
          >
            Booking Confirmed
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-4 text-base text-text-inverse/50"
          >
            Your stay at Good Room House has been confirmed. We can&apos;t wait to welcome you.
          </motion.p>

          {/* Booking reference */}
          {bookingId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-8 border border-accent-gold/20 p-6 inline-block"
            >
              <p className="text-xs uppercase tracking-widest text-accent-gold/60 font-body mb-2">
                Booking Reference
              </p>
              <p className="font-display text-2xl text-accent-gold">{bookingId}</p>
            </motion.div>
          )}

          {/* Summary */}
          {booking.isHydrated && booking.selectedRoom && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-10 border border-accent-gold/10 p-6 text-left max-w-md mx-auto"
            >
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-inverse/50">Room</span>
                  <span className="text-text-inverse">{booking.selectedRoom.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-inverse/50">Check-in</span>
                  <span className="text-text-inverse">{booking.checkIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-inverse/50">Check-out</span>
                  <span className="text-text-inverse">{booking.checkOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-inverse/50">Guests</span>
                  <span className="text-text-inverse">{booking.guests}</span>
                </div>
                {booking.guestEmail && (
                  <div className="flex justify-between">
                    <span className="text-text-inverse/50">Confirmation sent to</span>
                    <span className="text-text-inverse">{booking.guestEmail}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button href="/" variant="secondary">
              Back to Home
            </Button>
            <Button href="/restaurants" variant="ghost">
              Reserve a Table
            </Button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
