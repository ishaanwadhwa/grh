"use client";

import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";
import { properties } from "@/lib/data/mock";

export default function PropertiesPage() {
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
            Our Houses
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl text-text-inverse"
          >
            Properties
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-4 text-base text-text-inverse/50 max-w-2xl"
          >
            Each Good Room House is an expression of its city — rooted in local
            context, united by a shared philosophy. Every property has its own
            soul.
          </motion.p>

          <SectionDivider />

          {/* Properties Grid */}
          <div className="grid grid-cols-1 gap-12">
            {properties.map((property, i) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className="group border border-accent-gold/10 hover:border-accent-gold/25 transition-all duration-500"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Image placeholder */}
                  <div className="aspect-[4/3] lg:aspect-auto bg-primary-light/15 flex items-center justify-center min-h-[300px]">
                    <div className="text-center">
                      <p className="text-accent-gold/20 text-sm tracking-widest uppercase">
                        {property.name}
                      </p>
                      <p className="text-text-inverse/15 text-xs mt-2">
                        Image Coming Soon
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent-gold/50">
                      {property.location}
                    </p>

                    <h2 className="mt-3 font-display text-2xl md:text-3xl text-text-inverse group-hover:text-accent-gold transition-colors duration-300">
                      {property.name}
                    </h2>

                    <p className="mt-2 font-display text-lg text-text-inverse/40 italic">
                      {property.tagline}
                    </p>

                    <p className="mt-6 text-sm leading-relaxed text-text-inverse/40 line-clamp-4">
                      {property.description}
                    </p>

                    <div className="mt-8">
                      <Button href={`/properties/${property.slug}`} variant="secondary">
                        Explore {property.slug.charAt(0).toUpperCase() + property.slug.slice(1)}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Coming Soon */}
          <SectionDivider />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <p className="font-display text-xl text-text-inverse/30">
              More cities. Coming soon.
            </p>
            <p className="mt-3 text-sm text-text-inverse/20">
              Good Room House is expanding. Follow along for new locations.
            </p>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
