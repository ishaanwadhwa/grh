"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";
import InlineReservation from "@/components/sections/InlineReservation";
import type { Restaurant } from "@/lib/data/schema";

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { fetchRestaurantBySlug } = await import("@/lib/supabase/browser-queries");
      const rest = await fetchRestaurantBySlug(slug);
      if (rest) setRestaurant(rest);
      setLoading(false);
    }
    load();
  }, [slug]);

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
          <p className="text-text-inverse/50">Restaurant not found.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark pt-24 pb-16">
        {/* Hero */}
        <section className="relative h-[50vh] md:h-[60vh] overflow-hidden">
          {restaurant.images.length > 0 ? (
            <Image
              src={restaurant.images[0]}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-light/20 to-primary-dark" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/50 to-transparent" />

          <div className="relative z-10 h-full flex items-end">
            <div className="mx-auto max-w-6xl px-6 pb-12 w-full">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-3"
              >
                {restaurant.cuisine}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="font-display text-4xl md:text-6xl text-text-inverse"
              >
                {restaurant.name}
              </motion.h1>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-base md:text-lg leading-relaxed text-text-inverse/50"
          >
            {restaurant.description}
          </motion.p>

          <SectionDivider />

          {/* Vibe */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-xs uppercase tracking-[0.3em] text-accent-gold/60 font-body font-medium mb-4">
              The Vibe
            </h2>
            <p className="text-base leading-relaxed text-text-inverse/40 italic">
              {restaurant.vibe}
            </p>
          </motion.div>

          <SectionDivider />

          {/* Hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-xs uppercase tracking-[0.3em] text-accent-gold/60 font-body font-medium mb-2">
              Hours
            </h2>
            <p className="text-text-inverse/50">{restaurant.hours}</p>
          </motion.div>

          <SectionDivider />

          {/* Inline Reservation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-md"
          >
            <InlineReservation
              restaurantSlug={restaurant.slug}
              restaurantName={restaurant.name}
            />
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
