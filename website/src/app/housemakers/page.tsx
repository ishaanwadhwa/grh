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

export default function HousemakersPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark text-text-inverse pt-28 pb-24">
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
            className="mt-3 text-sm italic text-text-inverse/60"
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

                <p className="mt-6 text-xs italic text-accent-gold/70">
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
      </main>
      <Footer />
    </>
  );
}
