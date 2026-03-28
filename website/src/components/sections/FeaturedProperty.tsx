"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";
import { fetchFeaturedProperty } from "@/lib/supabase/browser-queries";
import type { Property } from "@/lib/data/schema";

export default function FeaturedProperty() {
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    fetchFeaturedProperty().then(setProperty);
  }, []);

  if (!property) return null;

  const cityName = property.location.split(",")[0];

  return (
    <section className="py-24 md:py-32 bg-primary">
      <div className="mx-auto max-w-6xl px-6">
        <SectionDivider />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4"
        >
          Featured Property
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center font-display text-3xl md:text-5xl text-text-inverse mb-16"
        >
          {cityName}
        </motion.h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Property Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="aspect-[4/3] bg-primary-light/30 border border-accent-gold/10 relative overflow-hidden"
          >
            {property.images.length > 0 ? (
              <Image
                src={property.images[0]}
                alt={property.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-accent-gold/30 text-sm tracking-widest uppercase">
                  Image Coming Soon
                </p>
              </div>
            )}
          </motion.div>

          {/* Property Details */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col justify-center"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-accent-gold/60 font-body">
              {property.location}
            </p>

            <h3 className="mt-4 font-display text-2xl md:text-3xl text-text-inverse">
              {property.tagline}
            </h3>

            <p className="mt-6 text-base leading-relaxed text-text-inverse/50">
              {property.description.split(". ").slice(0, 2).join(". ") + "."}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="border border-accent-gold/15 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-accent-gold/50">
                  Restaurants
                </p>
                <p className="mt-1 font-display text-lg text-text-inverse">
                  {property.restaurantIds.length || 2}
                </p>
              </div>
              <div className="border border-accent-gold/15 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-accent-gold/50">
                  Experience
                </p>
                <p className="mt-1 font-display text-lg text-text-inverse">
                  Curated
                </p>
              </div>
            </div>

            <div className="mt-10">
              <Button href={`/properties/${property.slug}`} variant="secondary">
                Discover {cityName}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
