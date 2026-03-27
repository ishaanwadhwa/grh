"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionDivider from "@/components/ui/SectionDivider";

const founders = [
  {
    name: "Ajay Saini",
    role: "Founder & CEO — The Visionary",
    bio: [
      "A restaurateur, a storyteller, and the original dreamer behind Good Room House. Ajay built his legacy on understanding what makes a space feel right — not just in its design, but in its soul.",
      "The architecture of belonging — that's his craft. His eye for detail and warmth for people define everything the House stands for.",
    ],
    quote: "Every corner should feel like it remembers you.",
    image: null,
    cardStyle: "border border-accent-gold/20 bg-background text-text",
  },
  {
    name: "Sahar Saini",
    role: "Founder & COO — The Heart of the House",
    bio: [
      "The daughter of the vision, and the keeper of its vibe. Sahar brings the pulse — the music, the warmth, the spirit that makes Good Room House come alive.",
      "She curates not just spaces, but moments — from the scent in the lobby to the energy of an evening. For her, hospitality isn't service — it's seduction.",
    ],
    quote: "The vibe is the experience. The experience is everything.",
    image: "/images/founders/sahar-saini/img.jpeg",
    cardStyle: "border border-accent-gold/20 bg-background-soft text-text",
  },
];

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

export default function HousemakersPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark text-text-inverse pt-28 pb-24">
        {/* ── Housemakers Section ── */}
        <section className="mx-auto max-w-6xl px-6">
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
            The People
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl lg:text-6xl text-text-inverse"
          >
            The Housemakers
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-3 text-sm italic text-text-inverse/80"
          >
            Those who built the room — and filled it with soul.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-8 text-base leading-relaxed text-text-inverse/50 max-w-3xl"
          >
            Behind Good Room House is a duo that blends legacy with instinct — a
            father&apos;s vision and a daughter&apos;s modern sensibility. Together,
            they&apos;ve created a brand that feels both timeless and alive — where
            design meets emotion, and hospitality feels human again.
          </motion.p>

          {/* Founder Cards */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {founders.map((founder, i) => (
              <motion.div
                key={founder.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 + i * 0.15 }}
                className={`${founder.cardStyle} p-8 md:p-10 shadow-soft hover:shadow-deep transition-all duration-500 hover:-translate-y-0.5`}
              >
                {/* Photo */}
                <div className="w-24 h-24 bg-primary-light/30 border border-accent-gold/10 mb-6 relative overflow-hidden">
                  {founder.image ? (
                    <Image
                      src={founder.image}
                      alt={founder.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-2xl text-accent-gold/30">
                        {founder.name.split(" ").map((n) => n[0]).join("")}
                      </span>
                    </div>
                  )}
                </div>

                <h3 className="font-display text-2xl md:text-3xl">
                  {founder.name}
                </h3>
                <p className="mt-1 text-sm tracking-wide opacity-70">
                  {founder.role}
                </p>

                <div className="mt-6 space-y-4 text-[15px] leading-relaxed opacity-80">
                  {founder.bio.map((paragraph, j) => (
                    <p key={j}>{paragraph}</p>
                  ))}
                </div>

                <p className="mt-6 text-sm italic text-text/60">
                  &ldquo;{founder.quote}&rdquo;
                </p>
              </motion.div>
            ))}
          </div>

          {/* Founders' Note */}
          <SectionDivider />

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <h2 className="font-display text-2xl md:text-3xl text-text-inverse">
              Founders&apos; Note
            </h2>
            <p className="mt-6 text-base leading-relaxed text-text-inverse/50">
              Good Room House was never meant to be just a hotel. It&apos;s a
              conversation — between design, desire, and people. A place where
              detail becomes memory, and arrival feels like a return.
            </p>
            <p className="mt-4 text-sm italic text-accent-gold/60">
              — Ajay & Sahar
            </p>
          </motion.section>
        </section>

        {/* ── Spirit of the House Section ── */}
        <section className="mx-auto max-w-3xl px-6 mt-24">
          <SectionDivider />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4"
          >
            The Blueprint
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-3xl md:text-4xl lg:text-5xl text-text-inverse"
          >
            The Spirit of the House
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
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
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
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
                <h3 className="font-display text-xl md:text-2xl text-text-inverse leading-tight">
                  {belief.title}
                </h3>
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
