"use client";

import { motion } from "framer-motion";
import Button from "@/components/ui/Button";

export default function HeroImage() {
  return (
    <section className="relative min-h-dvh flex items-center justify-center overflow-hidden">
      {/* Background image placeholder */}
      <div className="absolute inset-0 bg-primary-dark">
        {/* Replace this div with next/image when real photos are ready */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-primary-light/30" />
      </div>

      {/* Dark overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/60 to-primary-dark/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/50 to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-32 w-full">
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="text-xs uppercase tracking-[0.3em] text-accent-gold/80 font-body font-medium mb-6"
          >
            Boutique Hospitality
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="font-display text-4xl md:text-6xl lg:text-7xl text-text-inverse leading-[1.1]"
          >
            A place for
            <br />
            people with
            <br />
            <span className="text-accent-gold">taste.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
            className="mt-8 text-base md:text-lg leading-relaxed text-text-inverse/50 max-w-md"
          >
            Micro resorts, chef-driven restaurants, and a community that feels
            like home. Starting with Jaipur.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8, ease: "easeOut" }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Button href="/properties" variant="primary" size="lg">
              Explore Properties
            </Button>
            <Button href="/restaurants" variant="secondary" size="lg">
              View Restaurants
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-px h-8 bg-gradient-to-b from-transparent via-accent-gold/40 to-transparent"
        />
      </motion.div>
    </section>
  );
}
