"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";

export default function HeroMinimal() {
  return (
    <section className="relative min-h-dvh flex items-center justify-center overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-dark via-primary to-primary-dark" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl px-6">
        {/* Logo with glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-10 flex items-center justify-center"
        >
          {/* Gold glow behind logo */}
          <div className="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full scale-150" />
          <Image
            src="/logo.png"
            alt="Good Room House"
            width={280}
            height={200}
            className="relative z-10 w-80 md:w-[28rem]"
            priority
          />
        </motion.div>

        {/* Tagline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="font-display text-3xl md:text-6xl tracking-[0.02em] text-text-inverse"
        >
          Where you belong.
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          className="mt-6 text-base md:text-lg leading-relaxed text-text-inverse/60 max-w-lg"
        >
          A curated social universe for people with taste. Boutique stays,
          chef-driven dining, and a community that feels like home.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
          className="mt-10"
        >
          <Button href="/properties" variant="secondary" size="lg">
            Explore Properties
          </Button>
        </motion.div>

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
      </div>
    </section>
  );
}
