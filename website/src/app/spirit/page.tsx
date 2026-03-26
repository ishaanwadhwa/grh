"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionDivider from "@/components/ui/SectionDivider";

const beliefs = [
  {
    title: "Spaces should feel like someone interesting lives here",
    body: "Not staged, not sterile, not trying too hard. Every corner has a point of view — a book left open, a scent that lingers, a chair that makes you stay longer than you planned.",
  },
  {
    title: "Hospitality should move you, not just serve you",
    body: "We don't do checklists. We do moments — the kind that catch you off guard and stay with you. A conversation at the bar, a sunset you didn't plan for, a meal that made you forget your phone.",
  },
  {
    title: "Luxury is taste, not expense",
    body: "Marble doesn't make a room. Intention does. The right light, the right music, the right people in the room. That's the luxury we're building — the kind you feel, not the kind you photograph.",
  },
  {
    title: "Community is the moat",
    body: "Hotels sell rooms. We build rooms full of people worth knowing. The guest next to you at dinner might become your co-founder, your friend, your reason to come back.",
  },
];

export default function SpiritPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark text-text-inverse pt-28 pb-24">
        <section className="mx-auto max-w-3xl px-6">
          {/* Back link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Link
              href="/"
              className="text-sm text-text-inverse/40 hover:text-accent-gold transition-colors duration-300"
            >
              &larr; Back
            </Link>
          </motion.div>

          {/* Header */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4"
          >
            The Blueprint
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl lg:text-6xl text-text-inverse"
          >
            The Spirit of the House
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-8 text-base md:text-lg leading-relaxed text-text-inverse/60 max-w-2xl"
          >
            Every house begins with a vision. Ours was simple — to create a
            space that feels both rare and real. A place where light, texture,
            and time move slowly. The Blueprint is our guiding belief:
            hospitality should move you, not just serve you.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-6 text-sm italic text-accent-gold/60"
          >
            &ldquo;Built on belonging. Designed for meaning.&rdquo;
          </motion.p>

          <SectionDivider />

          {/* Beliefs */}
          <div className="space-y-16">
            {beliefs.map((belief, i) => (
              <motion.div
                key={belief.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.05 }}
              >
                <p className="text-accent-gold/40 font-display text-lg mb-3">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="font-display text-xl md:text-2xl text-text-inverse leading-tight">
                  {belief.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-text-inverse/40">
                  {belief.body}
                </p>
              </motion.div>
            ))}
          </div>

          <SectionDivider />

          {/* What we reject / what we build */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-12"
          >
            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-accent/60 font-body font-medium mb-4">
                What we reject
              </h3>
              <ul className="space-y-3 text-text-inverse/40 text-sm">
                <li>Generic luxury hotels</li>
                <li>Soulless Airbnbs</li>
                <li>Overly formal fine dining</li>
                <li>Performative hospitality</li>
                <li>Marble for marble&apos;s sake</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-accent-gold/60 font-body font-medium mb-4">
                What we build
              </h3>
              <ul className="space-y-3 text-text-inverse/50 text-sm">
                <li>Spaces that feel like someone interesting lives here</li>
                <li>Experiences that feel unplanned but intentional</li>
                <li>A vibe that attracts the right people naturally</li>
                <li>Food that takes itself seriously, not itself too seriously</li>
                <li>Rooms with a personality, not a number</li>
              </ul>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
