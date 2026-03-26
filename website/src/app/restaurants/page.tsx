"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";
import { restaurants } from "@/lib/data/mock";

export default function RestaurantsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark text-text-inverse pt-28 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4"
          >
            Dining
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl text-text-inverse"
          >
            Our Restaurants
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-4 text-base text-text-inverse/50 max-w-2xl"
          >
            Not just places to eat — social anchors of the brand. Come for the
            food, stay for the energy, leave with a story.
          </motion.p>

          <SectionDivider />

          {/* Restaurant Cards */}
          <div className="space-y-16">
            {restaurants.map((restaurant, i) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className="group border border-accent-gold/10 hover:border-accent-gold/20 transition-all duration-500"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Image */}
                  <div className="aspect-[4/3] lg:aspect-auto relative overflow-hidden min-h-[300px] bg-primary-light/15">
                    {restaurant.images.length > 0 ? (
                      <Image
                        src={restaurant.images[0]}
                        alt={restaurant.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary via-primary-light/10 to-primary-dark">
                        <p className="text-accent-gold/15 text-sm tracking-widest uppercase">
                          {restaurant.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent-gold/50">
                      {restaurant.cuisine}
                    </p>

                    <h2 className="mt-3 font-display text-2xl md:text-3xl text-text-inverse group-hover:text-accent-gold transition-colors duration-300">
                      {restaurant.name}
                    </h2>

                    <p className="mt-5 text-sm leading-relaxed text-text-inverse/40">
                      {restaurant.description}
                    </p>

                    <div className="mt-6 border-t border-accent-gold/10 pt-5">
                      <p className="text-xs uppercase tracking-wider text-accent-gold/40 mb-1">
                        The Vibe
                      </p>
                      <p className="text-sm italic text-text-inverse/30">
                        {restaurant.vibe}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-accent-gold/40">
                          Hours
                        </p>
                        <p className="text-sm text-text-inverse/50">{restaurant.hours}</p>
                      </div>

                      <div className="sm:ml-auto flex gap-3">
                        <Button href={`/restaurants/${restaurant.slug}`} variant="ghost">
                          Explore
                        </Button>
                        <Button
                          href={`/reserve?restaurant=${restaurant.slug}`}
                          variant="secondary"
                        >
                          Reserve a Table
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
