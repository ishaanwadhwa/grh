"use client";

import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import SectionDivider from "@/components/ui/SectionDivider";

const upcomingEvents = [
  {
    title: "Tiny Desk Jaipur",
    date: "Coming Soon",
    description:
      "An intimate live music session on the rooftop. Local and indie artists, fort views, and a crowd that actually listens.",
    tag: "Music",
  },
  {
    title: "The Long Table",
    date: "Coming Soon",
    description:
      "A 20-seat communal dinner by a guest chef. One menu, no choices, all conversation. The kind of evening where strangers leave as friends.",
    tag: "Dining",
  },
  {
    title: "Design & Chai",
    date: "Coming Soon",
    description:
      "Morning conversations with architects, designers, and makers. No slides, no panels — just chai, ideas, and the courtyard.",
    tag: "Community",
  },
];

const pastHighlights = [
  "Opening Night — The Haveli Lights Up",
  "Chef's Table: Rajasthani Roots, Modern Routes",
  "Full Moon Rooftop with DJ sets",
];

export default function EventsPage() {
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
            What&apos;s Happening
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl text-text-inverse"
          >
            Events & Gatherings
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-4 text-base text-text-inverse/50 max-w-2xl"
          >
            Dinners, music, conversations, and the kind of evenings you
            didn&apos;t know you needed. Not events for content — events for
            connection.
          </motion.p>

          <SectionDivider />

          {/* Upcoming */}
          <h2 className="text-xs uppercase tracking-[0.3em] text-accent-gold/60 font-body font-medium mb-8">
            Upcoming
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingEvents.map((event, i) => (
              <motion.div
                key={event.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className="border border-accent-gold/10 p-6 hover:border-accent-gold/25 transition-all duration-500 group"
              >
                {/* Image placeholder */}
                <div className="aspect-[4/3] bg-primary-light/15 mb-6 flex items-center justify-center">
                  <p className="text-accent-gold/15 text-xs tracking-widest uppercase">
                    {event.tag}
                  </p>
                </div>

                <span className="text-xs uppercase tracking-wider text-accent-gold/40">
                  {event.date}
                </span>
                <h3 className="mt-2 font-display text-xl text-text-inverse group-hover:text-accent-gold transition-colors duration-300">
                  {event.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-inverse/40">
                  {event.description}
                </p>
              </motion.div>
            ))}
          </div>

          <SectionDivider />

          {/* Past Highlights */}
          <h2 className="text-xs uppercase tracking-[0.3em] text-accent-gold/60 font-body font-medium mb-8">
            Past Highlights
          </h2>

          <div className="space-y-4">
            {pastHighlights.map((highlight, i) => (
              <motion.div
                key={highlight}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-center gap-4 py-3 border-b border-accent-gold/10"
              >
                <span className="text-accent-gold/30 font-display text-lg">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-text-inverse/50">{highlight}</p>
              </motion.div>
            ))}
          </div>

          <SectionDivider />

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <p className="text-text-inverse/40 mb-4">
              Want to know when something&apos;s happening?
            </p>
            <Button href="https://instagram.com/goodroomhouse" variant="secondary">
              Follow on Instagram
            </Button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
