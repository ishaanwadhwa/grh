"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";

const restaurants = [
  {
    name: "Angels & Searchers",
    cuisine: "Wine & Italian Bar",
    description:
      "Natural wines, handmade pasta, and the kind of conversation that only happens after the second bottle.",
    image: null,
    slug: "angels-and-searchers",
  },
  {
    name: "Good Room",
    cuisine: "Speakeasy & Mediterranean Bar",
    description:
      "A hidden bar where the cocktails are Mediterranean, the music is right, and the door stays closed to the wrong crowd.",
    image: "/images/restaurants/restaurant-two/jaipurimg1.png",
    slug: "good-room",
  },
];

export default function FeaturedRestaurants() {
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
          Not just restaurants
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
              key={restaurant.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.1 }}
              className="group border border-accent-gold/10 hover:border-accent-gold/25 transition-all duration-500"
            >
              {/* Image */}
              <div className="aspect-[3/2] bg-primary-light/20 relative overflow-hidden">
                {restaurant.image ? (
                  <Image
                    src={restaurant.image}
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
