"use client";

import { motion } from "framer-motion";
import SectionDivider from "@/components/ui/SectionDivider";

export default function BrandStory() {
  return (
    <section className="py-24 md:py-32 bg-primary-dark">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <SectionDivider />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-8"
        >
          The Philosophy
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-2xl md:text-4xl lg:text-5xl text-text-inverse leading-tight"
        >
          Luxury is no longer about marble and excess.
          <br />
          <span className="text-accent-gold">
            It is about taste, intimacy, and energy.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-base md:text-lg leading-relaxed text-text-inverse/50 max-w-2xl mx-auto"
        >
          Good Room House is a hospitality brand built for people who care about
          aesthetics and energy. We blend boutique stays, chef-driven dining, and
          cultural community into spaces that feel like someone interesting lives
          here.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-12 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-text-inverse/30"
        >
          <div>
            <p className="mt-2 text-xs uppercase tracking-widest">
              Micro Resorts
            </p>
          </div>
          <div className="hidden md:block h-8 w-px bg-accent-gold/20" />
          <div>
            <p className="mt-2 text-xs uppercase tracking-widest">
              Restaurants
            </p>
          </div>
          <div className="hidden md:block h-8 w-px bg-accent-gold/20" />
          <div>
            <p className="mt-2 text-xs uppercase tracking-widest">Community</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
