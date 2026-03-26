"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

export default function ReserveConfirmationPage() {
  return (
    <Suspense>
      <ReserveConfirmationContent />
    </Suspense>
  );
}

function ReserveConfirmationContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("id");
  const restaurantName = searchParams.get("restaurant");

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
            Table Reserved
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-4 text-base text-text-inverse/50"
          >
            Your table at{" "}
            <span className="text-accent-gold">{restaurantName || "the restaurant"}</span> has been
            reserved. See you there.
          </motion.p>

          {/* Reservation reference */}
          {reservationId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-8 border border-accent-gold/20 p-6 inline-block"
            >
              <p className="text-xs uppercase tracking-widest text-accent-gold/60 font-body mb-2">
                Reservation Reference
              </p>
              <p className="font-display text-2xl text-accent-gold">{reservationId}</p>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button href="/" variant="secondary">
              Back to Home
            </Button>
            <Button href="/properties/jaipur" variant="ghost">
              Book a Stay
            </Button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
