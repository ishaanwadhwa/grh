"use client";

import { motion } from "framer-motion";
import SectionDivider from "@/components/ui/SectionDivider";

export default function NewsletterSignup() {
  return (
    <section className="py-24 md:py-32 bg-primary">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <SectionDivider />

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="font-display text-2xl md:text-4xl text-text-inverse"
        >
          Stay in the loop
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-4 text-sm text-text-inverse/40"
        >
          New properties, events, dinners, and stories — delivered with taste.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row gap-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 bg-transparent border border-accent-gold/30 px-5 py-3.5 text-sm text-text-inverse placeholder:text-text-inverse/25 focus:outline-none focus:border-accent-gold/60 transition-colors duration-300 font-body"
          />
          <button
            type="submit"
            className="px-8 py-3.5 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs uppercase tracking-widest font-medium hover:bg-accent-gold/20 transition-all duration-300 font-body"
          >
            Subscribe
          </button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-4 text-xs text-text-inverse/20 italic"
        >
          No spam. Only things worth your attention.
        </motion.p>
      </div>
    </section>
  );
}
