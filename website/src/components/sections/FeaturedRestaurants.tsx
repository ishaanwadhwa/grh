"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";
import { fetchRestaurants } from "@/lib/supabase/browser-queries";
import type { Restaurant } from "@/lib/data/schema";

export default function FeaturedRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  useEffect(() => {
    fetchRestaurants(true).then(setRestaurants); // featuredOnly = true
  }, []);

  if (restaurants.length === 0) return null;

  return (
    <section className="py-24 md:py-32 bg-primary-dark">
      <div className="mx-auto max-w-6xl px-6">
        <SectionDivider />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4"
        >
          Dining
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center font-display text-3xl md:text-5xl text-text-inverse mb-6"
        >
          Two rooms. Two moods.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-center text-base text-text-inverse/40 mb-16 max-w-lg mx-auto"
        >
          Social anchors of the brand. Entry points for a new audience. Places
          where you come for the food and stay for the energy.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {restaurants.map((restaurant, i) => (
            <motion.div
              key={restaurant.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.1 }}
              className="group border border-accent-gold/10 hover:border-accent-gold/25 transition-all duration-500"
            >
              {/* Image */}
              <div className="aspect-[3/2] bg-primary-light/20 relative overflow-hidden">
                {restaurant.images.length > 0 ? (
                  <Image
                    src={restaurant.images[0]}
                    alt={restaurant.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-accent-gold/20 text-sm tracking-widest uppercase">
                      Image Coming Soon
                    </p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-6 md:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-accent-gold/50">
                  {restaurant.cuisine}
                </p>
                <h3 className="mt-3 font-display text-xl md:text-2xl text-text-inverse group-hover:text-accent-gold transition-colors duration-300">
                  {restaurant.name}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-text-inverse/40">
                  {restaurant.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Button href="/restaurants" variant="ghost">
            View All Restaurants &rarr;
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
